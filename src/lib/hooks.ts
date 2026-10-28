import { useCallback, useEffect, useState } from 'react'
import { collection, getDocs, query, type QueryConstraint } from 'firebase/firestore'
import { db } from './firebase'
import { errMsg } from './util'

export type Doc<T> = T & { id: string }

/** One-shot collection read with loading/error state. Pass stable (module-level or memoised) constraints. */
export function useDocs<T>(name: string, constraints: QueryConstraint[] = []) {
  const [state, setState] = useState<{ data: Doc<T>[]; loading: boolean; error: string | null }>({ data: [], loading: true, error: null })
  const [n, setN] = useState(0)
  const reload = useCallback(() => setN((x) => x + 1), [])
  // constraints are intentionally read once per (name, reload)
  useEffect(() => {
    let live = true
    getDocs(query(collection(db, name), ...constraints))
      .then((s) => live && setState({ data: s.docs.map((d) => ({ ...(d.data() as T), id: d.id })), loading: false, error: null }))
      .catch((e) => live && setState({ data: [], loading: false, error: errMsg(e) }))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, n])
  return { ...state, reload }
}
