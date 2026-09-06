import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { ActivityPane } from './ActivityPane.js';
import { StatusBar } from './StatusBar.js';
import { Menu } from './Menu.js';
import type { MenuItem } from './Menu.js';
import type { Agent } from '../agent/agent.js';
import type { AgentEvent } from '../agent/events.js';
import type { AgentResult } from '../agent/types.js';
import type { OptimizeEngine } from '../optimizer/optimizer.js';
import { taskToString } from '../optimizer/types.js';
import type { ClarificationQuestion, OptimizedTask, OptimizeSession } from '../optimizer/types.js';
import { renderTaskPreview } from '../cli/output.js';
import { listTraces, loadTrace, formatTraceSummary, formatTraceDetail } from '../tracing/trace.js';

/** Build a blocked result with V4 fields. */
function blockedResult(report: string): AgentResult {
  return {
    status: 'blocked',
    report,
    iterations: 0,
    toolCallCount: 0,
    events: [],
    runId: 'tui-error',
    durationMs: 0,
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  };
}

function compactReport(report: string): string {
  const lines = report
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const status = lines[0] ?? '[blocked]';
  const detail = lines.slice(1).find((line) => !line.startsWith('```')) ?? '';
  const summary = detail || (status === '[done]' ? 'Task completed.' : 'The task could not be completed.');
  return summary.length > 240 ? `${summary.slice(0, 240)}…` : summary;
}

function fullReport(report: string): string {
  const lines = report
    .split(/\r?\n/)
    .filter((line, index) => index !== 0 || !/^\[(done|failed|blocked)\]$/i.test(line.trim()));
  const text = lines.join('\n').trim();
  return text.length > 4000 ? `${text.slice(0, 4000)}\n… response truncated; use /traces for the full run` : text;
}

function historyReport(report: string): string {
  const lines = report
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\[(done|failed|blocked)\]$/i.test(line));
  const text = lines.join('\n');
  return text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
}

function EditableTaskText({ text, cursor }: { text: string; cursor: number }) {
  const before = text.slice(0, cursor);
  const current = text[cursor];
  const after = current === undefined ? '' : text.slice(cursor + 1);
  return (
    <Text>
      {before}
      {current === undefined ? (
        <Text backgroundColor="white" color="black" bold> </Text>
      ) : (
        <Text backgroundColor="white" color="black" bold>{current}</Text>
      )}
      {after}
    </Text>
  );
}

type TuiPhase = 'idle' | 'clarify' | 'preview' | 'edit-preview' | 'running' | 'done' | 'model-select' | 'traces' | 'status';

interface Execution {
  originalPrompt: string;
  optimizedTask: OptimizedTask | null;
  result: AgentResult;
  events: AgentEvent[];
}

interface TuiState {
  phase: TuiPhase;
  events: AgentEvent[];
  result: AgentResult | null;
  prompt: string;
  cursor: number;
  draftTask: string;
  previewTask: OptimizedTask | null;
  question: ClarificationQuestion | null;
  menuIndex: number;
  focus: 'menu' | 'input';
  history: Execution[];
  currentOriginalPrompt: string;
  traceOutput: string;
  expandedOptimized: number | null;
}

type TuiAction =
  | { type: 'event'; event: AgentEvent }
  | { type: 'set-prompt'; text: string }
  | { type: 'set-cursor'; cursor: number }
  | { type: 'set-menu'; index: number }
  | { type: 'set-focus'; focus: 'menu' | 'input' }
  | { type: 'run-direct' }
  | { type: 'optimize' }
  | { type: 'clarify'; question: ClarificationQuestion }
  | { type: 'task-ready'; task: OptimizedTask }
  | { type: 'edit-task' }
  | { type: 'run-start'; task: string }
  | { type: 'result'; result: AgentResult }
  | { type: 'new-prompt'; text: string }
  | { type: 'back' }
  | { type: 'continue' }
  | { type: 'model-select' }
  | { type: 'show-traces'; output: string }
  | { type: 'show-status' }
  | { type: 'toggle-optimized'; index: number };

