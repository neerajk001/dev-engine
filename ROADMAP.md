# Development Roadmap

## Phase 1 — V1: Basic Coding Agent

### Objective

Build a reliable local coding CLI with a minimal agent loop.

### Build

- [ ] Node.js + TypeScript CLI
- [ ] Interactive input loop
- [ ] `/help`
- [ ] `/exit`
- [ ] LLM provider interface
- [ ] OpenAI provider
- [ ] Agent loop
- [ ] Tool registry
- [ ] `read_file`
- [ ] `list_files`
- [ ] `search_files`
- [ ] `edit_file`
- [ ] `run_command`
- [ ] Tool result handling
- [ ] Iteration limit
- [ ] Basic error handling
- [ ] Project/workspace boundary
- [ ] Basic test execution
- [ ] Final result reporting

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

# Phase 2 — V2: Prompt Optimization

## Objective

Help inexperienced/vague users express their intent clearly before the coding agent executes.

### Build

- [ ] Optimize input action
- [ ] Project context collector
- [ ] Project tree summary
- [ ] `package.json` context
- [ ] README context
- [ ] Relevant-file search
- [ ] Intent analyzer
- [ ] Ambiguity detection
- [ ] Clarifying questions
- [ ] Optimized task generator
- [ ] Structured `OptimizedTask`
- [ ] Token/context comparison
- [ ] Optimized task preview
- [ ] Execute/Edit/Cancel flow

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

# Phase 3 — V3: Stronger Coding Agent

## Objective

Make the coding agent more capable while preserving the same core architecture.

### Build

- [ ] Automatic relevant-file discovery
- [ ] Better repository exploration
- [ ] Context prioritization
- [ ] Implementation planning
- [ ] Plan preview
- [ ] Approval mode
- [ ] Command safety checks
- [ ] Dangerous-command confirmation
- [ ] Git status
- [ ] Git diff
- [ ] Git history
- [ ] Verification strategy
- [ ] Test → failure → repair loop
- [ ] Retry limit
- [ ] Better error reporting

### Definition of Done

The agent can complete moderately complex coding tasks with controlled execution, planning, verification, and recovery.

---

# Phase 4 — V4: Observability

## Objective

Understand exactly what the agent did.

### Build

- [ ] Run IDs
- [ ] Event model
- [ ] Execution trace
- [ ] Event persistence
- [ ] Token tracking
- [ ] Timing
- [ ] Tool-call history
- [ ] Error history
- [ ] CLI trace viewer
- [ ] Optional web dashboard
- [ ] SSE live event stream

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

# Phase 5 — V5: Agent Evaluation

## Objective

Turn execution traces and task outcomes into measurable agent performance.

### Build

- [ ] Benchmark definitions
- [ ] Benchmark tasks
- [ ] Deterministic evaluators
- [ ] Test evaluator
- [ ] Build evaluator
- [ ] Requirement evaluator
- [ ] LLM judge
- [ ] Scoring system
- [ ] Failure categories
- [ ] Run comparison
- [ ] Agent versions
- [ ] Historical metrics

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
