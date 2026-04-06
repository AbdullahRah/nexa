"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useCallback } from "react";

interface ProposalEditorProps {
  initialContent: string;
  opportunityId: string;
  onContentChange?: (content: string) => void;
}

export default function ProposalEditor({
  initialContent,
  onContentChange,
}: ProposalEditorProps) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUpdate = useCallback(
    (text: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        onContentChange?.(text);
      }, 500);
    },
    [onContentChange]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Highlight,
      Placeholder.configure({
        placeholder: "Start writing your proposal...",
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[500px] px-6 py-4 text-[#F5F5F5]",
      },
    },
    onUpdate: ({ editor: ed }) => {
      handleUpdate(ed.getText());
    },
  });

  // Sync initialContent when it changes externally
  useEffect(() => {
    if (editor && initialContent && !editor.getText().trim()) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  if (!editor) return null;

  const wordCount = editor
    .getText()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  return (
    <div className="flex flex-col border border-white/[0.07] rounded-lg overflow-hidden bg-[#1A1A1A]">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/[0.07] bg-[#141414] flex-wrap">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="B"
          bold
        />
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="I"
          italic
        />
        <div className="w-px h-4 bg-white/[0.07] mx-1" />
        <ToolbarButton
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          label="H1"
        />
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          label="H2"
        />
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          label="H3"
        />
        <div className="w-px h-4 bg-white/[0.07] mx-1" />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="UL"
        />
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="OL"
        />
        <div className="flex-1" />
        <span className="text-[10px] text-[#A0A0A0]">{wordCount} words</span>
      </div>

      {/* Editor */}
      <div className="overflow-y-auto max-h-[calc(100vh-220px)]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  bold,
  italic,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  bold?: boolean;
  italic?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 text-xs rounded transition-colors ${
        active
          ? "bg-blue-600/20 text-blue-400"
          : "text-[#A0A0A0] hover:text-[#F5F5F5] hover:bg-white/[0.05]"
      } ${bold ? "font-bold" : ""} ${italic ? "italic" : ""}`}
    >
      {label}
    </button>
  );
}
