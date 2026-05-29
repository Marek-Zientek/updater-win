import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  RotateCcw,
  RotateCw
} from 'lucide-react'

interface RichEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

function ToolbarBtn({
  onClick,
  active,
  title,
  children
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        background: active ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '6px',
        padding: '5px 7px',
        cursor: 'pointer',
        color: active ? '#a78bfa' : 'rgba(255,255,255,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        lineHeight: 1
      }}
    >
      {children}
    </button>
  )
}

export function RichEditor({ content, onChange, placeholder = 'Wpisz opis...' }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder })
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'rich-editor-content',
        style: 'outline: none; min-height: 120px;'
      }
    }
  })

  if (!editor) return null

  const toolbarGroups = [
    [
      {
        icon: <Bold size={14} />,
        title: 'Pogrubienie',
        action: () => editor.chain().focus().toggleBold().run(),
        active: editor.isActive('bold')
      },
      {
        icon: <Italic size={14} />,
        title: 'Kursywa',
        action: () => editor.chain().focus().toggleItalic().run(),
        active: editor.isActive('italic')
      },
      {
        icon: <UnderlineIcon size={14} />,
        title: 'Podkreślenie',
        action: () => editor.chain().focus().toggleUnderline().run(),
        active: editor.isActive('underline')
      },
      {
        icon: <Highlighter size={14} />,
        title: 'Wyróżnienie',
        action: () => editor.chain().focus().toggleHighlight().run(),
        active: editor.isActive('highlight')
      }
    ],
    [
      {
        icon: <Heading2 size={14} />,
        title: 'Nagłówek H2',
        action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        active: editor.isActive('heading', { level: 2 })
      },
      {
        icon: <Heading3 size={14} />,
        title: 'Nagłówek H3',
        action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        active: editor.isActive('heading', { level: 3 })
      },
      {
        icon: <List size={14} />,
        title: 'Lista punktowana',
        action: () => editor.chain().focus().toggleBulletList().run(),
        active: editor.isActive('bulletList')
      },
      {
        icon: <ListOrdered size={14} />,
        title: 'Lista numerowana',
        action: () => editor.chain().focus().toggleOrderedList().run(),
        active: editor.isActive('orderedList')
      }
    ],
    [
      {
        icon: <AlignLeft size={14} />,
        title: 'Wyrównaj do lewej',
        action: () => editor.chain().focus().setTextAlign('left').run(),
        active: editor.isActive({ textAlign: 'left' })
      },
      {
        icon: <AlignCenter size={14} />,
        title: 'Wyśrodkuj',
        action: () => editor.chain().focus().setTextAlign('center').run(),
        active: editor.isActive({ textAlign: 'center' })
      },
      {
        icon: <AlignRight size={14} />,
        title: 'Wyrównaj do prawej',
        action: () => editor.chain().focus().setTextAlign('right').run(),
        active: editor.isActive({ textAlign: 'right' })
      }
    ],
    [
      {
        icon: <RotateCcw size={14} />,
        title: 'Cofnij',
        action: () => editor.chain().focus().undo().run(),
        active: false
      },
      {
        icon: <RotateCw size={14} />,
        title: 'Ponów',
        action: () => editor.chain().focus().redo().run(),
        active: false
      }
    ]
  ]

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        overflow: 'hidden'
      }}
    >
      {/* Pasek narzędzi */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
        {toolbarGroups.map((group, gi) => (
          <div key={gi} style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            {gi > 0 && (
              <div
                style={{
                  width: '1px',
                  height: '18px',
                  background: 'rgba(255,255,255,0.08)',
                  margin: '0 2px'
                }}
              />
            )}
            {group.map((btn, bi) => (
              <ToolbarBtn key={bi} onClick={btn.action} active={btn.active} title={btn.title}>
                {btn.icon}
              </ToolbarBtn>
            ))}
          </div>
        ))}
      </div>

      {/* Obszar edycji */}
      <div style={{ padding: '12px 14px' }}>
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .rich-editor-content {
          color: rgba(255,255,255,0.85);
          font-size: 14px;
          line-height: 1.7;
          font-family: inherit;
        }
        .rich-editor-content p { margin: 0 0 8px 0; }
        .rich-editor-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgba(255,255,255,0.2);
          pointer-events: none;
          height: 0;
        }
        .rich-editor-content h2 { font-size: 18px; font-weight: 800; color: #fff; margin: 12px 0 6px; }
        .rich-editor-content h3 { font-size: 15px; font-weight: 700; color: rgba(255,255,255,0.9); margin: 10px 0 4px; }
        .rich-editor-content ul, .rich-editor-content ol { padding-left: 20px; margin: 6px 0; }
        .rich-editor-content li { margin-bottom: 2px; }
        .rich-editor-content strong { color: #fff; font-weight: 700; }
        .rich-editor-content em { color: rgba(255,255,255,0.7); }
        .rich-editor-content u { text-decoration-color: rgba(139,92,246,0.6); }
        .rich-editor-content mark { background: rgba(139,92,246,0.3); color: #c4b5fd; border-radius: 3px; padding: 0 3px; }
        .ProseMirror:focus { outline: none; }
      `}</style>
    </div>
  )
}
