const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const mammoth = require("mammoth");
const sanitizeHtml = require("sanitize-html");
const { TextDecoder } = require("node:util");
const db = require("./database");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// --------------------------------------------------
// HTML SANITIZATION
// --------------------------------------------------

function cleanHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "strong", "em",
      "b", "i", "u", "s",
      "h1", "h2", "h3",
      "ul", "ol", "li",
      "blockquote", "code", "pre",
      "a"
    ],
    allowedAttributes: {
      a: ["href", "title"]
    },
    allowedSchemes: [
      "http",
      "https",
      "mailto"
    ]
  });
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function validDocumentId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
}

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    status: "success",
    message: "Ajaia Docs Backend Running"
  });
});

// --------------------------------------------------
// DEMO USER MIDDLEWARE
// WARNING: This is NOT production authentication.
// --------------------------------------------------

app.use("/api", (req, res, next) => {
  const userId = Number(req.header("x-user-id") || 1);

  if (!Number.isSafeInteger(userId) || userId < 1) {
    return res.status(400).json({
      error: "Invalid user ID"
    });
  }

  const user = db.prepare(`
    SELECT id, name, email
    FROM users
    WHERE id = ?
  `).get(userId);

  if (!user) {
    return res.status(401).json({
      error: "Unknown user"
    });
  }

  req.user = user;
  next();
});

// --------------------------------------------------
// USERS
// --------------------------------------------------

app.get("/api/users", (req, res) => {
  const users = db.prepare(`
    SELECT id, name, email
    FROM users
  `).all();

  res.json(users);
});

// --------------------------------------------------
// DOCUMENT ACCESS HELPER
// --------------------------------------------------

function getAccessibleDocument(id, userId) {
  return db.prepare(`
    SELECT d.*,
      CASE
        WHEN d.owner_id = ? THEN 'owner'
        ELSE s.permission
      END AS access
    FROM documents d
    LEFT JOIN document_shares s
      ON s.document_id = d.id
      AND s.user_id = ?
    WHERE d.id = ?
      AND (
        d.owner_id = ?
        OR s.user_id = ?
      )
  `).get(
    userId,
    userId,
    id,
    userId,
    userId
  );
}

// --------------------------------------------------
// GET ALL ACCESSIBLE DOCUMENTS
// --------------------------------------------------

app.get("/api/documents", (req, res) => {
  const documents = db.prepare(`
    SELECT DISTINCT d.*,
      CASE
        WHEN d.owner_id = ? THEN 'owner'
        ELSE s.permission
      END AS access
    FROM documents d
    LEFT JOIN document_shares s
      ON s.document_id = d.id
      AND s.user_id = ?
    WHERE d.owner_id = ?
       OR s.user_id = ?
    ORDER BY d.updated_at DESC, d.id DESC
  `).all(
    req.user.id,
    req.user.id,
    req.user.id,
    req.user.id
  );

  res.json(documents);
});

// --------------------------------------------------
// CREATE DOCUMENT
// --------------------------------------------------

app.post("/api/documents", (req, res) => {
  const title =
    typeof req.body?.title === "string"
      ? req.body.title.trim()
      : "Untitled Document";

  if (title.length > 200) {
    return res.status(400).json({
      error: "Title is too long"
    });
  }

  const result = db.prepare(`
    INSERT INTO documents (
      title,
      owner_id
    )
    VALUES (?, ?)
  `).run(
    title || "Untitled Document",
    req.user.id
  );

  const document = getAccessibleDocument(
    result.lastInsertRowid,
    req.user.id
  );

  res.status(201).json(document);
});

// --------------------------------------------------
// FILE UPLOAD CONFIGURATION
// --------------------------------------------------

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_CONTENT_LENGTH = 1000000;

const ALLOWED_EXTENSIONS = [
  ".txt",
  ".md",
  ".docx"
];

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 0,
    parts: 1
  },

  fileFilter: (req, file, callback) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (ALLOWED_EXTENSIONS.includes(extension)) {
      callback(null, true);
    } else {
      callback(
        new Error(
          "Only TXT, MD, and DOCX files are allowed"
        )
      );
    }
  }
});

// --------------------------------------------------
// FILE VALIDATION HELPERS
// --------------------------------------------------

function isZipFile(buffer) {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

function decodeTextFile(buffer) {
  const decoder = new TextDecoder("utf-8", {
    fatal: true
  });

  const text = decoder.decode(buffer);

  if (text.includes("\0")) {
    throw new Error(
      "Binary content is not allowed in TXT or MD files"
    );
  }

  return text;
}

// --------------------------------------------------
// UPLOAD DOCUMENT
// IMPORTANT: Must appear before /:id routes.
// --------------------------------------------------

app.post(
  "/api/documents/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded"
        });
      }

      const extension = path
        .extname(req.file.originalname)
        .toLowerCase();

      let content = "";

      if (extension === ".docx") {
        const buffer = req.file.buffer;

        if (!isZipFile(buffer)) {
          return res.status(400).json({
            error: "Invalid DOCX file format"
          });
        }

        // Mammoth also checks whether the DOCX
        // archive can be parsed successfully.
        let converted;

        try {
          converted = await mammoth.convertToHtml({
            buffer
          });
        } catch (error) {
          return res.status(400).json({
            error: "Invalid or corrupted DOCX file"
          });
        }

        content = cleanHtml(converted.value);

      } else {
        let text;

        try {
          text = decodeTextFile(req.file.buffer);
        } catch (error) {
          return res.status(400).json({
            error:
              error.message.includes("Binary content")
                ? error.message
                : "TXT and MD files must contain valid UTF-8 text"
          });
        }

        content = text
          .split(/\r?\n/)
          .map(
            (line) =>
              `<p>${escapeHtml(line) || "<br>"}</p>`
          )
          .join("");
      }

      if (content.length > MAX_CONTENT_LENGTH) {
        return res.status(400).json({
          error: "Document content is too large"
        });
      }

      const title = path
        .parse(req.file.originalname)
        .name
        .slice(0, 200) ||
        "Imported Document";

      const result = db.prepare(`
        INSERT INTO documents (
          title,
          content,
          owner_id
        )
        VALUES (?, ?, ?)
      `).run(
        title,
        content,
        req.user.id
      );

      const document = getAccessibleDocument(
        result.lastInsertRowid,
        req.user.id
      );

      res.status(201).json(document);

    } catch (error) {
      console.error("Upload error:", error);

      res.status(400).json({
        error: "File import failed. Check the file format."
      });
    }
  }
);