const MENU_ITEMS: MenuItem[] = [
  { id: 'optimize', label: 'Optimize', shortcut: 'O' },
  { id: 'run', label: 'Run Direct', shortcut: 'R' },
  { id: 'model', label: 'Select Model', shortcut: 'M' },
  { id: 'exit', label: 'Exit', shortcut: 'X' },
];

const initialState: TuiState = {
  phase: 'idle',
  events: [],
  result: null,
  prompt: '',
  cursor: 0,
  draftTask: '',
  previewTask: null,
  question: null,
  menuIndex: 0,
  focus: 'input',
  history: [],
  currentOriginalPrompt: '',
  traceOutput: '',
  expandedOptimized: null,
};

function reducer(state: TuiState, action: TuiAction): TuiState {
  switch (action.type) {
    case 'event':
      return { ...state, events: [...state.events, action.event] };
    case 'set-prompt':
      return { ...state, prompt: action.text, cursor: Math.min(state.cursor, action.text.length) };
    case 'set-cursor':
      return { ...state, cursor: Math.max(0, Math.min(action.cursor, state.prompt.length)) };
    case 'toggle-optimized':
      return { ...state, expandedOptimized: state.expandedOptimized === action.index ? null : action.index };
    case 'set-menu':
      return { ...state, menuIndex: action.index };
    case 'set-focus':
      return { ...state, focus: action.focus };
    case 'run-direct':
      return { 
        ...state, 
        phase: 'running', 
        draftTask: state.prompt.trim(), 
        prompt: '',
        currentOriginalPrompt: state.prompt.trim(),
        previewTask: null,
        events: [], // Clear events for new execution
        result: null,
      };
    case 'optimize':
      return { 
        ...state, 
        phase: 'idle',
        currentOriginalPrompt: state.prompt.trim(),
      };
    case 'clarify':
      return { ...state, phase: 'clarify', question: action.question, prompt: '' };
    case 'task-ready':
      return { ...state, phase: 'preview', previewTask: action.task, question: null };
    case 'edit-task':
      return {
        ...state,
        phase: 'edit-preview',
        prompt: state.previewTask ? taskToString(state.previewTask) : '',
        cursor: state.previewTask ? taskToString(state.previewTask).length : 0,
      };
    case 'run-start':
      return { 
        ...state, 
        phase: 'running', 
        draftTask: action.task, 
        prompt: '',
        events: [], // Clear events for new execution
        result: null,
      };
    case 'result': {
      // Save to history
      const execution: Execution = {
        originalPrompt: state.currentOriginalPrompt,
        optimizedTask: state.previewTask,
        result: action.result,
        events: state.events,
      };
      return { 
        ...state, 
        phase: 'done', 
        result: action.result, 
        prompt: '',
        history: [...state.history, execution],
      };
    }
    case 'continue':
      // Keep the last execution visible in history, go back to idle
      return { 
        ...state, 
        phase: 'idle', 
        result: null, 
        prompt: '', 
        previewTask: null, 
        question: null,
        currentOriginalPrompt: '',
        // Keep events visible from last execution
      };
    case 'new-prompt':
      return {
        ...state,
        phase: 'idle',
        result: null,
        previewTask: null,
        question: null,
        prompt: action.text,
        currentOriginalPrompt: '',
      };
    case 'back':
      return { ...state, ...initialState, history: state.history };
    case 'model-select':
      return { ...state, phase: 'model-select' };
    case 'show-traces':
      return { ...state, phase: 'traces', traceOutput: action.output, prompt: '' };
    case 'show-status':
      return { ...state, phase: 'status', prompt: '' };
    default:
      return state;
  }
}

export interface TuiProps {
  agent: Agent;
  optimizer?: OptimizeEngine;
  workspace: string;
  model: string;
}

interface OptimizePending {
  session: OptimizeSession;
}

