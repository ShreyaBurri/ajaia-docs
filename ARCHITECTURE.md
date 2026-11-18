# Ajaia Docs — Architecture and Tradeoffs

## Product slice

The priority was a complete document workflow: create → edit → save → reopen → share → access as another user. Rather than reproduce all of Google Docs, the app focuses on a reliable end-to-end experience within a timed assignment.

## Architecture

- **React + TipTap:** browser-based document list, editor, formatting controls, and sharing interface.
- **Express API:** document CRUD, sharing, user lookup, upload, and health endpoints.
- **SQLite:** durable document content, ownership, sharing permissions, and version numbers. SQLite was selected for quick setup and a small demonstration workload.
- **File import:** Multer accepts supported uploads; TXT/MD text is decoded and DOCX content is converted using Mammoth; HTML is sanitized before storage.
- **Production serving:** Express serves the built Vite frontend and `/api` routes from one origin.

## Sharing model

Three seeded users demonstrate access without requiring reviewers to register. An owner can manage sharing; an editor can update a shared document; a viewer has read-only access. The app distinguishes owned and shared documents. This is a **demo identity mechanism**, not secure authentication for real-world users.

## Concurrent edits

Each document has a version number. Save requests carry the version last read by the client. The backend updates only when that version is still current; otherwise it returns HTTP 409, allowing the UI to show a conflict instead of overwriting newer changes. This is optimistic concurrency control, **not** real-time collaborative editing.

## Validation and reliability

- Basic request validation and error responses
- HTML sanitization for editor content
- File type, size, and text-content validation
- Upload limit of 5 MB
- 17 backend automated tests passed, including permissions, upload security, and stale-save conflicts
- Manual live checks of seven core flows passed

## Deployment and persistence

The backend reads `PORT` from the environment and can use `DB_PATH` to select the SQLite database location. In hosting environments, SQLite requires a persistent mounted disk; ephemeral filesystems risk losing data. **[VERIFY DISK CONFIGURATION AND RESTART PERSISTENCE BEFORE SUBMISSION]**.

## Deliberately deprioritized

Real-time presence/cursors, comments, suggestions, full document version history, enterprise authentication, and broad file-format compatibility were not required for the core slice. These were deferred to preserve time for working editing, sharing, persistence, tests, and deployment.

## With another 2–4 hours

1. Add secure login/session handling and replace client-selected demo identity.
2. Add automated frontend interaction tests and deployment smoke tests.
3. Add a document version-history UI or presence indicators, depending on product priorities.
