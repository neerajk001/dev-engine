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

### V1 — implemented

Basic coding agent (see `ROADMAP.md` Phase 1).

### V2

Prompt optimization and clarification.

### V3

Planning, codebase understanding, safety, Git, and recovery.

### V4

Tracing and observability.

### V5

Evaluation and benchmarking.

## Running (V1)

```bash
npm install
cp .env.example .env      # add OPENAI_API_KEY
npm run build
npm start                 # interactive CLI
```

Optional env vars (also settable in `.env`):

- `MODEL` — model name (default `gpt-4o-mini`)
- `WORKSPACE` — project root the agent operates in (default: current directory)
- `MAX_ITERATIONS` — LLM iteration cap per task (default `25`)

The CLI also accepts `--workspace <dir>` / `--workspace=<dir>`.

Commands inside the REPL: `/help`, `/exit`. Type a natural-language task and
the agent explores the project, edits files, runs tests/typechecks via
`run_command`, and reports back with `[done]` / `[failed]` / `[blocked]`.
Commands that are not on the allow-list (tests, builds, type checks, read-only
git) ask for your approval before running.

## Development

```bash
npm run typecheck     # tsc --noEmit
npm test              # build + node:test suite
npm run build         # compile to dist/
```

Unit tests cover path/command safety, all five tools, and the CLI output
module. A full end-to-end smoke test (agent edits a scratch repo and verifies
with a real test run) requires `OPENAI_API_KEY` and a scratch workspace.

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
