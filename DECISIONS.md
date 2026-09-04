# Architecture Decisions

This file records important decisions so future development does not repeatedly reconsider the same questions.

## ADR-001 — Local-first

**Decision:** Build the coding agent as a local CLI first.

**Reason:** The agent needs access to the developer's repository and local development commands. A local-first architecture also minimizes hosting cost and complexity.

---

## ADR-002 — TypeScript

**Decision:** Use TypeScript.

**Reason:** The project is tool-heavy and benefits from strong schemas for tool inputs, agent state, provider responses, and optimized tasks.

---

## ADR-003 — One agent before multi-agent

**Decision:** Start with one coding agent.

**Reason:** The goal is to learn the fundamental agent loop before adding multi-agent orchestration.

---

## ADR-004 — Prompt optimization as the differentiator

**Decision:** The first unique feature is a project-aware prompt optimizer.

**Reason:** Many users can describe intent poorly. The optimizer converts vague intent into a clearer implementation task and asks focused clarification questions when needed.

---

## ADR-005 — No vector database initially

**Decision:** Do not use a vector database in V1/V2.

**Reason:** Basic project tree inspection, ripgrep search, and targeted file reads are sufficient for the initial coding-agent context strategy.

---

## ADR-006 — SSE for future live UI

**Decision:** Prefer Server-Sent Events for a future real-time dashboard.

**Reason:** Agent execution is primarily server-to-client streaming. SSE is simpler than WebSockets for this use case.

---

## ADR-007 — Deterministic verification first

**Decision:** Prefer tests, builds, compiler checks, and other deterministic checks before LLM judging.

**Reason:** Deterministic checks provide stronger evidence of whether a coding task succeeded.

---

## ADR-008 — LLM provider abstraction

**Decision:** Keep model-provider-specific code behind an interface.

**Reason:** The project should eventually be able to experiment with different models without rewriting the agent orchestration layer.

---

## ADR-009 — No premature infrastructure

**Decision:** Avoid Redis, Kafka, Kubernetes, microservices, and managed cloud services until the product requires them.

**Reason:** Infrastructure complexity does not teach the core agent problem during the early phases.

---

## ADR-010 — Agent must not blindly trust model-generated paths or commands

**Decision:** Validate filesystem paths and shell commands before execution.

**Reason:** The coding agent can perform real actions on a developer's machine, so tool boundaries are a core safety requirement.
