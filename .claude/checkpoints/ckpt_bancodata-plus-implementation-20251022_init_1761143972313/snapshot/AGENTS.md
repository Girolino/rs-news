# GPT-5 Codex Agent Handbook

Reference guide for orchestrating GPT-5 Codex inside the Codex CLI. Treat this as the single source of truth for agent behaviour on this project.

## 1. Prompting Principles
- State the goal, target files, constraints, and success criteria. Skip motivational preambles.
- Ask for outcomes, not narration (e.g. “Add input validation in `src/foo.ts`”). The model decides how much reasoning to expose.
- Put hard constraints up front: language choice, dependency policy, performance budgets, deadlines, etc.
- Invoke **ULTRATHINK** only when deeper reflection is needed. Phrase it explicitly: “Apply ULTRATHINK to compare X vs Y…”.
- Update the conversation context as soon as new information appears (new files, blockers, changed requirements).

## 2. Tools & Commands
- `shell`: always pass `["bash", "-lc", "<command>"]` with `workdir` set. Prefer `rg`/`rg --files` for searches.
- `apply_patch`: use for small, deliberate edits. Avoid mixing it with generated files or bulk replacements.
- Plan tool: reserve for non-trivial work; never create a single-step plan.
- Environments frequently run with `approval_policy == never`. Resolve issues locally—do not request elevated access.

## 3. Recommended Workflow
1. **Documentation Check**: before doing anything else, inspect `docs/llm-guide/` for a relevant guide and scan `docs/libs/` for library-specific notes. Incorporate the guidance or note por que não se aplica.
2. **Intake**: confirm objective, constraints, affected code, and expected deliverables with the user.
3. **Planning (optional)**: if the task requires multiple moves, jot down a 2–6 step plan and keep it current.
4. **Incremental Execution**: implement in small batches; run targeted commands after each meaningful change.
5. **Validation**: execute the necessary checks (build, lint, tests) and capture key outputs in the response.
6. **Documentation Loop**: if the work produced new knowledge or changed behaviour, update the corresponding guide in `docs/llm-guide/`. If no suitable guide exists, create one or log a TODO for follow-up.
7. **Handoff**: summarise edits, reference files with `path:line`, mention validation results, and propose logical next steps when appropriate.

## 4. TypeScript Quality Checklist
1. Run `npx tsc --noEmit` after meaningful changes.
2. Execute the relevant tests (`npm test`, unit files, Playwright, etc.) when behaviour could regress.
3. Confirm code style or linting only if the task or repository guidelines require it.
4. Do not ship until compilation and any required tests pass, or clearly state why a failure remains.

## 5. Capabilities & Limits
- When you need specialised analysis (backend, frontend, infra), describe the requirement explicitly in the prompt; the model adapts its reasoning accordingly.
- Escalate assumptions back to the user when domain knowledge is missing instead of fabricating details.

## 6. Codex CLI Conventions
- Work happens through the terminal and `apply_patch`; there is no IDE loop.
- Final responses start with a concise explanation of the changes, cite touched files with `path:line`, and include validation status.
- Never paste gigantic file contents; point to file paths instead.
- Do not revert user modifications unless explicitly instructed.
- Default to ASCII unless the existing file already uses other characters.

## 7. Communication Guidelines
- Keep the tone concise, collaborative, and factual.
- Report notable commands run and summarise their outcomes; omit noisy logs.
- When blocked, explain the issue and suggest viable alternatives.
- Record TODOs, risks, or follow-up items clearly so they are easy to action.

## 8. Documentation & Logs
- Treat every file in `docs/llm-guide/` as living documentation: consult a relevant guide before you start, update it when behaviour or process changes, and reference it in your responses when it informs the work.
- Store research notes and one-off findings close to their subject matter (for example, inside `docs/llm-guide/` or another folder agreed with the team) so future runs can locate them quickly.

---
**Essence**: clear objectives, up-to-date context, small execution slices, rigorous validation, and documentation that evolves with the codebase.
