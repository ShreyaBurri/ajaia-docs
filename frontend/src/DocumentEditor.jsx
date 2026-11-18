import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export default function DocumentEditor({
  document,
  onChange,
  readOnly,
}) {
  const onChangeRef = useRef(onChange);
  const loadingRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: document.content || "",
    editable: !readOnly,

    onUpdate: ({ editor, transaction }) => {
      // Ignore changes caused by loading a document.
      if (loadingRef.current) return;

      // Ignore transactions that do not change content.
      if (!transaction.docChanged) return;

      // Ignore edits in read-only mode.
      if (!editor.isEditable) return;

      onChangeRef.current(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;

    const nextContent = document.content || "";

    if (editor.getHTML() !== nextContent) {
      loadingRef.current = true;

      try {
        editor.commands.setContent(nextContent, {
          emitUpdate: false,
        });
      } finally {
        loadingRef.current = false;
      }
    }
  }, [document.id, editor]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  if (!editor) return null;

  const tools = [
    {
      label: "B",
      action: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive("bold"),
    },
    {
      label: "I",
      action: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive("italic"),
    },
    {
      label: "H1",
      action: () =>
        editor.chain().focus().toggleHeading({ level: 1 }).run(),
      active: editor.isActive("heading", { level: 1 }),
    },
    {
      label: "H2",
      action: () =>
        editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor.isActive("heading", { level: 2 }),
    },
    {
      label: "• List",
      action: () =>
        editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive("bulletList"),
    },
    {
      label: "1. List",
      action: () =>
        editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive("orderedList"),
    },
  ];

  return (
    <div className="editor-container">
      <div className="toolbar">
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            disabled={readOnly}
            className={tool.active ? "active" : ""}
            onMouseDown={(event) => event.preventDefault()}
            onClick={tool.action}
          >
            {tool.label}
          </button>
        ))}
      </div>

      <div className="editor-page">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}