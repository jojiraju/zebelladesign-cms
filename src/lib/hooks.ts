import { useCallback, useEffect, useState } from 'react'
import { apiList } from './api'
import { errMsg } from './util'

export type Doc<T> = T & { id: string }

/** One-shot list read with loading/error state. */
export function useList<T>(path: string, params?: Record<string, string | number | undefined>) {
  const [state, setState] = useState<{ data: Doc<T>[]; count: number; loading: boolean; error: string | null }>({ data: [], count: 0, loading: true, error: null })
  const [n, setN] = useState(0)
  const reload = useCallback(() => setN((x) => x + 1), [])
  const key = JSON.stringify(params ?? {})
  useEffect(() => {
    let live = true
    apiList<Doc<T>>(path, params)
      .then((r) => live && setState({ data: r.results, count: r.count, loading: false, error: null }))
      .catch((e) => live && setState({ data: [], count: 0, loading: false, error: errMsg(e) }))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, n])
  return { ...state, reload }
}
