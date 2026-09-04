# AGENTS.md — Coding CLI Agent

## 1. Mission

Build a local-first coding CLI agent that can understand a user's natural-language request, inspect a codebase, modify files, execute safe development commands, run tests, and report the result.

The project's differentiating feature is **Prompt Optimization + Intent Clarification**.

The agent should help users who are vague, inexperienced, or "vibe coding" by converting an ambiguous request into a clear, project-aware implementation task before execution.

### North Star

```text
User
  ↓
Natural-language intent
  ↓
Optional ✨ Prompt Optimization
  ↓
Project Context
  ↓
Intent Analysis
  ↓
Clarification when necessary
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

Do not turn the project into a general-purpose AI assistant. The current scope is a **coding CLI agent**.

---

## 2. Current Development Strategy

Build incrementally.

### V1
Reliable basic coding agent.

### V2
Prompt optimizer and clarification workflow.

### V3
Better codebase understanding, planning, approval, Git awareness, and failure recovery.

### V4
Execution tracing and observability.

### V5
Evaluation and benchmarking.

Do not implement later phases prematurely.

---

## 3. Product Principles

1. **Local-first**
   - The agent primarily operates on the user's local project.
   - Avoid unnecessary cloud services.

2. **Simple before sophisticated**
   - Prefer simple Node.js/TypeScript implementations before queues, vector databases, microservices, or distributed infrastructure.

3. **Evidence before assumptions**
   - The agent should inspect the repository before making claims about the codebase.

4. **User intent before execution**
   - A vague request should be clarified or converted into an explicit task.

5. **Minimal changes**
   - Modify only files necessary for the requested task whenever possible.

6. **Verification**
   - Do not claim success without appropriate verification.

7. **Safety**
   - Shell commands and destructive operations must have boundaries and approval mechanisms.

8. **Provider independence**
   - Keep the LLM provider behind an interface so the agent can eventually support multiple providers.

---

## 4. Technology Direction

Preferred stack:

- Node.js
- TypeScript
- CLI application
- OpenAI API initially
- PostgreSQL only when persistence becomes necessary
- SSE for future real-time UI if/when a web dashboard is added
- ripgrep (`rg`) for local code search
- Git CLI for version-control operations

Avoid introducing a dependency or paid service unless it solves a demonstrated problem.

---

## 5. LLM Provider Abstraction

Do not scatter provider-specific API calls throughout the agent.

Use an abstraction similar to:

```ts
interface LLMProvider {
  generate(
    messages: Message[],
    tools?: Tool[]
  ): Promise<ModelResponse>;
}
```

Possible implementations:

```text
LLMProvider
├── OpenAIProvider
├── AnthropicProvider
└── LocalProvider
```

Only implement the provider actually required by the current phase.

---

## 6. Agent Loop

The core agent loop should follow:

```text
Receive user task
      ↓
Build context
      ↓
Ask LLM what to do
      ↓
If tool call:
    validate tool call
    execute tool
    return result to LLM
      ↓
Repeat
      ↓
Final response
```

The loop must have:

- maximum iteration/step protection
- tool validation
- useful error messages
- cancellation/exit handling
- clear final state

Do not create an uncontrolled infinite loop.

---

## 7. Initial Tools

Implement tools incrementally.

### Required V1 tools

```text
read_file
list_files
search_files
edit_file
run_command
```

### Tool expectations

#### `read_file`
Read a file within the project scope.

#### `list_files`
Inspect project directories while respecting ignored directories/files.

#### `search_files`
Search source code efficiently. Prefer ripgrep when available.

#### `edit_file`
Make targeted modifications.

Prefer a safe structured edit such as:

```ts
edit_file({
  path,
  oldText,
  newText
})
```

over rewriting entire files.

#### `run_command`
Execute development commands with safety checks.

---

## 8. Project Boundary

The agent must operate within the selected project/workspace.

Before implementing filesystem tools:

- resolve paths
- prevent path traversal outside the workspace
- respect project boundaries
- handle missing files
- handle binary files appropriately

Never blindly trust a path returned by the model.

---

## 9. Shell Safety

Never execute arbitrary model-generated shell commands without validation.

At minimum:

```text
Model command
   ↓
Command validator
   ↓
Allowed?
 ┌─┴──────┐
Yes       No
 ↓         ↓
