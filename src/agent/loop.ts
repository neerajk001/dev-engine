import type { LLMProvider } from '../llm/provider.js';
import type { ProviderMessage } from '../llm/types.js';
import { buildFormatNudge } from '../llm/prompt.js';
import type { Tool } from '../tools/types.js';
import { executeTool } from '../tools/registry.js';
import { generatePlan } from './planner.js';
import { verifyProject } from '../verification/runner.js';
import type { Verdict } from '../verification/types.js';
import type { AgentConfig, AgentResult, AgentStatus } from './types.js';
import type { AgentEvent } from './events.js';
import { eventToLine } from './events.js';
import { TraceCollector } from '../tracing/collector.js';
import { saveTrace } from '../tracing/trace.js';

const FINAL_PREFIXES: Record<AgentStatus, string> = {
  done: '[done]',
  failed: '[failed]',
  blocked: '[blocked]',
};

function detectStatus(text: string): AgentStatus | null {
  const firstLine = text.split('\n', 1)[0]?.trim() ?? '';
  for (const [status, prefix] of Object.entries(FINAL_PREFIXES)) {
    if (firstLine.startsWith(prefix)) {
      return status as AgentStatus;
    }
  }
  return null;
}

export interface RunAgentInput {
  provider: LLMProvider;
  tools: Tool[];
  /** System prompt already includes project context. */
  systemPrompt: string;
  projectContext: string;
  task: string;
  config: AgentConfig;
}

function summarizeInput(input: unknown): string {
  try {
    const s = JSON.stringify(input);
    return s && s.length > 120 ? `${s.slice(0, 120)}…` : s ?? '';
  } catch {
    return '';
  }
}

/**
 * Run the agent loop: plan (when enabled) → ask the model → execute tool
 * calls → verify after edits → repair on failure → repeat until a final
 * report or a limit is hit. Emits structured events to config.onEvent
 * (and keeps config.onStatus as a plain-text adapter).
 */
