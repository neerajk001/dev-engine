# Coding CLI Agent

A local-first AI coding agent with a project-aware **Prompt Optimization + Intent Clarification** workflow.

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
