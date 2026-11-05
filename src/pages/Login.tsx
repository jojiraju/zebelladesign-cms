import { useState } from 'react'
import { LoginArt } from '../components/LoginArt'
import { ArrowRight, BarChart3, Eye, EyeOff, Loader2, Lock, Mail, Shirt, ShoppingBag, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { errMsg } from '../lib/util'

export function LoginPage() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null)
    try {
      await fn()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      {/* brand panel */}
      <div className="login-art relative hidden overflow-hidden lg:block" style={{ background: 'radial-gradient(40rem 30rem at 50% 38%, #6b2646 0%, #3a1326 55%, #1d1016 100%)' }}>
        <LoginArt className="absolute inset-x-0 top-6 h-[74%] w-full" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#1d1016] via-[#1d1016]/85 to-transparent" />
        <div className="absolute inset-4 rounded-[1.75rem] border border-[#e8cf9e]/30" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <img src="/brand/logo-full-light.png" alt="Ze Bella" className="w-32" />
          <div>
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.32em] text-[#e8cf9e]">Ze Bella Studio</p>
            <h2 className="mt-3 max-w-md text-5xl leading-[1.08] text-white">Run your store, <em className="text-[#e8cf9e]">beautifully.</em></h2>
            <hr className="hairline mt-5 w-20" />
            <p className="mt-4 max-w-sm text-sm font-light leading-relaxed text-white/75">Products, orders, inventory and every page of your storefront — styled and managed in one place.</p>
            <ul className="mt-6 flex flex-wrap gap-2 text-xs text-white/85">
              {[[Shirt, 'Catalogue'], [ShoppingBag, 'Orders'], [BarChart3, 'Insights']].map(([Icon, t]) => {
                const I = Icon as typeof Shirt
                return <li key={t as string} className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 backdrop-blur"><I size={13} />{t as string}</li>
              })}
            </ul>
          </div>
        </div>
      </div>

      {/* form */}
      <div className="relative grid place-items-center overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#c8a46a]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-gold/20 blur-3xl" />
        <div className="card anim-up relative w-full max-w-[26rem] !p-8 sm:!p-10">
          <img src="/brand/logo-full.png" alt="Ze Bella" className="mx-auto mb-6 w-24 lg:hidden" />
          <p className="eyebrow">Admin portal</p>
          <h1 className="mt-2 text-4xl">Welcome <em className="text-gold-deep">back</em></h1>
          <hr className="hairline mt-3 w-16" />
          <p className="mb-7 mt-3 text-sm text-taupe-deep">Sign in to manage your studio.</p>

          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(() => auth.login(email, password)) }}>
            <label className="block">
              <span className="label">Email</span>
              <span className="relative block">
                <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-taupe" />
                <input className="field !pl-10" type="email" required autoComplete="username" placeholder="you@zebella.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </span>
            </label>
            <label className="block">
              <span className="label">Password</span>
              <span className="relative block">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-taupe" />
                <input className="field !px-10" type={show ? 'text' : 'password'} required autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-taupe-deep hover:bg-gold-soft hover:text-gold-deep">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
            {err && <p role="alert" className="rounded-xl border border-danger/20 bg-[#fbeeec] px-3 py-2 text-sm text-danger">{err}</p>}
            <button className="btn btn-solid mt-2 w-full !min-h-[2.9rem]" disabled={busy}>
              {busy ? <><Loader2 size={16} className="animate-spin" />Signing in…</> : <>Sign in <ArrowRight size={16} /></>}
            </button>
            <div className="flex items-center gap-3 pt-1 text-[0.68rem] uppercase tracking-[0.2em] text-taupe">
              <span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" />
            </div>
            <button type="button" className="btn w-full" onClick={() => auth.devLogin()}>
              <Sparkles size={15} className="text-champagne" />Continue as demo admin
            </button>
          </form>
        </div>
        <p className="absolute bottom-4 text-xs text-taupe">© Ze Bella Designs</p>
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
      await auth.logout()
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) })
    } finally {
      setBusy(false); setSecret('')
    }
  }

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="card w-full max-w-md !p-8">
        <h1 className="text-3xl">No access</h1>
        <p className="mt-3 text-sm text-taupe-deep">{auth.user?.email} is signed in but has no staff role. Ask an administrator to grant one.</p>
        <details className="mt-8 border-t border-line pt-4">
          <summary className="cursor-pointer text-sm font-medium text-gold-deep">First-time setup: claim the initial administrator role</summary>
          <p className="mt-3 text-xs text-taupe-deep">Works once, only while no administrator exists, and only with the <code>ADMIN_BOOTSTRAP_SECRET</code> configured on the server.</p>
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
