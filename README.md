# Coding CLI Agent

A local-first AI coding agent with a project-aware **Prompt Optimization + Intent Clarification** workflow.

This is an engineering project for exploring reliable tool-using agents, not just a chat wrapper. The system turns a natural-language request into controlled repository changes, verifies those changes, records what happened, and measures the result.

## Core Idea

Most developers do not always know how to express a coding task precisely.

Instead of immediately sending:

```text
"make the dashboard better"
```

to an agent, the user can choose:

```text
✨ Optimize
```

The system analyzes the request together with the project context, identifies ambiguity, asks focused questions when needed, and creates a clear implementation task.

## Core Flow

```text
User
 ↓
Prompt
 ↓
✨ Optimize? ── No ──→ Coding Agent
 ↓ Yes
Project Context
 ↓
Intent Analysis
 ↓
Clarification
 ↓
Optimized Task
 ↓
Coding Agent
 ↓
Read / Search / Edit / Shell
 ↓
Tests
 ↓
Result
```

## Current Scope

The project is intentionally being built as a coding CLI first.

### V1 — ✅ implemented

Basic coding agent: Node.js + TypeScript CLI, interactive input loop, LLM provider interface (OpenAI), agent loop, tool registry (read_file, list_files, search_files, edit_file, run_command), iteration limits, error handling, project boundaries, and test execution.

### V2 — ✅ implemented

Prompt optimization and clarification: project context collector, intent analyzer, ambiguity detection, clarifying questions, optimized task generator with structured `OptimizedTask`, task preview, and Execute/Edit/Cancel flow.

### V3 — ✅ implemented

Stronger coding agent: automatic relevant-file discovery, implementation planning with plan preview and approval mode, command safety checks, git awareness (git_status, git_diff, git_log), verification strategy with test→failure→repair loop (up to MAX_REPAIRS), retry limits, better error reporting, Ink TUI with menu-driven interface, and execution history tracking.

### V4 — ✅ implemented (except web dashboard)

Observability: run IDs, enhanced event model with per-event timestamps, execution traces persisted as JSON files in `.dev-engine/traces/`, token tracking (prompt/completion/total), tool-call history, error history, and a `/traces` CLI command to list and inspect past runs.

### V5 — ✅ implemented

Evaluation: benchmark task definitions (3 tasks), deterministic evaluators (test, build, requirement checks), a composite scoring system (0-100 across evaluator pass rate, completion, efficiency, recovery), failure categorization, run comparison, agent-version tracking with historical metrics — all readable via the `/evaluate` CLI command.

### Future phase

Multi-agent / provider comparison (planned after V5).

## Architecture

The system is split into small boundaries with one-way data flow:

```text
CLI / TUI
  |
  +--> Prompt optimizer --> OptimizedTask
  |                              |
  +------------------------------+--> Agent loop
                     |
         +-----------------------+-----------------------+
         |                       |                       |
      LLM provider          Tool registry            Verifier
         |                       |                       |
      OpenAI adapter       read/search/edit/shell       tests/build/tsc
                     |
                  Safety validation
                     |
              Trace + result persistence
```

Important boundaries:

- `LLMProvider` isolates provider-specific API calls from orchestration.
- The tool registry gives the model a typed tool surface; tools do not control the agent loop.
- The optimizer is independent from the coding agent and returns a structured `OptimizedTask`.
- Safety checks validate paths and commands before filesystem or shell access.
- Verification returns structured feedback so failed changes can enter a bounded repair loop.
- Tracing records run IDs, events, timing, token usage, tool calls, and failures for later inspection.

## Complexity And Resource Bounds

Let `F` be the number of files examined, `S` the total size of searched file content, `I` the iteration limit, `T` the number of tool calls, and `R` the repair limit.

| Operation | Complexity / bound | Practical implication |
| --- | --- | --- |
| Project context collection | `O(F)` tree traversal; file reads are capped | Context discovery is linear in the workspace and bounded to 300 tree entries and 4,000 rendered context tokens. |
| Relevant-file search | Approximately `O(S)` for the ripgrep/search pass | Search is delegated to repository-aware tooling instead of loading the whole repository into the prompt. |
| Agent orchestration | At most `I` model iterations plus optional planning | `MAX_ITERATIONS` prevents an uncontrolled loop; the default is 25. |
| Tool execution | `O(T)` orchestration overhead, excluding the tool itself | Each tool call is validated and recorded before its result is returned to the model. |
| Verification and repair | At most `R` repair attempts; each attempt costs one or more project commands | `MAX_REPAIRS` bounds recovery work; the default is 3. Command runtime depends on the project. |
| Prompt optimization | Two model calls: intent analysis and task generation | A clarification answer is included in the task-generation call; the repository context is bounded before either call. |
| Trace persistence | `O(E)` for `E` recorded events | Traces are append-like JSON artifacts and are best-effort so persistence failure does not hide the task result. |

The dominant cost is normally model latency and token usage, followed by verification command runtime. Traditional in-memory algorithmic complexity is important for local search and traversal, but it is not the main performance bottleneck for an LLM-driven workflow.

## Safety And Reliability

- Workspace paths are resolved and checked against the configured project root to prevent path traversal.
- Shell commands go through an allow-list and dangerous commands can require explicit approval.
- The agent has explicit iteration, repair, and approval limits.
- A successful model response is not enough to claim success: edits are verified with the best available project check, and failures are returned to the repair loop.
- Non-recoverable tool failures produce a blocked result instead of being silently retried.
- Every run has a final status: `[done]`, `[failed]`, or `[blocked]`, with evidence in the result and persisted trace.