Execute   Ask user / reject
```

Potentially dangerous operations include:

- deleting files
- destructive Git commands
- changing system configuration
- accessing secrets
- privilege escalation
- commands outside the project

The exact policy should evolve as the project matures.

---

# 10. Prompt Optimizer

This is the main differentiating feature.

Users can write vague prompts such as:

```text
make the login better
```

The optimizer should analyze:

```text
User prompt
+
Project structure
+
package.json
+
README
+
Relevant files
+
Existing conventions
```

Then produce an explicit implementation task.

Example:

```text
Original:
"make the login better"

Optimized:

Improve the existing login experience.

Requirements:
- Add loading state during authentication.
- Display actionable authentication errors.
- Improve visual hierarchy.
- Preserve existing authentication logic.
- Follow the existing project's styling conventions.

Likely relevant files:
- src/components/Login.tsx
- src/api/auth.ts

Do not:
- introduce a new UI library
- rewrite authentication architecture
```

The optimizer must not invent requirements as facts.

It should distinguish:

```text
Known from project
Inferred
Assumed
Needs clarification
```

---

## 11. Clarification System

If a request is ambiguous, ask focused questions instead of guessing.

Example:

```text
User:
"make the dashboard better"

Agent:
I found an existing dashboard with charts and statistic cards.

What do you want to improve?

1. Visual design
2. Responsive behavior
3. Performance
4. Functionality
5. All of the above
```

Questions should:

- be few
- be easy to answer
- resolve meaningful ambiguity
- avoid asking about things the repository already makes clear

After the user answers, regenerate the optimized task.

---

## 12. Optimized Task Format

Internally, represent the optimized task as structured data where practical.

Example:

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

This structure is preferred over passing an unstructured paragraph between components.

---

## 13. Prompt Optimization Rules

The optimizer should:

1. Preserve the user's actual intent.
2. Remove conversational noise.
3. Add relevant project context.
4. Identify ambiguity.
5. Ask clarification when ambiguity materially affects implementation.
6. Avoid inventing requirements.
7. Preserve existing architecture unless the user asks for architectural change.
8. Prefer the smallest reasonable scope.
9. Produce explicit acceptance criteria.
10. Show the user what will be executed before major changes.

The optimizer is not simply a "prompt beautifier."

It is an **intent-to-implementation translator**.

---

## 14. Normal Mode vs Optimize Mode

Both modes must ultimately use the same coding agent.

```text
Normal Mode
User Prompt
   ↓
Coding Agent

Optimize Mode
User Prompt
   ↓
Prompt Optimizer
   ↓
Clarification if needed
   ↓
Optimized Task
   ↓
Coding Agent
```

This prevents duplicate agent implementations.

---

## 15. Prompt Preview

Before executing an optimized task, show the user:

```text
✨ Optimized Task

Intent:
Improve dashboard UI and responsiveness.

Likely files:
- Dashboard.tsx
- StatsCard.tsx

Changes:
- improve visual hierarchy
- fix mobile layout
- preserve functionality

[Execute] [Edit] [Cancel]
```

The preview should be concise.

---

## 16. Codebase Context Strategy

Do not send the entire repository to the LLM.

Start with:

```text
Project tree
+
package.json
+
README
+
configuration
+
targeted search results
+
relevant file contents
```

Use progressive retrieval:

```text
User request
    ↓
Search repository
    ↓
Identify relevant files
    ↓
Read relevant sections
    ↓
Build context
    ↓
LLM
```

Do not introduce a vector database until there is a demonstrated need for semantic retrieval.

---

## 17. Planning

Planning is a V3 feature.

A plan should look like:

```text
PLAN

1. Inspect existing authentication flow.
2. Add reset-token generation.
3. Add reset endpoint.
4. Add email delivery.
5. Add frontend reset form.
6. Add validation and expiration handling.
7. Add tests.
```

The agent should avoid creating plans for trivial tasks when planning adds unnecessary overhead.

---

## 18. Verification

The agent should verify its changes.

Typical verification:

```text
edit
 ↓
run relevant tests
 ↓
inspect failure
 ↓
repair
 ↓
run tests again
 ↓
report
```

For applicable projects, consider:

```text
npm test
npm run build
npm run lint
tsc
```

Do not blindly run every command for every task. Choose relevant checks based on the project.

---

## 19. Failure Recovery

If a test fails:

```text
Test failure
    ↓
