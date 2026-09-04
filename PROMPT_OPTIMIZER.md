# Prompt Optimizer Specification

## Purpose

The Prompt Optimizer converts vague natural-language developer requests into clear, project-aware implementation tasks.

It is not merely a prompt rewriter.

It performs:

```text
Intent extraction
+
Project understanding
+
Ambiguity detection
+
Clarification
+
Task generation
```

---

## Input

```text
Original user request
Project structure
Project metadata
Relevant source files
```

---

## Output

```text
Intent
Requirements
Constraints
Relevant files
Assumptions
Ambiguities
Acceptance criteria
```

---

## Example

### User

```text
make the login better
```

### Context

```text
React
TypeScript
Existing authentication API
Existing Login component
Existing CSS
```

### Optimizer

```text
Intent:
Improve the existing login user experience.

Known project context:
- Login UI exists in src/components/Login.tsx
- Authentication logic already exists
- Project uses existing CSS conventions

Ambiguity:
"better" could mean visual design, UX, accessibility,
performance, or functionality.

Question:
What should be improved?

1. Visual design
2. UX/loading/errors
3. Accessibility
4. Performance
5. All of the above
```

---

## Rules

### Preserve intent

Do not turn:

```text
"fix the login button"
```

into:

```text
"redesign the authentication system"
```

---

### Do not invent requirements

If the user did not request something and the repository does not strongly imply it, do not add it as a requirement.

Use:

```text
Assumption:
The existing authentication flow should remain unchanged.
```

instead of silently treating an assumption as a requirement.

---

### Ask questions only when useful

Bad:

```text
What font?
What color?
What exact padding?
What breakpoint?
What button radius?
```

Good:

```text
Do you want to focus on visual design,
functionality, or both?
```

Questions should resolve decisions that materially affect implementation.

---

## Prompt Optimization Goal

The optimized task should be:

```text
shorter than unnecessary conversational input
+
richer in relevant project context
+
more explicit about requirements
+
honest about uncertainty
```

Token reduction is a secondary goal.

Correctness and clarity are more important.

---

## Preview

Before execution:

```text
✨ Optimized Task

Intent:
Improve the login experience.

Relevant files:
- src/components/Login.tsx
- src/api/auth.ts

Requirements:
- Add loading state.
- Improve error handling.
- Preserve authentication logic.

Acceptance criteria:
- Loading state appears during requests.
- Authentication failures are visible.
- Existing tests pass.

[Execute] [Edit] [Cancel]
```
