import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Strikethrough, Underline as UnderlineIcon, Undo2, Unlink } from 'lucide-react'
import type { Editor } from '@tiptap/react'

/** Legacy plain-text values (no tags) become paragraphs so old content opens correctly in the editor. */
function toHtml(v: string): string {
  const s = v ?? ''
  if (!s.trim()) return ''
  if (/^\s*</.test(s)) return s
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return s.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
}

function Btn({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick(): void; children: React.ReactNode }) {
  return <button type="button" className="rte-btn" title={label} aria-label={label} aria-pressed={!!active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{children}</button>
}

function Toolbar({ editor }: { editor: Editor }) {
  const c = () => editor.chain().focus()
  function link() {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL (leave empty to remove)', prev ?? 'https://')
    if (url === null) return
    if (!url.trim()) return void c().unsetLink().run()
    c().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }
  const S = 16
  return (
    <div className="rte-bar" role="toolbar" aria-label="Formatting">
      <Btn label="Bold" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()}><Bold size={S} /></Btn>
      <Btn label="Italic" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}><Italic size={S} /></Btn>
      <Btn label="Underline" active={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()}><UnderlineIcon size={S} /></Btn>
      <Btn label="Strikethrough" active={editor.isActive('strike')} onClick={() => c().toggleStrike().run()}><Strikethrough size={S} /></Btn>
      <span className="rte-sep" />
      <Btn label="Heading" active={editor.isActive('heading', { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 size={S} /></Btn>
      <Btn label="Subheading" active={editor.isActive('heading', { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 size={S} /></Btn>
      <span className="rte-sep" />
      <Btn label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}><List size={S} /></Btn>
      <Btn label="Numbered list" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}><ListOrdered size={S} /></Btn>
      <Btn label="Quote" active={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()}><Quote size={S} /></Btn>
      <Btn label="Divider" onClick={() => c().setHorizontalRule().run()}><Minus size={S} /></Btn>
      <span className="rte-sep" />
      <Btn label="Add link" active={editor.isActive('link')} onClick={link}><Link2 size={S} /></Btn>
      <Btn label="Remove link" disabled={!editor.isActive('link')} onClick={() => c().unsetLink().run()}><Unlink size={S} /></Btn>
      <span className="rte-sep" />
      <Btn label="Undo" disabled={!editor.can().undo()} onClick={() => c().undo().run()}><Undo2 size={S} /></Btn>
      <Btn label="Redo" disabled={!editor.can().redo()} onClick={() => c().redo().run()}><Redo2 size={S} /></Btn>
    </div>
  )
}

/** Tiptap rich-text field. Value in/out is an HTML string; an empty document is reported as ''. */
export function RichText({ value, onChange, placeholder, minHeight = '8rem', disabled }: { value: string; onChange(html: string): void; placeholder?: string; minHeight?: string; disabled?: boolean }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } } }),
      Placeholder.configure({ placeholder: placeholder ?? 'Start writing…' }),
    ],
    content: toHtml(value),
    editable: !disabled,
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
    editorProps: { attributes: { 'aria-label': placeholder ?? 'Rich text editor' } },
  })

  useEffect(() => { editor?.setEditable(!disabled) }, [editor, disabled])

  return (
    <div className="rte" data-disabled={!!disabled} style={{ ['--rte-min' as string]: minHeight }}>
      {editor && !disabled && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

/** Labelled RichText. Uses a div (not <label>) so clicking the toolbar never forwards to a button. */
export function RichField({ label, hint, className = '', ...props }: { label: string; hint?: string; className?: string } & Parameters<typeof RichText>[0]) {
  return (
    <div className={className}>
      <span className="label">{label}</span>
      <RichText {...props} />
      {hint && <span className="mt-1 block text-xs text-taupe-deep">{hint}</span>}
    </div>
  )
}