export async function runAgentLoop(input: RunAgentInput): Promise<AgentResult> {
  const { provider, tools, systemPrompt, projectContext, task, config } = input;

  const toolByName = new Map(tools.map((t) => [t.name, t]));
  const toolDefs = tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));

  const messages: ProviderMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: task },
  ];

  const events: AgentEvent[] = [];
  const trace = new TraceCollector();
  const startTime = Date.now();
  const emit = (event: AgentEvent): void => {
    events.push(event);
    trace.record(event);
    config.onEvent?.(event);
    if (config.onStatus) {
      config.onStatus(eventToLine(event));
    }
  };

  let iterations = 0;
  let toolCallCount = 0;
  let formatNudged = false;
  let lastAssistantText = '';

  trace.start(task);
  emit({ type: 'agent_start', task });

  const finish = (result: Omit<AgentResult, 'events' | 'runId' | 'tracePath' | 'durationMs' | 'tokenUsage'>): AgentResult => {
    const durationMs = Date.now() - startTime;
    emit({ type: 'agent_end', status: result.status, report: result.report });
    const fullTrace = trace.finalize(
      result.status,
      durationMs,
      result.toolCallCount,
      result.iterations,
      0, // repairCount tracked separately — approximate for now
    );
    let tracePath: string | undefined;
    try {
      tracePath = saveTrace(config.root, fullTrace);
    } catch {
      // Persistence is best-effort; don't crash if the trace can't be saved.
    }
    return {
      ...result,
      events,
      runId: trace.runId,
      ...(tracePath !== undefined ? { tracePath } : {}),
      durationMs,
      tokenUsage: fullTrace.tokenUsage,
    };
  };

  const verify = async (): Promise<Verdict | null> => {
    const fresh = await verifyProject({ root: config.root, preferTscFallback: true });
    if (fresh) {
      emit({
        type: 'verification_start',
        command: fresh.command,
      });
      emit({
        type: 'verification_end',
        command: fresh.command,
        ok: fresh.ok,
        output: fresh.output,
      });
    }
    return fresh;
  };

  // Optional implementation planning phase.
  if ((config.approvalMode ?? 'none') !== 'none') {
    try {
      const plan = await generatePlan(provider, task, projectContext);
      emit({ type: 'plan_ready', plan });
      const approved =
        config.onApprovePlan === undefined
          ? true
          : await config.onApprovePlan({ steps: plan.steps, verification: plan.verification, relevantFiles: plan.relevantFiles });
      if (!approved) {
        return finish({
          status: 'blocked',
          report: '[blocked]\nThe proposed plan was not approved.',
          iterations,
          toolCallCount,
          terminationReason: 'plan rejected by the user',
        });
      }
      messages.push({
        role: 'user',
        content: `Approved implementation plan:\n${plan.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nProceed. After making changes, verify with: ${plan.verification.join(', ') || 'the project tests'}.`,
      });
      // consume the original task message; the plan is now the task
      messages.splice(1, 1);
    } catch (err) {
      // Planning is best-effort: if it fails, fall through to the normal loop.
      emit({ type: 'tool_end', name: 'planner', ok: false, summary: err instanceof Error ? err.message : String(err) });
    }
  }

  let repairsUsed = 0;
  const maxRepairs = config.maxRepairs ?? 3;

  while (iterations < config.maxIterations) {
    iterations += 1;

    emit({ type: 'model_request' });
    const response = await provider.generate({ messages, tools: toolDefs });
    if (response.tokenUsage) {
      trace.addTokens(response.tokenUsage.promptTokens, response.tokenUsage.completionTokens);
    }
    emit({ type: 'model_response', toolCalls: response.toolCalls.length });
    messages.push({
      role: 'assistant',
      content: response.content,
      ...(response.toolCalls.length > 0
        ? { toolCalls: response.toolCalls }
        : {}),
    });
    lastAssistantText = response.content ?? '';

    if (response.stopReason === 'tool_calls' && response.toolCalls.length > 0) {
      toolCallCount += 1;
      let editedThisRound = false;
      for (const call of response.toolCalls) {
        const tool = toolByName.get(call.name);
        if (!tool) {
          messages.push({
            role: 'tool',
            content: `unknown tool: ${call.name}`,
            toolCallId: call.id,
          });
          continue;
        }
        let resultText: string;
        let parsed: unknown;
        try {
          parsed = JSON.parse(call.arguments);
        } catch {
          messages.push({
            role: 'tool',
            content: `invalid JSON arguments: ${call.arguments}`,
            toolCallId: call.id,
          });
          continue;
        }
        emit({ type: 'tool_start', name: tool.name, input: parsed });
        const result = await executeTool(tool, parsed);
        if (result.ok) {
          resultText = result.text;
          if (tool.name === 'edit_file') {
            editedThisRound = true;
            const edit = parsed as { path?: unknown; oldText?: unknown; newText?: unknown };
            if (typeof edit.path === 'string' && typeof edit.oldText === 'string' && typeof edit.newText === 'string') {
              emit({
                type: 'file_diff',
                path: edit.path,
                removed: edit.oldText.split(/\r?\n/),
                added: edit.newText.split(/\r?\n/),
              });
            }
          }
          emit({ type: 'tool_end', name: tool.name, ok: true, summary: summarizeInput(parsed) });
        } else {
          const recoverableNote = result.recoverable
            ? ''
            : '\n(Not recoverable: this failure cannot be fixed by further tool calls.)';
          resultText = `Error: ${result.error}${recoverableNote}`;
          emit({ type: 'tool_end', name: tool.name, ok: false, summary: result.error });
          if (!result.recoverable) {
            const report = [
              '[blocked]',
              `A tool call could not complete: ${result.error}`,
            ].join('\n');
            return finish({
              status: 'blocked',
              report,
              iterations,
              toolCallCount,
              terminationReason: `non-recoverable tool failure in ${call.name}`,
            });
          }
        }
        messages.push({
          role: 'tool',
          content: resultText,
          toolCallId: call.id,
        });
      }

      // After any edit, run verification; on failure, start a repair round.
      if (editedThisRound && repairsUsed < maxRepairs) {
        const verdict = await verify();
        if (verdict && !verdict.ok) {
          repairsUsed += 1;
          emit({
            type: 'repair_start',
            attempt: repairsUsed,
            maxAttempts: maxRepairs,
            reason: `verification failed: ${verdict.command}`,
          });
          messages.push({
            role: 'user',
            content: `The verification command "${verdict.command}" failed after your edits. Output:\n${verdict.output.slice(0, 4000)}\n\nFix the problem. This is repair attempt ${repairsUsed}/${maxRepairs}.`,
          });
        }
      }
      continue;
    }

    // end_turn: model produced a final answer — check the report format.
    const status = detectStatus(lastAssistantText);
    if (status !== null) {
      // Verify before declaring done (only when we made edits and haven't verified).
      if (status === 'done' && repairsUsed < maxRepairs) {
        const verdict = await verify();
        if (verdict && !verdict.ok) {
          repairsUsed += 1;
          emit({
            type: 'repair_start',
            attempt: repairsUsed,
            maxAttempts: maxRepairs,
            reason: `final verification failed: ${verdict.command}`,
          });
          messages.push({
            role: 'user',
            content: `You reported [done] but the verification command "${verdict.command}" failed. Output:\n${verdict.output.slice(0, 4000)}\n\nFix it and re-run. This is repair attempt ${repairsUsed}/${maxRepairs}.`,
          });
          continue;
        }
      }
      return finish({ status, report: lastAssistantText, iterations, toolCallCount });
    }
    if (!formatNudged) {
      formatNudged = true;
      messages.push({ role: 'user', content: buildFormatNudge() });
      continue;
    }
    return finish({
      status: 'blocked',
      report: lastAssistantText,
      iterations,
      toolCallCount,
      terminationReason: 'model did not produce a [done]/[failed]/[blocked] report',
    });
  }

  return finish({
    status: 'blocked',
    report: lastAssistantText,
    iterations,
    toolCallCount,
    terminationReason: `iteration limit exceeded (${config.maxIterations})`,
  });
}
