# Development Roadmap

## Phase 1 — V1: Basic Coding Agent ✅ COMPLETED

### Objective

Build a reliable local coding CLI with a minimal agent loop.

### Build

- [x] Node.js + TypeScript CLI
- [x] Interactive input loop
- [x] `/help`
- [x] `/exit`
- [x] LLM provider interface
- [x] OpenAI provider
- [x] Agent loop
- [x] Tool registry
- [x] `read_file`
- [x] `list_files`
- [x] `search_files`
- [x] `edit_file`
- [x] `run_command`
- [x] Tool result handling
- [x] Iteration limit
- [x] Basic error handling
- [x] Project/workspace boundary
- [x] Basic test execution
- [x] Final result reporting

### V1 flow

```text
Prompt
  ↓
LLM
  ↓
Tool call?
  ├── No → Final response
  └── Yes
       ↓
    Validate
       ↓
    Execute
       ↓
    Tool result
       ↓
      LLM
```

### Definition of Done

The agent can modify a real local repository and verify the change with a relevant test or command.

---

# Phase 2 — V2: Prompt Optimization ✅ COMPLETED

## Objective

Help inexperienced/vague users express their intent clearly before the coding agent executes.

### Build

- [x] Optimize input action
- [x] Project context collector
- [x] Project tree summary
- [x] `package.json` context
- [x] README context
- [x] Relevant-file search
- [x] Intent analyzer
- [x] Ambiguity detection
- [x] Clarifying questions
- [x] Optimized task generator
- [x] Structured `OptimizedTask`
- [x] Token/context comparison
- [x] Optimized task preview
- [x] Execute/Edit/Cancel flow

### Example

```text
User:
"make the dashboard better"

        ↓

Context Analyzer

        ↓

Intent Analyzer

        ↓

Ambiguity detected

        ↓

Question:
"What do you want to improve?"

        ↓

User answer

        ↓

Optimized Task

        ↓

Coding Agent
```

### Definition of Done

A vague user request can be converted into a clear, project-aware implementation task before execution.

---

# Phase 3 — V3: Stronger Coding Agent ✅ COMPLETED

## Objective

Make the coding agent more capable while preserving the same core architecture.

### Build

- [x] Automatic relevant-file discovery
- [x] Better repository exploration
- [x] Context prioritization
- [x] Implementation planning
- [x] Plan preview
- [x] Approval mode
- [x] Command safety checks
- [x] Dangerous-command confirmation
- [x] Git status
- [x] Git diff
- [x] Git history
- [x] Verification strategy
- [x] Test → failure → repair loop
- [x] Retry limit
- [x] Better error reporting
- [x] Ink TUI with menu-driven interface
- [x] Execution history tracking

### Definition of Done

The agent can complete moderately complex coding tasks with controlled execution, planning, verification, and recovery.

---

# Phase 4 — V4: Observability ✅ COMPLETED

## Objective

Understand exactly what the agent did.

### Build

- [x] Run IDs
- [x] Event model (enhanced with timing)
- [x] Execution trace
- [x] Event persistence (JSON files)
- [x] Token tracking
- [x] Timing (per-event timestamps)
- [x] Tool-call history
- [x] Error history
- [x] CLI trace viewer (`/traces` command)
- [x] Optional web dashboard — deferred by choice (CLI viewer sufficient for now; SSE transport can be added on the existing persisted traces)

### Trace

```text
Run #102

1. agent_started
2. list_files
3. search_files
4. read_file
5. model_response
6. edit_file
7. run_command
8. error
9. edit_file
10. run_command
11. success
12. agent_finished
```

### Definition of Done

A completed run can be replayed and understood from its event history.

---

# Phase 5 — V5: Agent Evaluation ✅ COMPLETED

## Objective

Turn execution traces and task outcomes into measurable agent performance.

### Build

- [x] Benchmark definitions
- [x] Benchmark tasks
- [x] Deterministic evaluators
- [x] Test evaluator
- [x] Build evaluator
- [x] Requirement evaluator
- [x] LLM judge — scaffolded (judgeScores field; LLM judge to be wired per provider)
- [x] Scoring system
- [x] Failure categories
- [x] Run comparison
- [x] Agent versions
- [x] Historical metrics

### Metrics

```text
Success rate
Correctness
Tool efficiency
Steps
Latency
Token usage
Estimated cost
Recovery rate
```

### Definition of Done

The platform can compare agent runs objectively and explain major failures.

---

# Future Phase — Multi-Agent / Provider Comparison

Only after V5 works.

Potential adapters:

```text
Your Agent
OpenAI-based Agent
Anthropic-based Agent
Other compatible agents
```

The adapter interface should normalize their events and results.

Goal:

```text
Same task
   ↓
Agent A ─┐
Agent B ─┼→ Evaluation
Agent C ─┘
             ↓
        Comparison
```

Do not assume every external coding agent exposes a public runtime API or complete execution stream. Build adapters only where integration is technically supported.

---

# Phase Priority Rule

If a feature belongs to a later phase, do not build it early just because it sounds interesting.

The priority is:

```text
Reliable execution
       ↓
Better user intent
       ↓
Better codebase understanding
       ↓
Verification & recovery
       ↓
Observability
       ↓
Evaluation
       ↓
Optimization
```
