# Ajaia Docs

A lightweight collaborative document editor built for the Ajaia LLC AI-Native Full Stack Developer assessment.

## Features

- Create, rename, edit, save, reopen, and delete documents
- Rich-text editing with bold, italic, underline, headings, and lists
- Import `.txt`, `.md`, and `.docx` files as editable documents (5 MB upload limit)
- Share documents with seeded demo users using owner, editor, and viewer permissions
- Distinguish owned and shared documents
- Store documents, formatting, and sharing data in SQLite
- Detect stale edits with document versions and return HTTP 409 instead of silently overwriting another save
- Validate uploads and sanitize stored rich-text HTML

## Stack

- Frontend: React, Vite, TipTap
- Backend: Node.js, Express
- Persistence: SQLite (`better-sqlite3`)
- Import: Multer, Mammoth (DOCX)
- Tests: Node.js built-in test runner

## Local setup

Prerequisites: recent Node.js and npm, with native module build support for `better-sqlite3` if required by your platform.

From the repository root, install dependencies:

```bash
cd backend && npm ci
cd ../frontend && npm ci
```

In terminal 1:

```bash
cd backend
npm start
```

In terminal 2:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to `http://localhost:5000` in development.

## Production build

```bash
npm ci --prefix frontend --include=dev
npm run build --prefix frontend
npm ci --prefix backend
```

Run the backend with `NODE_ENV=production`; Express serves the built frontend from `frontend/dist`. The host must supply `PORT` when required.

For persistent storage, set `DB_PATH` to a writable location on a **persistent disk**, for example `/var/data/ajaia.db`. A temporary filesystem does not guarantee document survival across redeploys or restarts.

## Test

```bash
cd backend
npm test
```

17 backend tests passed during local verification. Tests cover core document operations, permissions, sanitization, upload restrictions, and version conflicts.

## Demo accounts and sharing

The application seeds three demonstration users: Demo User (ID 1), Alex (ID 2), and Taylor (ID 3). Switch users in the app to demonstrate owner/editor/viewer access. This is **mock authentication**, not a secure production identity system. Do not upload confidential information.

## Deployment

Live URL: **https://ajaia-docs-luzs.onrender.com/**

Repository: https://github.com/ShreyaBurri/ajaia-docs

The live app was manually checked for loading, document creation/editing, saving and reopening, file import, and sharing. **[CONFIRM PERSISTENCE AFTER SERVICE RESTART]**.

## Scope and limitations

- No live cursor presence or real-time co-editing; stale saves are detected through version checks.
- Seeded demo users rather than password-based login.
- Imports limited to TXT, MD, DOCX; not a full Google Docs-compatible importer.
- No advanced comments, suggestions, or document history UI.

See `ARCHITECTURE.md`, `AI_WORKFLOW.md`, and `SUBMISSION.md` for engineering decisions and submission details.
