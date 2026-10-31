import { addDoc, collection } from 'firebase/firestore'
import { db } from './firebase'
import { getStoredUser } from './auth'

/** Append-only audit entry (records the current user). */
export async function audit(action: string, target: string, detail?: Record<string, unknown>) {
  const u = getStoredUser()
  if (!u || !db) return
  await addDoc(collection(db, 'adminAuditLogs'), {
    actor: u.id,
    actorEmail: u.email ?? null,
    action,
    target,
    detail: detail ?? null,
    createdAt: Date.now(),
  }).catch((e) => console.error('audit failed', e))
}
