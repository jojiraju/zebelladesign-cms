/* eslint-disable @typescript-eslint/no-explicit-any */
/** Demo stand-in for `firebase/storage`: "uploads" stay in the browser as object URLs. */
const files = new Map<string, string>()
export const getStorage = (): any => ({ demo: true })
export const ref = (_s: unknown, path: string) => ({ path })
export function uploadBytesResumable(r: { path: string }, file: Blob) {
  files.set(r.path, URL.createObjectURL(file))
  return {
    cancel: () => true,
    on(_evt: string, next?: (s: { bytesTransferred: number; totalBytes: number }) => void, _err?: (e: Error) => void, done?: () => void) {
      setTimeout(() => next?.({ bytesTransferred: file.size / 2, totalBytes: file.size }), 120)
      setTimeout(() => { next?.({ bytesTransferred: file.size, totalBytes: file.size }); done?.() }, 320)
    },
  }
}
export const getDownloadURL = async (r: { path: string }) => files.get(r.path) ?? ''
export const deleteObject = async (r: { path: string }) => { files.delete(r.path) }