// --------------------------------------------------
// GET DOCUMENT BY ID
// --------------------------------------------------

app.get("/api/documents/:id", (req, res) => {
  if (!validDocumentId(req.params.id)) {
    return res.status(400).json({
      error: "Invalid document ID"
    });
  }

  const document = getAccessibleDocument(
    req.params.id,
    req.user.id
  );

  if (!document) {
    return res.status(404).json({
      error: "Document not found"
    });
  }

  res.json(document);
});

// --------------------------------------------------
// UPDATE DOCUMENT
// OWNER AND EDITOR ONLY
// VERSION CONFLICT PROTECTION
// --------------------------------------------------

app.put("/api/documents/:id", (req, res) => {
  if (!validDocumentId(req.params.id)) {
    return res.status(400).json({
      error: "Invalid document ID"
    });
  }

  const document = getAccessibleDocument(
    req.params.id,
    req.user.id
  );

  if (!document) {
    return res.status(404).json({
      error: "Document not found"
    });
  }

  if (!["owner", "editor"].includes(document.access)) {
    return res.status(403).json({
      error: "Edit permission required"
    });
  }

  const { version } = req.body || {};

  if (!Number.isSafeInteger(version) || version < 1) {
    return res.status(400).json({
      error: "A valid document version is required"
    });
  }

  const title = req.body.title ?? document.title;
  const content = req.body.content ?? document.content;

  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 200 ||
    typeof content !== "string" ||
    content.length > MAX_CONTENT_LENGTH
  ) {
    return res.status(400).json({
      error: "Invalid document data"
    });
  }

  const safeContent = cleanHtml(content);

  const result = db.prepare(`
    UPDATE documents
    SET
      title = ?,
      content = ?,
      version = version + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND version = ?
  `).run(
    title.trim(),
    safeContent,
    document.id,
    version
  );

  if (result.changes === 0) {
    return res.status(409).json({
      error:
        "This document was updated by another user. " +
        "Your changes were not saved. " +
        "Please reload the document before editing again."
    });
  }

  res.json(
    getAccessibleDocument(document.id, req.user.id)
  );
});

// --------------------------------------------------
// DELETE DOCUMENT
// OWNER ONLY
// --------------------------------------------------

app.delete("/api/documents/:id", (req, res) => {
  if (!validDocumentId(req.params.id)) {
    return res.status(400).json({
      error: "Invalid document ID"
    });
  }

  const result = db.prepare(`
    DELETE FROM documents
    WHERE id = ?
      AND owner_id = ?
  `).run(
    req.params.id,
    req.user.id
  );

  if (!result.changes) {
    return res.status(404).json({
      error: "Document not found or not owned by user"
    });
  }

  res.json({
    message: "Document deleted"
  });
});

// --------------------------------------------------
// SHARE DOCUMENT
// OWNER ONLY
// --------------------------------------------------

app.post(
  "/api/documents/:id/share",
  (req, res) => {
    if (!validDocumentId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid document ID"
      });
    }

    const document = db.prepare(`
      SELECT *
      FROM documents
      WHERE id = ?
        AND owner_id = ?
    `).get(
      req.params.id,
      req.user.id
    );

    if (!document) {
      return res.status(403).json({
        error: "Owner access required"
      });
    }

    const {
      userId,
      permission
    } = req.body || {};

    if (
      !Number.isSafeInteger(userId) ||
      userId < 1 ||
      userId === req.user.id ||
      !["viewer", "editor"].includes(permission)
    ) {
      return res.status(400).json({
        error: "Invalid share request"
      });
    }

    const target = db.prepare(`
      SELECT id
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!target) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    db.prepare(`
      INSERT INTO document_shares (
        document_id,
        user_id,
        permission
      )
      VALUES (?, ?, ?)
      ON CONFLICT(document_id, user_id)
      DO UPDATE SET
        permission = excluded.permission
    `).run(
      document.id,
      userId,
      permission
    );

    res.json({
      message: "Document shared successfully"
    });
  }
);

// --------------------------------------------------
// ERROR HANDLING
// --------------------------------------------------

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "File is too large. Maximum size is 5 MB"
      });
    }

    return res.status(400).json({
      error: error.message
    });
  }

  if (
    error.message?.includes(
      "Only TXT"
    )
  ) {
    return res.status(400).json({
      error: error.message
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      error: "Request body is too large"
    });
  }

  console.error("Server error:", error);

  res.status(500).json({
    error: "Internal server error"
  });
});

// --------------------------------------------------
// SERVE REACT FRONTEND IN PRODUCTION
// --------------------------------------------------

const frontendDist = path.join(
  __dirname,
  "../frontend/dist"
);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(frontendDist));

  app.get("/{*path}", (req, res) => {
    res.sendFile(
      path.join(frontendDist, "index.html")
    );
  });
}

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

module.exports = app;