import { useRef, useState } from 'react'
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { storage } from '../lib/firebase'
import { errMsg } from '../lib/util'
import { useToast } from './ui'

export interface Img { url: string; path?: string; alt?: string }

const OK_IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const MAX_IMG = 8 * 1024 * 1024
const MAX_VIDEO = 50 * 1024 * 1024

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined

/** Free-tier alternative to Firebase Storage (which needs the Blaze plan): unsigned Cloudinary upload. */
async function uploadToCloudinary(file: File, folder: string, video: boolean): Promise<Img> {
  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', PRESET!)
  body.append('folder', `zebella/${folder}`)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/${video ? 'video' : 'image'}/upload`, { method: 'POST', body, signal: AbortSignal.timeout(120_000) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.secure_url) throw new Error(data?.error?.message ?? 'Upload failed. Check the Cloudinary cloud name and upload preset.')
  return { url: data.secure_url as string, path: data.public_id as string }
}

/** Validates type/size client-side (Storage rules enforce the same limits server-side) and uploads. */
export async function uploadFile(file: File, folder: string, opts: { video?: boolean } = {}): Promise<Img> {
  const isVideo = ['video/mp4', 'video/webm'].includes(file.type)
  if (opts.video ? !isVideo : !OK_IMG.includes(file.type)) throw new Error(opts.video ? 'Use an MP4 or WebM video.' : 'Use a JPG, PNG, WebP or AVIF image.')
  if (file.size > (opts.video ? MAX_VIDEO : MAX_IMG)) throw new Error(`File is too large (max ${opts.video ? 50 : 8} MB).`)
  if (CLOUD && PRESET) return uploadToCloudinary(file, folder, !!opts.video)
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
  const path = `${folder}/${Date.now()}-${safe}`
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type })
  // If Storage is not enabled / the bucket is unreachable the SDK retries silently for minutes.
  // Fail fast with an actionable message when no bytes move for 20 seconds.
  await new Promise<void>((resolve, reject) => {
    let lastBytes = -1
    let timer = setTimeout(stalled, 20_000)
    function stalled() {
      task.cancel()
      reject(new Error('Upload is not progressing. Check that Firebase Storage is enabled (needs the Blaze plan), the bucket name in .env.local is correct, and the Storage rules are published.'))
    }
    task.on('state_changed', (s) => {
      if (s.bytesTransferred !== lastBytes) { lastBytes = s.bytesTransferred; clearTimeout(timer); timer = setTimeout(stalled, 20_000) }
    }, (e) => { clearTimeout(timer); reject(e) }, () => { clearTimeout(timer); resolve() })
  })
  return { url: await getDownloadURL(ref(storage, path)), path }
}

export async function removeFile(path?: string) {
  // Cloudinary assets can't be deleted from the browser with an unsigned preset; remove them in its Media Library.
  if (path && !(CLOUD && PRESET)) await deleteObject(ref(storage, path)).catch(() => undefined) // already gone is fine
}

/** Click-or-drop target shared by both editors. */
function DropZone({ busy, multiple, onFiles, className = '', children }: { busy: boolean; multiple?: boolean; onFiles(files: File[]): void; className?: string; children: React.ReactNode }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <>
      <button type="button" disabled={busy} data-over={over} className={`dropzone grid place-items-center text-center ${className}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(Array.from(e.dataTransfer.files)) }}>
        {busy ? <span className="grid place-items-center gap-2 text-sm text-gold-deep"><Loader2 className="animate-spin" />Uploading…</span> : children}
      </button>
      <input ref={input} type="file" accept={OK_IMG.join(',')} multiple={multiple} hidden onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
    </>
  )
}

const Prompt = ({ text }: { text: string }) => (
  <span className="grid place-items-center gap-1.5 px-3 py-2">
    <span className="grid h-10 w-10 place-items-center rounded-full bg-gold-soft text-gold-deep"><ImagePlus size={20} /></span>
    <span className="text-sm font-semibold text-ink">{text}</span>
    <span className="text-xs text-taupe-deep">Click or drag &amp; drop · JPG, PNG, WebP, AVIF · max 8 MB</span>
  </span>
)

/** Multi-image gallery editor with reorder (first image is the primary/cover image). */
export function GalleryEditor({ images, onChange, folder }: { images: Img[]; onChange(next: Img[]): void; folder: string }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function add(files: File[]) {
    if (!files.length) return
    setBusy(true)
    const added: Img[] = []
    for (const f of files) {
      try { added.push(await uploadFile(f, folder)) } catch (e) { toast(`${f.name}: ${errMsg(e)}`, 'error') }
    }
    if (added.length) onChange([...images, ...added])
    setBusy(false)
  }
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= images.length) return
    const next = [...images]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.url + i} className="group relative overflow-hidden rounded-xl border border-line bg-cream shadow-sm transition hover:shadow-lg">
              <img src={img.url} alt={img.alt ?? ''} className="aspect-[3/4] w-full object-cover transition duration-300 group-hover:scale-105" />
              {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-pink-500 to-violet-600 px-2.5 py-0.5 text-[0.65rem] font-semibold text-white shadow">Cover</span>}
              <div className="absolute inset-x-0 bottom-0 flex translate-y-full justify-between bg-gradient-to-t from-black/70 to-transparent p-2 pt-6 text-white transition group-hover:translate-y-0 group-focus-within:translate-y-0">
                <button type="button" aria-label="Move earlier" onClick={() => move(i, -1)} disabled={i === 0} className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 backdrop-blur hover:bg-white/35 disabled:opacity-30"><ArrowLeft size={15} /></button>
                <button type="button" aria-label="Remove image" onClick={() => { void removeFile(img.path); onChange(images.filter((_, k) => k !== i)) }} className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/80 hover:bg-red-500"><Trash2 size={15} /></button>
                <button type="button" aria-label="Move later" onClick={() => move(i, 1)} disabled={i === images.length - 1} className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 backdrop-blur hover:bg-white/35 disabled:opacity-30"><ArrowRight size={15} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <DropZone busy={busy} multiple onFiles={(f) => void add(f)} className="w-full py-8"><Prompt text={images.length ? 'Add more images' : 'Upload product images'} /></DropZone>
    </div>
  )
}

/** Single image field (banners, categories, hero…). */
export function SingleImage({ value, onChange, folder, label }: { value?: string; onChange(url: string): void; folder: string; label: string }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  async function pick(files: File[]) {
    const f = files[0]
    if (!f) return
    setBusy(true)
    try { onChange((await uploadFile(f, folder)).url) } catch (err) { toast(errMsg(err), 'error') }
    setBusy(false)
  }
  return (
    <div>
      <span className="label">{label}</span>
      {value ? (
        <div className="group relative overflow-hidden rounded-xl border border-line bg-cream">
          <img src={value} alt="" className="h-40 w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
            <label className="btn btn-sm cursor-pointer">{busy ? 'Uploading…' : 'Replace'}<input type="file" accept={OK_IMG.join(',')} hidden onChange={(e) => { void pick(Array.from(e.target.files ?? [])); e.target.value = '' }} /></label>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => onChange('')}>Remove</button>
          </div>
          {busy && <div className="absolute inset-0 grid place-items-center bg-white/70"><Loader2 className="animate-spin text-gold-deep" /></div>}
        </div>
      ) : (
        <DropZone busy={busy} onFiles={(f) => void pick(f)} className="h-40 w-full"><Prompt text="Upload image" /></DropZone>
      )}
    </div>
  )
}
