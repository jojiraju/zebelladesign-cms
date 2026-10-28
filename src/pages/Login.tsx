import { useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { isConfigured } from '../lib/firebase'
import { errMsg } from '../lib/util'

export function LoginPage() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null)
    try { await fn() } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      setErr(code.startsWith('auth/') ? 'Those credentials were not accepted.' : errMsg(e))
    } finally { setBusy(false) }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-espresso p-12 lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold-deep/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
        <img src="/brand/logo-full-light.png" alt="Ze Bella" className="relative w-36" />
        <div className="relative">
          <h2 className="max-w-md text-4xl font-bold leading-tight text-white">Run your store, beautifully.</h2>
          <p className="mt-4 max-w-sm text-ivory/60">Manage products, orders, inventory and your storefront content — all in one place.</p>
        </div>
        <p className="relative text-xs text-ivory/40">Ze Bella Studio CMS</p>
      </div>
      <div className="grid place-items-center p-6">
        <div className="w-full max-w-sm">
          <img src="/brand/logo-full.png" alt="Ze Bella" className="mb-8 w-32 lg:hidden" />
          <h1 className="text-3xl">Welcome back</h1>
          <p className="mb-8 mt-1.5 text-sm text-taupe-deep">Sign in to your studio account.</p>
          {!isConfigured && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Firebase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and fill in your project values.</p>}
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(() => auth.login(email, password)) }}>
            <label className="block"><span className="label">Email</span><input className="field" type="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="block"><span className="label">Password</span><input className="field" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{err}</p>}
            <button className="btn btn-solid w-full" disabled={busy || !isConfigured}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <div className="flex items-center gap-3 text-xs text-taupe"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
            <button type="button" className="btn w-full" disabled={busy || !isConfigured} onClick={() => run(auth.google)}>Continue with Google</button>
          </form>
          <p className="mt-6 text-xs text-taupe-deep">Staff accounts are created by an administrator. Signing in alone does not grant access.</p>
        </div>
      </div>
    </main>
  )
}

/** Shown to a signed-in user who has no staff role. Offers the one-time first-admin claim. */
export function NoAccessPage() {
  const auth = useAuth()
  const [secret, setSecret] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function claim() {
    setBusy(true); setMsg(null)
    try {
      const r = await api<{ message: string }>('/api/admin/bootstrap', { method: 'POST', body: JSON.stringify({ secret }) })
      setMsg({ ok: true, text: r.message })
      await auth.logout() // old token has no claim; sign in again to pick up the new role
    } catch (e) { setMsg({ ok: false, text: errMsg(e) }) } finally { setBusy(false); setSecret('') }
  }

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="card w-full max-w-md !p-8">
        <h1 className="text-3xl">No access</h1>
        <p className="mt-3 text-sm text-taupe-deep">{auth.user?.email} is signed in but has no staff role. Ask an administrator to grant one.</p>
        <details className="mt-8 border-t border-line pt-4">
          <summary className="cursor-pointer text-sm font-medium text-gold-deep">First-time setup: claim the initial administrator role</summary>
          <p className="mt-3 text-xs text-taupe-deep">Works once, only while no administrator exists, and only with the <code>ADMIN_BOOTSTRAP_SECRET</code> configured on the storefront server. Your email must be verified.</p>
          <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); void claim() }}>
            <input className="field" type="password" autoComplete="off" placeholder="Bootstrap secret" value={secret} onChange={(e) => setSecret(e.target.value)} />
            <button className="btn btn-solid" disabled={busy || secret.length < 8}>{busy ? 'Checking…' : 'Claim admin role'}</button>
          </form>
          {msg && <p role="status" className={`mt-3 text-sm ${msg.ok ? 'text-ok' : 'text-danger'}`}>{msg.text}</p>}
        </details>
        <button className="btn mt-8" onClick={() => auth.logout()}>Sign out</button>
      </div>
    </main>
  )
}
