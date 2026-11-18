# Ajaia Docs — AI Workflow Note

## Tools used

ChatGPT was used as a development assistant for implementation planning, code suggestions, debugging, test design, and deployment troubleshooting. VS Code, local terminal commands, Git/GitHub, and Render were used to implement, execute, verify, and ship the application.

## Where AI helped

AI accelerated breaking an ambiguous prompt into a scoped full-stack workflow, suggesting Express/React integration patterns, reasoning about owner/editor/viewer permissions, writing test cases for uploads and document version conflicts, and diagnosing a Render build failure when Vite was missing from the production install.

## Human judgment, changes, and tradeoffs

The implementation was kept intentionally smaller than Google Docs. Demo users were retained because the assignment explicitly permits mocked authentication. Version-conflict detection was selected instead of a real-time collaborative editing system. Deployment instructions were revised to explicitly install Vite's development dependencies during the build after the initial Render build failed.

AI suggestions were not treated as proof of correctness: code was run and checked in the local environment, and deployment changes were verified against actual build output. **[OPTIONAL: ADD A SPECIFIC EXAMPLE OF AN AI SUGGESTION YOU REJECTED OR MANUALLY REWROTE, IF APPLICABLE]**.

## Verification

- Ran backend automated tests: 17 passed
- Built the frontend for production
- Tested the production app locally
- Verified seven main flows on the deployed app: opening, creating, editing/saving, reopening, importing, sharing, and accessing as another demo user
- Diagnosed the failed initial Render build and verified a successful deployment after updating the build command

## Limits

AI-generated code and recommendations required manual verification. The seeded-user model is for demonstration, not secure public identity. Live deployment, persistence, and UX checks are separate from automated backend tests; neither substitutes for the other.