Read error
    ↓
Identify likely cause
    ↓
Modify code
    ↓
Run verification again
```

Limit retries.

If the agent cannot recover, it should clearly report:

- what failed
- what it tried
- current state
- relevant errors
- what the user should do next

Never pretend a failed task succeeded.

---

## 20. Git Awareness

Git features are V3+.

Potential tools:

```text
git_status
git_diff
git_log
```

Later:

```text
/create-commit
```

Before destructive Git operations, require confirmation.

---

## 21. Tracing

Tracing is V4.

Capture normalized events such as:

```text
agent_started
model_request
model_response
tool_called
tool_finished
error
verification_started
verification_finished
agent_finished
```

Every event should have:

```ts
{
  runId: string;
  sequence: number;
  type: string;
  timestamp: number;
  payload: unknown;
}
```

Tracing should make the agent's behavior inspectable.

---

## 22. Future Evaluation

Evaluation is V5.

Do not build it into the initial MVP.

Eventually evaluate:

```text
Task success
Correctness
Tool efficiency
Execution time
Token usage
Estimated cost
Error recovery
Requirement satisfaction
```

Prefer deterministic evaluation when possible.

Use LLM-as-a-judge for qualitative criteria.

---

# 23. CLI UX

The CLI should feel like a developer tool.

Example:

```text
╭─────────────────────────────────────────╮
│              Coding Agent               │
╰─────────────────────────────────────────╯

Project: my-app
Model: configured-model

> fix the login bug

● Inspecting project
● Searching authentication code
● Reading auth.ts
● Editing auth.ts
● Running tests

✓ 24 tests passed

Done.
```

For optimization:

```text
> make the login better   ✨ Optimize
```

Keep the interaction fast and readable.

---

# 24. Configuration

Use environment variables for secrets.

Example:

```text
OPENAI_API_KEY
MODEL
WORKSPACE
```

Never commit API keys.

Provide a `.env.example`.

---

# 25. Development Rules for the AI Agent

When modifying this repository:

1. Inspect existing code before changing it.
2. Understand the current architecture.
3. Prefer small changes.
4. Reuse existing utilities.
5. Do not introduce unnecessary dependencies.
6. Do not rewrite working code without a reason.
7. Run relevant tests after changes.
8. Report failures honestly.
9. Keep TypeScript types strong.
10. Update documentation when behavior or architecture changes.
11. Do not implement future phases unless explicitly requested.
12. When a requirement is ambiguous, ask rather than inventing behavior.
13. Keep provider-specific code isolated.
14. Keep tool implementations isolated from the agent loop.
15. Keep optimization logic isolated from the coding agent.

---

# 26. Definition of Done

A feature is complete only when:

```text
Implementation
     ↓
Type checking
     ↓
Relevant tests
     ↓
Manual smoke test
     ↓
Documentation if needed
     ↓
Done
```

For agent features, also verify failure cases.

Example:

```text
valid input       → works
invalid input     → handled
tool failure      → handled
LLM failure       → handled
user cancellation → handled
```

---

# 27. What NOT To Build Yet

Until the current phase requires them, avoid:

- microservices
- Kubernetes
- Kafka
- vector databases
- complex RAG
- multi-agent orchestration
- hosted infrastructure
- elaborate authentication
- billing
- mobile apps
- unrelated AI features
- browser automation
- image generation

The project should become sophisticated through **agent behavior**, not infrastructure complexity.

---

# 28. Current Priority

Always check `ROADMAP.md` before starting work.

Implement the **first incomplete phase** unless the user explicitly asks to jump ahead.

The current intended progression is:

```text
V1 → Basic Coding Agent
V2 → Prompt Optimization + Clarification
V3 → Codebase Understanding + Planning + Safety + Recovery
V4 → Tracing
V5 → Evaluation
```

Do not skip the fundamentals.

---

# 29. Success Criteria

The project succeeds when a user can enter a vague request such as:

```text
"make the login better"
```

press:

```text
✨ Optimize
```

and receive a project-aware task that:

- understands the likely intent
- identifies relevant code
- points out ambiguity
- asks useful questions when needed
- produces clear requirements
- minimizes unnecessary context
- lets the user approve the task
- sends the clarified task to the coding agent
- makes the necessary changes
- runs appropriate verification
- reports the result honestly