/** Shows recent prompts, responses, and work logs as a persistent conversation. */
function ConversationHistory({
  history,
  expandedOptimized,
  onToggleOptimized,
}: {
  history: Execution[];
  expandedOptimized: number | null;
  onToggleOptimized: (index: number) => void;
}) {
  const recent = history.slice(-6);
  const firstRecentIndex = history.length - recent.length;
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="cyan" bold>Conversation</Text>
      {recent.map((execution, index) => {
        const historyIndex = firstRecentIndex + index;
        const optimizedOpen = expandedOptimized === historyIndex;
        return (
        <Box key={`${execution.result.runId}-${index}`} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
          <Text color="green" bold>{'>'} {execution.originalPrompt}</Text>
          {execution.optimizedTask && (
            <Box flexDirection="column">
              <Text color="magenta" dimColor>
                {optimizedOpen ? '[-]' : '[+]'} Optimized task: {execution.optimizedTask.intent}
                {!optimizedOpen && <Text dimColor>  (Ctrl+O to expand)</Text>}
              </Text>
              {optimizedOpen && <Text>{taskToString(execution.optimizedTask)}</Text>}
            </Box>
          )}
          <Text>
            <Text dimColor>Response: </Text>
            <Text>{historyReport(execution.result.report)}</Text>
          </Text>
          <Text>
            <Text dimColor>Status: </Text>
            <Text color={execution.result.status === 'done' ? 'green' : execution.result.status === 'failed' ? 'red' : 'yellow'}>
              {execution.result.status}
            </Text>
          </Text>
          {execution.events.length > 0 && <ActivityPane events={execution.events} />}
        </Box>
        );
      })}
      {history.length > recent.length && <Text dimColor>… older conversation hidden; showing the last {recent.length} runs</Text>}
    </Box>
  );
}

