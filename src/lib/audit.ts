import { addDoc, collection } from 'firebase/firestore'
import { auth, db } from './firebase'

/** Append-only audit entry (rules force actor == caller uid and forbid edits/deletes). */
export async function audit(action: string, target: string, detail?: Record<string, unknown>) {
  const u = auth.currentUser
  if (!u) return
  await addDoc(collection(db, 'adminAuditLogs'), {
    actor: u.uid, actorEmail: u.email ?? null, action, target, detail: detail ?? null, createdAt: Date.now(),
  }).catch((e) => console.error('audit failed', e))
}
