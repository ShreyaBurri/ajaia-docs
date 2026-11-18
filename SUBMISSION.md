# Ajaia Docs — Submission Inventory

Candidate: Shreya Burri
Assignment: Ajaia LLC — AI-Native Full Stack Developer

## Links

- **Live product:** https://ajaia-docs-luzs.onrender.com/
- **Source repository:** https://github.com/ShreyaBurri/ajaia-docs
- **Walkthrough video (3–5 minutes):** [INSERT PUBLIC/UNLISTED VIDEO URL]
- **Google Drive submission folder:** [INSERT SHAREABLE DRIVE FOLDER URL]

## Included materials

- `backend/` — Express API, SQLite persistence, tests
- `frontend/` — React/TipTap document editor
- `README.md` — features, prerequisites, local setup, build, testing, demo users, limitations
- `ARCHITECTURE.md` — architecture, priorities, tradeoffs, and next steps
- `AI_WORKFLOW.md` — AI tooling, impact, decisions, verification
- `SUBMISSION.md` — this inventory
- `video-link.txt` — walkthrough video URL
- `screenshots/` — [ADD IF NEEDED; OTHERWISE REMOVE THIS LINE]

## Working functionality

Document creation, renaming, rich-text editing, saving/reopening, TXT/MD/DOCX import, seeded-user sharing, owner/editor/viewer permissions, SQLite storage, upload validation, and version-conflict detection. 17 backend tests and seven live user-flow checks passed.

## Known limitations

- Demo identity selection is not real authentication; use test content only.
- Simultaneous saves detect conflicts; editing is not synchronized in real time.
- No comments, suggestion mode, or full history UI.
- **[CONFIRM SQLITE PERSISTENCE AFTER RESTART]**.

## Reviewer instructions

Open the live URL. Create a document as Demo User, enter formatted content, and save. Share it with Alex as editor or viewer. Switch to Alex and confirm the corresponding access. Try a TXT/MD/DOCX import. For local setup, follow `README.md`.

## If given another 2–4 hours

Implement secure user sessions, automated browser tests, and a small version-history or collaboration indicator feature.