/** Ink terminal UI for the coding agent with menu-driven interface. */
export function TuiApp({ agent, optimizer, workspace, model }: TuiProps) {
  const { exit } = useApp();
  const [state, dispatch] = useReducer(reducer, initialState);
  const pendingOptimize = useRef<OptimizePending | null>(null);

  // Run the current task when phase flips to running.
  useEffect(() => {
    if (state.phase !== 'running' || state.draftTask === '') return;
    let cancelled = false;
    agent.runWithHooks(state.draftTask, undefined, (ev) => {
      if (!cancelled) dispatch({ type: 'event', event: ev });
    }).then((result) => {
      if (!cancelled) dispatch({ type: 'result', result });
    }).catch((err) => {
      if (!cancelled) {
        dispatch({ type: 'result', result: blockedResult(String(err)) });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state.phase, state.draftTask, agent]);

  const startOptimize = async (prompt: string): Promise<void> => {
    if (!optimizer) {
      dispatch({ type: 'result', result: blockedResult('optimizer unavailable') });
      return;
    }
    const session = optimizer.collect(prompt);
    pendingOptimize.current = { session };
    try {
      const outcome = await optimizer.optimize(session);
      if (outcome.kind === 'clarify') {
        dispatch({ type: 'clarify', question: outcome.question });
      } else {
        dispatch({ type: 'task-ready', task: outcome.task });
      }
    } catch (err) {
      dispatch({ type: 'result', result: blockedResult(`optimize failed: ${String(err)}`) });
    }
  };

  const answerClarify = async (answer: string): Promise<void> => {
    const p = pendingOptimize.current;
    if (!p || !optimizer || !state.question) return;
    try {
      const outcome = await optimizer.optimize({
        ...p.session,
        clarification: state.question,
        clarificationAnswer: answer,
      });
      if (outcome.kind === 'task') {
        dispatch({ type: 'task-ready', task: outcome.task });
      }
    } catch (err) {
      dispatch({ type: 'result', result: blockedResult(`optimize failed: ${String(err)}`) });
    }
  };

  const runOptimizedTask = (task: OptimizedTask): void => {
    dispatch({ type: 'run-start', task: taskToString(task) });
  };

  const handleMenuAction = (itemId: string): void => {
    switch (itemId) {
      case 'optimize':
        if (state.prompt.trim() === '') return;
        void startOptimize(state.prompt.trim());
        dispatch({ type: 'optimize' });
        break;
      case 'run':
        if (state.prompt.trim() === '') return;
        dispatch({ type: 'run-direct' });
        break;
      case 'model':
        dispatch({ type: 'model-select' });
        break;
      case 'exit':
        exit();
        break;
    }
  };

  useInput((input, key) => {
    // Model selection phase
    if (state.phase === 'model-select') {
      if (key.escape || key.return) {
        dispatch({ type: 'back' });
      }
      return;
    }

    // Traces phase - Enter/Esc returns to idle
    if (state.phase === 'traces') {
      if (key.return || key.escape) {
        dispatch({ type: 'continue' });
      }
      return;
    }

    if (state.phase === 'status') {
      if (key.return || key.escape) {
        dispatch({ type: 'continue' });
      }
      return;
    }

    // Clarify phase - just typing the answer
    if (state.phase === 'clarify') {
      if (key.return) {
        const answer = state.prompt.trim();
        if (answer === '') return;
        dispatch({ type: 'set-prompt', text: '' });
        void answerClarify(answer);
        return;
      }
      if (key.backspace) {
        dispatch({ type: 'set-prompt', text: state.prompt.slice(0, -1) });
        return;
      }
      if (key.ctrl) return;
      dispatch({ type: 'set-prompt', text: state.prompt + input });
      return;
    }

    // Preview phase - Enter runs, Esc cancels
    if (state.phase === 'preview') {
      if (key.return) {
        const t = state.previewTask;
        if (t) runOptimizedTask(t);
      } else if (input.toLowerCase() === 'e') {
        dispatch({ type: 'edit-task' });
      } else if (key.escape) {
        dispatch({ type: 'back' });
      }
      return;
    }

    if (state.phase === 'edit-preview') {
      if (key.return) {
        const editedTask = state.prompt.trim();
        if (editedTask !== '') dispatch({ type: 'run-start', task: editedTask });
      } else if (key.escape) {
        dispatch({ type: 'task-ready', task: state.previewTask! });
      } else if (key.backspace) {
        if (state.cursor > 0) {
          const text = state.prompt.slice(0, state.cursor - 1) + state.prompt.slice(state.cursor);
          dispatch({ type: 'set-prompt', text });
          dispatch({ type: 'set-cursor', cursor: state.cursor - 1 });
        }
      } else if (key.delete) {
        if (state.cursor < state.prompt.length) {
          dispatch({ type: 'set-prompt', text: state.prompt.slice(0, state.cursor) + state.prompt.slice(state.cursor + 1) });
        }
      } else if (key.leftArrow) {
        dispatch({ type: 'set-cursor', cursor: state.cursor - 1 });
      } else if (key.rightArrow) {
        dispatch({ type: 'set-cursor', cursor: state.cursor + 1 });
      } else if (key.home) {
        dispatch({ type: 'set-cursor', cursor: 0 });
      } else if (key.end) {
        dispatch({ type: 'set-cursor', cursor: state.prompt.length });
      } else if (!key.ctrl && input) {
        const text = state.prompt.slice(0, state.cursor) + input + state.prompt.slice(state.cursor);
        dispatch({ type: 'set-prompt', text });
        dispatch({ type: 'set-cursor', cursor: state.cursor + input.length });
      }
      return;
    }

    // Done phase - keep the result visible, but allow the next task immediately.
    if (state.phase === 'done') {
      if (key.return || key.escape) {
        dispatch({ type: 'continue' });
      } else if (key.backspace) {
        dispatch({ type: 'new-prompt', text: '' });
      } else if (!key.ctrl && input) {
        dispatch({ type: 'new-prompt', text: input });
      }
      return;
    }

    // Idle phase - menu navigation and input
    if (state.phase === 'idle') {
      if (key.ctrl && input.toLowerCase() === 'o' && state.history.length > 0) {
        dispatch({ type: 'toggle-optimized', index: state.history.length - 1 });
        return;
      }
      // Tab switches focus
      if (key.tab) {
        dispatch({ type: 'set-focus', focus: state.focus === 'menu' ? 'input' : 'menu' });
        return;
      }

      // Menu is focused
      if (state.focus === 'menu') {
        if (key.upArrow) {
          const newIndex = (state.menuIndex - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
          dispatch({ type: 'set-menu', index: newIndex });
          return;
        }
        if (key.downArrow) {
          const newIndex = (state.menuIndex + 1) % MENU_ITEMS.length;
          dispatch({ type: 'set-menu', index: newIndex });
          return;
        }
        if (key.return) {
          handleMenuAction(MENU_ITEMS[state.menuIndex]!.id);
          return;
        }
        // Shortcuts
        if (input.toLowerCase() === 'o') {
          dispatch({ type: 'set-menu', index: 0 });
          handleMenuAction('optimize');
          return;
        }
        if (input.toLowerCase() === 'r') {
          dispatch({ type: 'set-menu', index: 1 });
          handleMenuAction('run');
          return;
        }
        if (input.toLowerCase() === 'm') {
          dispatch({ type: 'set-menu', index: 2 });
          handleMenuAction('model');
          return;
        }
        if (input.toLowerCase() === 'x') {
          dispatch({ type: 'set-menu', index: 3 });
          handleMenuAction('exit');
          return;
        }
        return;
      }

      // Input is focused
      if (key.return) {
        const text = state.prompt.trim();
        if (text === '') return;
        // Intercept /traces before sending to agent
        if (text === '/traces' || text === '/trace') {
          const root = (agent as unknown as { config: { root: string } }).config.root;
          const traces = listTraces(root);
          const output = traces.length === 0
            ? 'No traces found. Run a task first.'
            : `${traces.length} trace(s) found:\n\n${traces.map((t) => formatTraceSummary(t)).join('\n')}\n\nUse /traces <runId> to view details.`;
          dispatch({ type: 'show-traces', output });
          return;
        }
        if (text.startsWith('/traces ')) {
          const runId = text.slice('/traces '.length).trim();
          const root = (agent as unknown as { config: { root: string } }).config.root;
          const trace = loadTrace(root, runId);
          const output = trace
            ? formatTraceDetail(trace)
            : `Trace not found: ${runId}`;
          dispatch({ type: 'show-traces', output });
          return;
        }
        if (text === '/status') {
          dispatch({ type: 'show-status' });
          return;
        }
        // Run directly (no auto-optimize)
        dispatch({ type: 'run-direct' });
        return;
      }
      if (key.backspace) {
        dispatch({ type: 'set-prompt', text: state.prompt.slice(0, -1) });
        return;
      }
      if (key.ctrl) return;
      dispatch({ type: 'set-prompt', text: state.prompt + input });
    }
  });

  return (
    <Box flexDirection="column" paddingY={1}>
      <StatusBar workspace={workspace} model={model} phase={state.phase} />
      
      <Box marginTop={1}>
        <Box width={22} borderStyle="single" borderColor="gray" paddingY={1}>
          <Menu items={MENU_ITEMS} selectedIndex={state.menuIndex} focused={state.focus === 'menu'} />
        </Box>
        
        <Box flexDirection="column" flexGrow={1} marginLeft={2}>
          <ActivityPane events={state.events} />
          
          {/* Preview/Result/Clarify - appears when needed */}
          {state.phase === 'clarify' && state.question && (
            <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1} marginTop={1}>
              <Text color="yellow" bold>Clarify the task</Text>
              <Text>{state.question.question}</Text>
              {state.question.options.map((opt, i) => (
                <Text key={opt}>{i + 1}. {opt}</Text>
              ))}
            </Box>
          )}
          
          {state.phase === 'preview' && state.previewTask && (
            <Box flexDirection="column" borderStyle="single" borderColor="magenta" paddingX={1} marginTop={1}>
              <Text color="magenta" bold>Ready to execute</Text>
              <Text>{renderTaskPreview(state.previewTask)}</Text>
              <Text dimColor>Enter=Execute  E=Edit  Esc=Cancel</Text>
            </Box>
          )}

          {state.phase === 'edit-preview' && (
            <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1} marginTop={1}>
              <Text color="yellow" bold>Edit optimized task</Text>
              <EditableTaskText text={state.prompt} cursor={state.cursor} />
              <Text dimColor>←→ Move  Home/End Jump  Backspace/Delete Remove  Enter=Run  Esc=Cancel</Text>
            </Box>
          )}
          
          {state.phase === 'running' && (
            <Box marginTop={1}>
              <Text color="cyan">● running…</Text>
            </Box>
          )}
          
          {state.phase === 'model-select' && (
            <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1} marginTop={1}>
              <Text color="cyan" bold>Model Selection</Text>
              <Text>Current: {model}</Text>
              <Text dimColor>Model selection not yet implemented</Text>
              <Text dimColor>Press Esc to return</Text>
            </Box>
          )}
          
          {state.phase === 'traces' && (
            <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1} marginTop={1}>
              <Text color="cyan" bold>Execution Traces</Text>
              <Text>{state.traceOutput}</Text>
              <Text dimColor>Press Enter to return</Text>
            </Box>
          )}

          {state.phase === 'status' && (
            <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1} marginTop={1}>
              <Text color="cyan" bold>Status</Text>
              <Text><Text dimColor>Workspace: </Text>{workspace}</Text>
              <Text><Text dimColor>Model: </Text>{model}</Text>
              <Text dimColor>Press Enter to return</Text>
            </Box>
          )}
          
          {/* Keep prior prompts and agent work visible while the next task is entered or runs. */}
          {(state.phase === 'idle' || state.phase === 'running' || state.phase === 'done') && state.history.length > 0 && (
            <ConversationHistory
              history={state.history}
              expandedOptimized={state.expandedOptimized}
              onToggleOptimized={(index) => dispatch({ type: 'toggle-optimized', index })}
            />
          )}
          
          {state.phase !== 'edit-preview' && (
            <Box marginTop={1} borderStyle="single" borderColor={state.focus === 'input' ? 'green' : 'gray'} paddingX={1}>
              <Text color={state.focus === 'input' ? 'green' : 'gray'} bold>
                {state.phase === 'clarify' ? '?' : '>'}
              </Text>
              <Text dimColor>  {state.phase === 'clarify' ? 'Answer' : 'Prompt'}  </Text>
              <Text>{state.prompt}</Text>
              {state.focus === 'input' && <Text color="green">▌</Text>}
            </Box>
          )}
        </Box>
      </Box>
      
      <Box marginTop={1} paddingX={1} justifyContent="space-between">
        <Text dimColor>
          {state.focus === 'menu' 
            ? '↑↓ Navigate  Enter=Select  Tab=Input'
            : state.phase === 'preview'
              ? 'Enter=Execute  E=Edit  Esc=Cancel  Tab=Menu'
              : state.phase === 'edit-preview'
                ? 'Type to edit  Enter=Run  Esc=Cancel'
              : state.phase === 'done'
                ? 'Enter=New Prompt  Tab=Menu'
                : state.phase === 'traces'
                  ? 'Enter=Back  Tab=Menu'
                  : state.phase === 'status'
                    ? 'Enter=Back  Tab=Menu'
                  : 'Type prompt  Enter=Run  /traces  Ctrl+O=Optimized  Tab=Menu'}
        </Text>
        <Text dimColor>Tab focus  ·  Ctrl+C exit</Text>
      </Box>
    </Box>
  );
}
