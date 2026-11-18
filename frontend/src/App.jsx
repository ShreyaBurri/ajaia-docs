import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Upload,
  Share2,
} from "lucide-react";

import { api } from "./api";
import DocumentEditor from "./DocumentEditor";
import "./App.css";

export default function App() {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState(1);
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [hasConflict, setHasConflict] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sharing
  const [showShare, setShowShare] = useState(false);
  const [shareUserId, setShareUserId] = useState(2);
  const [sharePermission, setSharePermission] = useState("viewer");

  const selectedIdRef = useRef(null);
  const editVersion = useRef(0);
  const requestRef = useRef(0);
  const currentUserRef = useRef(userId);
  const savingRef = useRef(false);

  // Load demo users
  useEffect(() => {
    api("/users", {}, userId)
      .then(setUsers)
      .catch((err) => setError(err.message));
  }, [userId]);

  // Load documents when switching users
  useEffect(() => {
    currentUserRef.current = userId;
    selectedIdRef.current = null;
    requestRef.current++;

    setSelected(null);
    setTitle("");
    setContent("");
    setDocuments([]);
    setShowShare(false);
    setError("");
    setStatus("Ready");
    setHasConflict(false);

    let cancelled = false;

    api("/documents", {}, userId)
      .then((data) => {
        if (!cancelled) setDocuments(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function loadDocuments() {
    const activeUser = userId;

    try {
      const data = await api("/documents", {}, activeUser);

      if (currentUserRef.current === activeUser) {
        setDocuments(data);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function confirmUnsavedChanges() {
    if (status !== "Unsaved changes" &&
        status !== "Save failed" &&
        status !== "Version conflict" &&
        status !== "Saving...") {
      return true;
    }

    return window.confirm(
      "You have unsaved changes. Continue without saving?"
    );
  }

  // Open an existing document
  async function openDocument(id, skipConfirmation = false) {
    if (!skipConfirmation && !confirmUnsavedChanges()) {
      return;
    }

    const requestId = ++requestRef.current;
    const activeUser = userId;

    selectedIdRef.current = id;
    setShowShare(false);
    setError("");

    try {
      const data = await api(
        `/documents/${id}`,
        {},
        activeUser
      );

      if (
        requestRef.current !== requestId ||
        currentUserRef.current !== activeUser
      ) {
        return;
      }

      setSelected(data);
      setTitle(data.title);
      setContent(data.content);
      setStatus("Saved");
      setHasConflict(false);
      editVersion.current = 0;
    } catch (err) {
      if (requestRef.current === requestId) {
        setError(err.message);
      }
    }
  }

  // Create a document
  async function createDocument() {
    if (!confirmUnsavedChanges()) return;

    try {
      setError("");

      const data = await api(
        "/documents",
        {
          method: "POST",
          body: JSON.stringify({
            title: "Untitled Document",
          }),
        },
        userId
      );

      await loadDocuments();
      await openDocument(data.id, true);
    } catch (err) {
      setError(err.message);
    }
  }

  // Upload TXT, MD or DOCX
  async function uploadDocument(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (!confirmUnsavedChanges()) return;

    try {
      setError("");
      setStatus("Uploading...");

      const formData = new FormData();
      formData.append("file", file);

      const document = await api(
        "/documents/upload",
        {
          method: "POST",
          body: formData,
        },
        userId
      );

      await loadDocuments();
      await openDocument(document.id, true);

      setStatus("File uploaded successfully");
    } catch (err) {
      setError(err.message);
      setStatus("Upload failed");
    }
  }

  // Track title changes
  function updateTitle(value) {
    if (value === title) return;
    setTitle(value);  
    editVersion.current++;
    if (!hasConflict) setStatus("Unsaved changes");
  }

  // Track editor changes
  function updateContent(value) {
    if (value === content) return;

    setContent(value);
    editVersion.current++;
    if (!hasConflict) setStatus("Unsaved changes");
  }

  // Save document with optimistic version checking.
  async function saveDocument() {
    if (!selected || selected.access === "viewer" ||
        savingRef.current || hasConflict) {
      return;
    }

    const documentId = selected.id;
    const localEditVersion = editVersion.current;
    const activeUser = userId;

    savingRef.current = true;
    setIsSaving(true);

    try {
      setError("");
      setStatus("Saving...");

      const updated = await api(
        `/documents/${documentId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            title,
            content,
            version: selected.version,
          }),
        },
        activeUser
      );

      if (
        selectedIdRef.current === documentId &&
        currentUserRef.current === activeUser
      ) {
        setSelected((previous) =>
          previous?.id === documentId
            ? {
                ...previous,
                title: updated.title,
                version: updated.version,
              }
            : previous
        );

        setStatus(
          editVersion.current === localEditVersion
            ? "Saved"
            : "Unsaved changes"
        );
      }

      await loadDocuments();
    } catch (err) {
      if (
        selectedIdRef.current === documentId &&
        currentUserRef.current === activeUser
      ) {
        const conflict = err.status === 409 ||
          err.message.includes("updated by another user");

        if (conflict) {
          setHasConflict(true);
          setStatus("Version conflict");
          setError(
            "Someone saved a newer version of this document. " +
            "Your local changes are still here. Copy them before " +
            "reloading the latest version."
          );
        } else {
          setStatus("Save failed");
          setError(err.message);
        }
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  // Copy the local draft as HTML so formatting is retained.
  async function copyLocalChanges() {
    const draft = `Title: ${title}\n\n${content}`;

    try {
      await navigator.clipboard.writeText(draft);
      window.alert(
        "Your local title and HTML content were copied. " +
        "Paste them somewhere safe before reloading."
      );
    } catch {
      setError(
        "Could not copy automatically. Select and copy your " +
        "document content manually before reloading."
      );
    }
  }

  // Reload the newest server version only after explicit approval.
  async function reloadLatestDocument() {
    if (!selected || savingRef.current) return;

    const approved = window.confirm(
      "Reload the latest saved version? Your current unsaved " +
      "title and edits will be discarded. Copy them first if needed."
    );

    if (!approved) return;
    await openDocument(selected.id, true);
  }

  // Delete document
  async function deleteDocument() {
    if (!selected || selected.access !== "owner") {
      return;
    }

    if (!window.confirm(
      "Are you sure you want to delete this document?"
    )) {
      return;
    }

    try {
      setError("");

      await api(
        `/documents/${selected.id}`,
        { method: "DELETE" },
        userId
      );

      selectedIdRef.current = null;
      requestRef.current++;

      setSelected(null);
      setTitle("");
      setContent("");
      setShowShare(false);
      setStatus("Ready");
      setHasConflict(false);

      await loadDocuments();
    } catch (err) {
      setError(err.message);
    }
  }

  // Open sharing modal
  function openShareModal() {
    if (!selected || selected.access !== "owner") {
      return;
    }

    const otherUser = users.find(
      (user) => user.id !== userId
    );

    if (!otherUser) {
      setError("No other demo users available.");
      return;
    }

    setShareUserId(otherUser.id);
    setSharePermission("viewer");
    setShowShare(true);
  }

  // Share document
  async function shareDocument() {
    if (!selected || selected.access !== "owner") {
      return;
    }

    try {
      setError("");

      await api(
        `/documents/${selected.id}/share`,
        {
          method: "POST",
          body: JSON.stringify({
            userId: Number(shareUserId),
            permission: sharePermission,
          }),
        },
        userId
      );

      setShowShare(false);
      window.alert("Document shared successfully!");
    } catch (err) {
      setError(err.message);
    }
  }

  // Switch demo users
  function changeUser(nextUserId) {
    if (!confirmUnsavedChanges()) return;

    currentUserRef.current = nextUserId;
    selectedIdRef.current = null;
    requestRef.current++;
    setShowShare(false);
    setUserId(nextUserId);
  }

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <FileText size={25} />
          <span>Ajaia Docs</span>
        </div>

        <button
          className="create-button"
          onClick={createDocument}
        >
          <Plus size={18} />
          New Document
        </button>

        <label className="upload-button">
          <Upload size={18} />
          Upload Document

          <input
            type="file"
            accept=".txt,.md,.docx"
            onChange={uploadDocument}
            hidden
          />
        </label>

        <div className="sidebar-label">
          YOUR DOCUMENTS
        </div>

        <div className="document-list">
          {documents.map((doc) => (
            <button
              key={doc.id}
              className={
                selected?.id === doc.id
                  ? "document-item selected"
                  : "document-item"
              }
              onClick={() => openDocument(doc.id)}
            >
              <FileText size={17} />
              <span>{doc.title}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <label htmlFor="user-select">
            Demo User
          </label>

          <select
            id="user-select"
            value={userId}
            onChange={(event) =>
              changeUser(Number(event.target.value))
            }
          >
            {users.map((user) => (
              <option
                key={user.id}
                value={user.id}
              >
                {user.name}
              </option>
            ))}
          </select>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <span className="workspace-label">
              My Workspace
            </span>

            {selected && (
              <>
                <span className="separator">/</span>
                <span>{selected.title}</span>
              </>
            )}
          </div>

          <div className="topbar-right">
            <span className="save-status">
              {status}
            </span>

            <button
              className="icon-button"
              onClick={loadDocuments}
              title="Refresh documents"
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="error-banner">
            <span>{error}</span>

            <button
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* EMPTY STATE */}
        {!selected ? (
          <div className="empty-state">
            <div className="empty-icon">
              <FileText size={40} />
            </div>

            <h1>Welcome to Ajaia Docs</h1>

            <p>
              Create a document to start writing
              and collaborating.
            </p>

            <button
              className="primary-button"
              onClick={createDocument}
            >
              <Plus size={18} />
              Create Document
            </button>
          </div>
        ) : (
          /* DOCUMENT WORKSPACE */
          <div className="workspace">
            <div className="document-header">
              <div className="document-info">
                <input
                  className="title-input"
                  value={title}
                  disabled={
                    selected.access === "viewer"
                  }
                  onChange={(event) =>
                    updateTitle(event.target.value)
                  }
                  placeholder="Document title"
                />

                <span className="access-label">
                  {selected.access || "owner"} access
                </span>
              </div>

              <div className="document-actions">
                {/* SHARE - OWNER ONLY */}
                {selected.access === "owner" && (
                  <button
                    className="share-button"
                    onClick={openShareModal}
                  >
                    <Share2 size={17} />
                    Share
                  </button>
                )}

                {/* SAVE - OWNER OR EDITOR */}
                {selected.access !== "viewer" && (
                  <button
                    className="primary-button"
                    onClick={saveDocument}
                    disabled={isSaving || hasConflict}
                  >
                    <Save size={17} />
                    Save
                  </button>
                )}

                {/* DELETE - OWNER ONLY */}
                {selected.access === "owner" && (
                  <button
                    className="danger-button"
                    onClick={deleteDocument}
                  >
                    <Trash2 size={17} />
                    Delete
                  </button>
                )}
              </div>
            </div>

            {hasConflict && (
              <div className="error-banner" role="alert" style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}>
                <span>
                  A newer version exists. Your edits are still in the editor.
                  Copy your draft before reloading.
                </span>
                <button type="button" onClick={copyLocalChanges}>
                  Copy my changes
                </button>
                <button type="button" onClick={reloadLatestDocument}>
                  Reload latest version
                </button>
              </div>
            )}

            <DocumentEditor
              key={`${userId}-${selected.id}`}
              document={{
                ...selected,
                content,
              }}
              onChange={updateContent}
              readOnly={
                selected.access === "viewer"
              }
            />
          </div>
        )}
      </main>

      {/* SHARING MODAL */}
      {showShare && selected?.access === "owner" && (
        <div
          className="modal-overlay"
          onClick={() => setShowShare(false)}
        >
          <div
            className="share-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <h2 id="share-title">
                Share Document
              </h2>

              <button
                className="modal-close"
                onClick={() => setShowShare(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p>
              Choose a user and decide whether
              they can view or edit this document.
            </p>

            <label htmlFor="share-user">
              Share with
            </label>

            <select
              id="share-user"
              value={shareUserId}
              onChange={(event) =>
                setShareUserId(
                  Number(event.target.value)
                )
              }
            >
              {users
                .filter(
                  (user) => user.id !== userId
                )
                .map((user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.name} ({user.email})
                  </option>
                ))}
            </select>

            <label htmlFor="share-permission">
              Permission
            </label>

            <select
              id="share-permission"
              value={sharePermission}
              onChange={(event) =>
                setSharePermission(
                  event.target.value
                )
              }
            >
              <option value="viewer">
                Viewer — Can only read
              </option>

              <option value="editor">
                Editor — Can edit and save
              </option>
            </select>

            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() =>
                  setShowShare(false)
                }
              >
                Cancel
              </button>

              <button
                className="primary-button"
                onClick={shareDocument}
              >
                <Share2 size={16} />
                Share Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}