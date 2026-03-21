# Commenting Standard

## Scope
- Applies to all hand-written source files in `app/backend/src`, `app/frontend/src`, and `miniprogram`.
- Excludes generated code, third-party dependencies, build artifacts, and snapshot-like outputs.

## Objectives
- Explain intent, invariants, side effects, and cross-module contracts.
- Reduce onboarding cost without restating obvious syntax.
- Keep comments stable under refactors and accurate under operational change.

## File-Level Comments
- Every hand-written source file should start with a short header comment.
- The header should identify the layer and the file's primary responsibility.
- The header should not duplicate implementation details that are likely to drift.

## API and Public Method Comments
- Public methods should document:
- What the method guarantees.
- Important inputs or preconditions.
- External side effects such as database writes, remote calls, logging, or auth checks.
- Error boundaries when failure semantics are not obvious from the signature.

## Inline Comments
- Use inline comments sparingly and only for:
- Non-obvious branches.
- Data integrity assumptions.
- Security-sensitive logic.
- Cross-system compatibility behavior.

## What To Avoid
- Do not narrate trivial assignments or framework boilerplate.
- Do not leave stale comments after behavior changes.
- Do not comment generated files unless the generation pipeline is updated as well.
- Do not use comments to hide unclear code that should instead be simplified.

## Style
- Prefer concise, declarative language.
- Write comments from the perspective of maintainers and reviewers.
- Use exact domain terms already used by the project.
- Update comments in the same change set as the code behavior they describe.
