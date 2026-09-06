import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCommand } from '../safety/commands.js';
import { runCommand } from '../util/process.js';
import type { EvaluatorResult, EvaluatorSpec } from './benchmark.js';

/** Run a deterministic evaluator against a workspace. */
export async function runEvaluator(
  root: string,
  spec: EvaluatorSpec,
): Promise<EvaluatorResult> {
  const started = Date.now();
  try {
    switch (spec.type) {
      case 'test':
      case 'build': {
        const argv = parseCommand(spec.command);
        const result = await runCommand({
          command: argv[0]!,
          args: argv.slice(1),
          cwd: root,
        });
        return {
          spec,
          passed: result.exitCode === 0,
          detail: result.output.slice(0, 1000),
          durationMs: Date.now() - started,
        };
      }
      case 'requirement': {
        const filepath = path.join(root, spec.file);
        let content: string;
        try {
          content = readFileSync(filepath, 'utf8');
        } catch {
          return {
            spec,
            passed: false,
            detail: `file not found: ${spec.file}`,
            durationMs: Date.now() - started,
          };
        }
        const re = new RegExp(spec.pattern);
        return {
          spec,
          passed: re.test(content),
          detail: re.test(content)
            ? `found match in ${spec.file}`
            : `no match for /${spec.pattern}/ in ${spec.file}`,
          durationMs: Date.now() - started,
        };
      }
    }
  } catch (err) {
    return {
      spec,
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - started,
    };
  }
}