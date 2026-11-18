# Ajaia Docs — Suggested 3–5 Minute Walkthrough

**0:00–0:30 — Introduction.** “I built Ajaia Docs, a lightweight collaborative document editor, for the Ajaia full-stack assessment. I focused on a complete editing and sharing workflow instead of trying to reproduce every Google Docs feature.”

**0:30–1:45 — Main user flow.** Open the live URL. Create a document, rename it, add formatted text (bold, italic, heading, list), save, refresh, and reopen it. Upload a TXT or DOCX file and show the imported editable document.

**1:45–2:40 — Sharing.** Share a document with Alex, choose viewer or editor access, switch to Alex, and show how the document appears and what actions are allowed. Explain that seeded users were chosen because mocked authentication is permitted by the assignment.

**2:40–3:20 — Engineering decisions.** Briefly describe React/TipTap, Express, SQLite, HTML sanitization, 5 MB upload limit, and version checking to prevent silent overwrite. Mention 17 passing automated backend tests.

**3:20–4:10 — Scope and tradeoffs.** Explain that real-time collaboration, comments, full history, and real authentication were intentionally deferred. Mention that the deployed app is a demonstration and should not hold sensitive data.

**4:10–4:45 — AI workflow and close.** Explain how ChatGPT helped with planning, implementation suggestions, testing, and Render troubleshooting. State that you verified generated suggestions with tests, a production build, and live browser checks. Show the repository and point reviewers to README, architecture, and AI notes.

**Before recording:** Replace all placeholders in submission files and verify the live URL, reviewer access, and persistence after a restart.
