const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Create a temporary database before importing the app.
const testDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "ajaia-docs-test-")
);

process.env.DB_PATH = path.join(testDirectory, "test.db");

const app = require("../server");
const db = require("../database");

let server;
let baseUrl;

// --------------------------------------------------
// HTTP REQUEST HELPERS
// --------------------------------------------------

async function request(endpoint, options = {}) {
  const {
    method = "GET",
    userId = 1,
    body
  } = options;

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      "x-user-id": String(userId),
      ...(body !== undefined
        ? { "Content-Type": "application/json" }
        : {})
    },
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {})
  });

  return {
    status: response.status,
    data: await response.json()
  };
}

async function uploadFiles(files, userId = 1) {
  const form = new FormData();

  for (const {
    name,
    content,
    type = "application/octet-stream"
  } of files) {
    form.append(
      "file",
      new Blob([content], { type }),
      name
    );
  }

  const response = await fetch(
    `${baseUrl}/api/documents/upload`,
    {
      method: "POST",
      headers: {
        "x-user-id": String(userId)
      },
      body: form
    }
  );

  return {
    status: response.status,
    data: await response.json()
  };
}

// --------------------------------------------------
// TEST SERVER SETUP AND CLEANUP
// --------------------------------------------------

before(async () => {
  server = app.listen(0);

  await new Promise((resolve) => {
    if (server.listening) {
      resolve();
    } else {
      server.once("listening", resolve);
    }
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  db.close();

  fs.rmSync(testDirectory, {
    recursive: true,
    force: true
  });
});

// --------------------------------------------------
// TEST 1: BACKEND HEALTH
// --------------------------------------------------

test("Health endpoint works", async () => {
  const response = await request("/api/health");

  assert.equal(response.status, 200);
  assert.equal(response.data.status, "success");
});

// --------------------------------------------------
// TEST 2: DOCUMENT CREATION
// --------------------------------------------------

test("Owner can create a document", async () => {
  const response = await request("/api/documents", {
    method: "POST",
    userId: 1,
    body: {
      title: "Automated Test Document"
    }
  });

  assert.equal(response.status, 201);
  assert.equal(
    response.data.title,
    "Automated Test Document"
  );
  assert.equal(response.data.access, "owner");
  assert.equal(response.data.version, 1);
});

// --------------------------------------------------
// TEST 3: VIEWER PERMISSIONS
// --------------------------------------------------

test("Viewer can read but cannot edit", async () => {
  const created = await request("/api/documents", {
    method: "POST",
    userId: 1,
    body: {
      title: "Viewer Permission Test"
    }
  });

  assert.equal(created.status, 201);

  const documentId = created.data.id;

  // User 2 cannot access before sharing.
  const beforeSharing = await request(
    `/api/documents/${documentId}`,
    { userId: 2 }
  );

  assert.equal(beforeSharing.status, 404);

  // Owner shares with User 2 as Viewer.
  const shared = await request(
    `/api/documents/${documentId}/share`,
    {
      method: "POST",
      userId: 1,
      body: {
        userId: 2,
        permission: "viewer"
      }
    }
  );

  assert.equal(shared.status, 200);

  // Viewer can read.
  const viewerRead = await request(
    `/api/documents/${documentId}`,
    { userId: 2 }
  );

  assert.equal(viewerRead.status, 200);
  assert.equal(viewerRead.data.access, "viewer");
  assert.equal(
    viewerRead.data.version,
    created.data.version
  );

  // Viewer cannot edit.
  const viewerEdit = await request(
    `/api/documents/${documentId}`,
    {
      method: "PUT",
      userId: 2,
      body: {
        title: "Unauthorized Change",
        content: "<p>Changed</p>",
        version: viewerRead.data.version
      }
    }
  );

  assert.equal(viewerEdit.status, 403);

  // Viewer cannot delete.
  const viewerDelete = await request(
    `/api/documents/${documentId}`,
    {
      method: "DELETE",
      userId: 2
    }
  );

  assert.equal(viewerDelete.status, 404);

  // Viewer cannot share.
  const viewerShare = await request(
    `/api/documents/${documentId}/share`,
    {
      method: "POST",
      userId: 2,
      body: {
        userId: 3,
        permission: "editor"
      }
    }
  );

  assert.equal(viewerShare.status, 403);
});

// --------------------------------------------------
// TEST 4: EDITOR PERMISSIONS
// --------------------------------------------------

test("Editor can save but cannot delete or share", async () => {
  const created = await request("/api/documents", {
    method: "POST",
    userId: 1,
    body: {
      title: "Editor Permission Test"
    }
  });

  assert.equal(created.status, 201);

  const documentId = created.data.id;

  const shared = await request(
    `/api/documents/${documentId}/share`,
    {
      method: "POST",
      userId: 1,
      body: {
        userId: 2,
        permission: "editor"
      }
    }
  );

  assert.equal(shared.status, 200);

  const updated = await request(
    `/api/documents/${documentId}`,
    {
      method: "PUT",
      userId: 2,
      body: {
        title: "Updated by Editor",
        content: "<p>Editor changes</p>",
        version: created.data.version
      }
    }
  );

  assert.equal(updated.status, 200);
  assert.equal(
    updated.data.title,
    "Updated by Editor"
  );
  assert.equal(
    updated.data.version,
    created.data.version + 1
  );

  // Editor cannot delete.
  const deleted = await request(
    `/api/documents/${documentId}`,
    {
      method: "DELETE",
      userId: 2
    }
  );

  assert.equal(deleted.status, 404);

  // Editor cannot share.
  const sharedAgain = await request(
    `/api/documents/${documentId}/share`,
    {
      method: "POST",
      userId: 2,
      body: {
        userId: 3,
        permission: "viewer"
      }
    }
  );

  assert.equal(sharedAgain.status, 403);
});

// --------------------------------------------------
// TEST 5: OWNER DELETION
// --------------------------------------------------

test("Owner can delete a document", async () => {
  const created = await request("/api/documents", {
    method: "POST",
    userId: 1,
    body: {
      title: "Delete Test"
    }
  });

  assert.equal(created.status, 201);

  const documentId = created.data.id;

  const deleted = await request(
    `/api/documents/${documentId}`,
    {
      method: "DELETE",
      userId: 1
    }
  );

  assert.equal(deleted.status, 200);

  const readAgain = await request(
    `/api/documents/${documentId}`,
    { userId: 1 }
  );

  assert.equal(readAgain.status, 404);
});

// --------------------------------------------------
// TEST 6: INVALID DOCUMENT DATA
// --------------------------------------------------

test("Invalid document title is rejected", async () => {
  const created = await request("/api/documents", {
    method: "POST",
    body: {
      title: "Validation Test"
    }
  });

  assert.equal(created.status, 201);

  const response = await request(
    `/api/documents/${created.data.id}`,
    {
      method: "PUT",
      body: {
        title: "",
        content: "<p>Test</p>",
        version: created.data.version
      }
    }
  );

  assert.equal(response.status, 400);
});

// --------------------------------------------------
// TEST 7: HTML SANITIZATION
// --------------------------------------------------

test("Unsafe HTML is sanitized", async () => {
  const created = await request("/api/documents", {
    method: "POST",
    body: {
      title: "Security Test"
    }
  });

  assert.equal(created.status, 201);

  const response = await request(
    `/api/documents/${created.data.id}`,
    {
      method: "PUT",
      body: {
        title: "Security Test",
        content:
          '<p>Hello</p><script>alert("XSS")</script>',
        version: created.data.version
      }
    }
  );

  assert.equal(response.status, 200);
  assert.ok(
    !response.data.content.includes("<script>")
  );
  assert.equal(
    response.data.version,
    created.data.version + 1
  );
});

// --------------------------------------------------
// TEST 8: TXT UPLOAD
// --------------------------------------------------

test("TXT file upload works", async () => {
  const response = await uploadFiles([
    {
      name: "test-upload.txt",
      content: "Hello from automated testing",
      type: "text/plain"
    }
  ]);

  assert.equal(response.status, 201);
  assert.equal(response.data.title, "test-upload");
  assert.ok(response.data.content.includes("Hello"));
  assert.equal(response.data.version, 1);
});

// --------------------------------------------------
// TEST 9: UNSUPPORTED FILE UPLOAD
// --------------------------------------------------

test("PDF upload is rejected", async () => {
  const response = await uploadFiles([
    {
      name: "test.pdf",
      content: "Fake PDF",
      type: "application/pdf"
    }
  ]);

  assert.equal(response.status, 400);
});

// --------------------------------------------------
// TEST 10: INVALID USER
// --------------------------------------------------

test("Unknown demo user is rejected", async () => {
  const response = await request("/api/documents", {
    userId: 999999
  });

  assert.equal(response.status, 401);
});

// --------------------------------------------------
// TEST 11: DOCUMENT VERSION CONFLICT
// --------------------------------------------------

test(
  "Outdated document version cannot overwrite changes",
  async () => {
    const created = await request("/api/documents", {
      method: "POST",
      userId: 1,
      body: {
        title: "Version Conflict Test"
      }
    });

    assert.equal(created.status, 201);

    const documentId = created.data.id;
    const originalVersion = created.data.version;

    assert.equal(originalVersion, 1);

    // First save succeeds.
    const firstSave = await request(
      `/api/documents/${documentId}`,
      {
        method: "PUT",
        userId: 1,
        body: {
          title: "First Save",
          content: "<p>First update</p>",
          version: originalVersion
        }
      }
    );

    assert.equal(firstSave.status, 200);
    assert.equal(
      firstSave.data.version,
      originalVersion + 1
    );

    // Second save uses outdated version.
    const outdatedSave = await request(
      `/api/documents/${documentId}`,
      {
        method: "PUT",
        userId: 1,
        body: {
          title: "Outdated Save",
          content: "<p>Should not overwrite</p>",
          version: originalVersion
        }
      }
    );

    assert.equal(outdatedSave.status, 409);

    // Verify that first save was preserved.
    const currentDocument = await request(
      `/api/documents/${documentId}`,
      { userId: 1 }
    );

    assert.equal(currentDocument.status, 200);
    assert.equal(
      currentDocument.data.title,
      "First Save"
    );
    assert.equal(
      currentDocument.data.content,
      "<p>First update</p>"
    );
    assert.equal(
      currentDocument.data.version,
      originalVersion + 1
    );
  }
);

// ==================================================
// PHASE 7 — ADDITIONAL UPLOAD SECURITY TESTS
// ==================================================

// --------------------------------------------------
// TEST 12: OVERSIZED FILE
// --------------------------------------------------

test(
  "Uploads larger than 5 MB are rejected with 413",
  async () => {
    const response = await uploadFiles([
      {
        name: "oversized.txt",
        content: Buffer.alloc(
          5 * 1024 * 1024 + 1,
          65
        ),
        type: "text/plain"
      }
    ]);

    assert.equal(response.status, 413);
    assert.match(response.data.error, /5 MB/i);
  }
);

// --------------------------------------------------
// TEST 13: FAKE DOCX
// --------------------------------------------------

test("Fake DOCX files are rejected", async () => {
  const response = await uploadFiles([
    {
      name: "fake.docx",
      content: "This is not a Word document"
    }
  ]);

  assert.equal(response.status, 400);
  assert.match(response.data.error, /DOCX/i);
});

// --------------------------------------------------
// TEST 14: CORRUPTED DOCX
// --------------------------------------------------

test("Corrupted DOCX archives are rejected", async () => {
  const response = await uploadFiles([
    {
      name: "corrupt.docx",
      content: Buffer.from([
        0x50,
        0x4b,
        0x03,
        0x04,
        0x00,
        0x00,
        0x00,
        0x00
      ])
    }
  ]);

  assert.equal(response.status, 400);
  assert.match(response.data.error, /DOCX/i);
});

// --------------------------------------------------
// TEST 15: BINARY TXT FILE
// --------------------------------------------------

test(
  "Binary content disguised as TXT is rejected",
  async () => {
    const response = await uploadFiles([
      {
        name: "binary.txt",
        content: Buffer.from([
          0x41,
          0x00,
          0x42
        ]),
        type: "text/plain"
      }
    ]);

    assert.equal(response.status, 400);
    assert.match(
      response.data.error,
      /Binary content/i
    );
  }
);

// --------------------------------------------------
// TEST 16: INVALID UTF-8
// --------------------------------------------------

test(
  "Invalid UTF-8 text uploads are rejected",
  async () => {
    const response = await uploadFiles([
      {
        name: "invalid.md",
        content: Buffer.from([
          0xc3,
          0x28
        ]),
        type: "text/markdown"
      }
    ]);

    assert.equal(response.status, 400);
    assert.match(
      response.data.error,
      /UTF-8/i
    );
  }
);

// --------------------------------------------------
// TEST 17: MULTIPLE FILE UPLOAD
// --------------------------------------------------

test(
  "Multiple files in one upload are rejected",
  async () => {
    const response = await uploadFiles([
      {
        name: "first.txt",
        content: "First",
        type: "text/plain"
      },
      {
        name: "second.txt",
        content: "Second",
        type: "text/plain"
      }
    ]);

    assert.equal(response.status, 400);
  }
);