# Architecture

## 1. System Architecture

```text
                         ┌─────────────────────┐
                         │       CLI           │
                         │  User Interaction  │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
             Normal Prompt                  ✨ Optimizer
                    │                               │
                    │                        Context Collector
                    │                               │
                    │                        Intent Analyzer
                    │                               │
                    │                     ┌─────────┴─────────┐
                    │                     │                   │
                    │                 Ambiguous          Clear enough
                    │                     │                   │
                    │                Clarification            │
                    │                     │                   │
                    │                     └─────────┬─────────┘
                    │                               ▼
                    │                         Optimized Task
                    │                               │
                    └───────────────────┬───────────┘
                                        ▼
                                  Agent Orchestrator
                                        │
                             ┌──────────┼──────────┐
                             ▼          ▼          ▼
                          Read/Edit   Search      Shell
                             │          │          │
                             └──────────┼──────────┘
                                        ▼
                                   Verification
                                        │
                              ┌─────────┴─────────┐
                              ▼                   ▼
                           Success              Failure
                              │                   │
                              │             Diagnose + Repair
                              │                   │
                              └──────────┬────────┘
                                         ▼
                                      Result
```

---

# 2. Recommended Project Structure

```text
coding-agent/
│
├── AGENTS.md
├── ROADMAP.md
├── ARCHITECTURE.md
├── DECISIONS.md
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
│
├── src/
│   │
│   ├── cli/
│   │   ├── index.ts
│   │   ├── input.ts
│   │   └── output.ts
│   │
│   ├── agent/
│   │   ├── agent.ts
│   │   ├── loop.ts
│   │   ├── state.ts
│   │   └── types.ts
│   │
│   ├── llm/
│   │   ├── provider.ts
│   │   ├── openai.ts
│   │   └── types.ts
│   │
│   ├── tools/
│   │   ├── registry.ts
│   │   ├── read-file.ts
│   │   ├── list-files.ts
│   │   ├── search-files.ts
│   │   ├── edit-file.ts
│   │   └── run-command.ts
│   │
│   ├── optimizer/
│   │   ├── optimizer.ts
│   │   ├── context.ts
│   │   ├── intent.ts
│   │   ├── clarification.ts
│   │   └── task.ts
│   │
│   ├── context/
│   │   ├── project.ts
│   │   ├── files.ts
│   │   └── relevance.ts
│   │
│   ├── verification/
│   │   ├── verifier.ts
│   │   ├── test-runner.ts
│   │   └── types.ts
│   │
│   └── safety/
│       ├── paths.ts
│       └── commands.ts
│
└── tests/
    ├── agent/
    ├── tools/
    ├── optimizer/
    └── verification/
```

This structure can change as implementation reveals better boundaries. Do not create empty abstractions just to match the diagram.

---

# 3. Dependency Direction

Keep dependencies flowing inward toward domain logic.

```text
CLI
 ↓
Agent / Optimizer
 ↓
Services
 ↓
Tools / LLM providers
```

Avoid having tool implementations directly control the agent loop.

The agent orchestrator should decide what tool to execute.

---

# 4. Core Interfaces

## Tool

```ts
interface Tool {
  name: string;
  description: string;
  inputSchema: unknown;

  execute(input: unknown): Promise<ToolResult>;
}
```

## LLM Provider

```ts
interface LLMProvider {
  generate(
    messages: Message[],
    tools?: ToolDefinition[]
  ): Promise<ModelResponse>;
}
```

## Optimized Task

```ts
interface OptimizedTask {
  intent: string;
  requirements: string[];
  constraints: string[];
  relevantFiles: string[];
  assumptions: string[];
  ambiguities: string[];
  acceptanceCriteria: string[];
}
```

## Agent Event

```ts
interface AgentEvent {
  runId: string;
  sequence: number;
  type: AgentEventType;
  timestamp: number;
  payload: unknown;
}
```

---

# 5. Agent State

Keep agent state explicit.

```text
AgentState

messages
currentTask
workspace
iteration
toolCalls
errors
status
```

Later:

```text
plan
verificationResults
trace
tokenUsage
cost
```

Avoid hiding important state inside random module-level variables.

---

# 6. Prompt Optimizer Architecture

```text
             User Prompt
                  │
                  ▼
          Context Collector
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
    Tree       Config      Relevant
                         source files
       │          │          │
       └──────────┼──────────┘
                  ▼
            Intent Analyzer
                  │
                  ▼
          Ambiguity Detector
             /          \
            /            \
       Ambiguous        Clear
          │               │
          ▼               │
     Questions             │
          │               │
          └───────┬───────┘
                  ▼
          Task Generator
                  │
                  ▼
          OptimizedTask
```

The optimizer should be independent from the coding agent.

---

# 7. Verification Architecture

```text
                 Agent
                   │
                   ▼
               Changes
                   │
                   ▼
             Verification
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
     Tests       Build        Lint
       │           │           │
       └───────────┼───────────┘
                   ▼
              Result
```

A failed verification should be available to the agent as structured feedback.

---

# 8. Safety Architecture

```text
                 Tool Request
                      │
                      ▼
                Input Validator
                      │
               ┌──────┴──────┐
               ▼             ▼
            Safe          Dangerous
               │             │
               ▼             ▼
            Execute       Confirmation
                             │
                       ┌─────┴─────┐
                       ▼           ▼
                     Allow       Reject
                       │
                       ▼
                    Execute
```

Never treat the LLM as a trusted authority.

---

# 9. Future Real-Time Architecture

When a web UI is added:

```text
Agent
 │
 ▼
Event Emitter
 │
 ├── Persistence
 │
 └── SSE
      │
      ▼
   Next.js
      │
      ▼
 Live Trace Viewer
```

The CLI remains useful even if the web UI is added later.

---

# 10. Local-First Service Strategy

## Prefer free/local

```text
Node.js             Free
TypeScript          Free
Git                 Free
ripgrep             Free
PostgreSQL local    Free
SSE                 Free
Docker              Free for local development
Ollama              Free for local model experimentation
```

## Paid only when needed

```text
LLM API             Main variable cost
Cloud database      Only when remote persistence is needed
Hosting             Only when a web dashboard is deployed
Redis               Only when queues/concurrency need it
Domain              Optional
```

Do not add paid infrastructure just to make the architecture look "production."

---

# 11. Cost-Conscious Development

The first MVP can run locally with very little infrastructure cost.

Use the available OpenAI credit carefully.

Prioritize:

```text
1. Agent loop
2. Tool calling
3. Prompt optimizer
4. Clarification
5. Verification
```

Avoid spending API credits on repeated cosmetic experiments.

Where possible:

- use small test inputs
- reuse/cached context
- limit agent iterations
- limit retries
- avoid sending entire repositories
- use local models for experimentation when practical

---

# 12. Future Evaluation Layer

The eventual architecture can add:

```text
Agent Run
    ↓
Trace
    ↓
Evaluation Engine
    ├── Deterministic evaluator
    └── LLM judge
    ↓
Score
    ↓
Failure analysis
```

This is intentionally outside the initial MVP.