## Testing And Evaluation

The test suite covers:

- path and command safety;
- all filesystem, search, shell, and Git tools;
- the agent loop, planning, task modes, and event model;
- optimizer context collection, ambiguity handling, and structured task parsing;
- verification requirements and repair behavior;
- trace persistence, CLI behavior, output formatting, and TUI rendering; and
- deterministic evaluation scoring.

The project separates deterministic checks from model judgment. Tests, builds, compiler checks, and requirement checks provide reproducible evidence. The LLM judge is currently scaffolded rather than being the source of truth, which keeps the evaluation pipeline explainable.

## Engineering Tradeoffs And Limitations

- **Local-first CLI:** gives the agent direct repository access and keeps deployment simple, but it is not yet a hosted multi-user service.
- **Progressive retrieval instead of a vector database:** tree summaries, `ripgrep`, and bounded file reads are easier to inspect and sufficient for this project size; semantic retrieval may become useful at larger repository scale.
- **Single agent before multi-agent:** keeps state, failure recovery, and evaluation understandable; provider and agent comparison is deliberately future work.
- **Deterministic verification before LLM judging:** stronger for correctness, but project-specific tests still determine how much behavior can be verified automatically.
- **Best-effort trace persistence:** a trace write failure does not crash a coding run, but that run may be missing from history.
- **OpenAI is the current provider implementation:** the interface is provider-independent, but additional providers are not implemented yet.

## Interview Discussion Points

This project is designed to make the following engineering decisions easy to discuss:

1. How to bound an autonomous loop with iteration, approval, and repair limits.
2. How to keep model-specific code behind an interface and keep tools separate from orchestration.
3. How to validate untrusted model-generated paths and commands before execution.
4. How to turn vague intent into a structured task without silently inventing requirements.
5. How to verify agent output with deterministic checks and expose failures as repair context.
6. How to make agent behavior observable through event traces, token usage, timing, and evaluation metrics.

## Running

```bash
npm install
cp .env.example .env      # add OPENAI_API_KEY
npm run build
npm start                 # interactive CLI (Ink TUI on a TTY; line mode otherwise)
```

Optional env vars (also settable in `.env`):

- `MODEL` — model name (default `gpt-4o-mini`)
- `WORKSPACE` — project root the agent operates in (default: current directory)
- `MAX_ITERATIONS` — LLM iteration cap per task (default `25`)
- `MAX_REPAIRS` — verification repair attempts per task (default `3`)
- `APPROVAL_MODE` — `none` (default), `plan`, or `all` (plan/command gating)

The CLI also accepts `--workspace <dir>` / `--workspace=<dir>`.

When you run `npm start` in a real terminal you get the **Ink TUI**: a status
bar (workspace/model/phase), a live activity feed of tool calls, edits,
verification runs, and repairs, plus inline prompts for `/optimize`,
clarifying questions, task previews, and approvals. Piped/non-TTY input falls
back to line mode with the same commands.

Commands: `/help`, `/exit`, `/optimize`, `/traces`, `/evaluate`. Type a natural-language task and the
agent explores the project, **plans**, edits files, **verifies** with tests or
a typecheck after edits, **repairs** on failure (up to `MAX_REPAIRS`), and
reports `[done]` / `[failed]` / `[blocked]` with evidence. Each run is
persisted as a JSON trace in `.dev-engine/traces/` — use `/traces` to list
past runs and `/traces <runId>` to see the full event timeline with token
usage and timing. `/evaluate [taskId]` runs a benchmark task against the
agent and prints a scored evaluation (pass rate, efficiency, cost, failure
categories). Read-only git tools (`git_status`, `git_diff`, `git_log`)
are available inside a repo. Commands not on the allow-list ask for approval
before running.

### Optimize flow (`/optimize`)

Start a line with `/optimize` and describe a vague request, e.g.
`make the math module better`. The optimizer:

1. Collects project context (file tree, package.json, README) plus files
   relevant to your wording.
2. Analyzes intent; when the request is ambiguous it asks one focused
   question with numbered options.
3. Produces a structured task preview: intent, relevant files, requirements,
   constraints, assumptions, acceptance criteria.
4. Waits for `Execute`, `Edit`, or `Cancel` before the coding agent runs —
   so you always see what will be done first.

## Development

```bash
npm run typecheck     # tsc --noEmit
npm test              # build + node:test suite
npm run build         # compile to dist/
```

Unit tests cover path/command safety, all five tools, the optimizer pipeline
(intent → clarify → task, with a scripted provider), and the CLI REPL/output.
A full end-to-end smoke test (agent edits a scratch repo and verifies with a
real test run) requires `OPENAI_API_KEY` and a scratch workspace.

## Principles

- Local-first
- Small incremental phases
- Strong TypeScript types
- Minimal dependencies
- Safe tool execution
- Project-aware context
- Verification before claiming success
- No premature infrastructure

See:

- `AGENTS.md` — instructions for AI coding agents working on this repository
- `ROADMAP.md` — implementation phases
- `ARCHITECTURE.md` — system architecture
- `DECISIONS.md` — architecture decisions
- `PROMPT_OPTIMIZER.md` — optimizer specification
