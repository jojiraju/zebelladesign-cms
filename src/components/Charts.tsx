import { useEffect, useId, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight } from 'lucide-react'

export type Tone = 'rose' | 'violet' | 'sky' | 'emerald' | 'amber'
export const TONE_COLORS: Record<Tone, [string, string]> = {
  rose: ['#f472b6', '#e11d74'], violet: ['#a78bfa', '#6d4aff'], sky: ['#38bdf8', '#0284c7'], emerald: ['#34d399', '#059669'], amber: ['#fbbf24', '#ea8a00'],
}

/** Eases a number up from 0 (skipped when the user prefers reduced motion). */
export function useCountUp(to: number, ms = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); return }
    let raf = 0, t0 = 0
    const tick = (t: number) => {
      t0 ||= t
      const p = Math.min(1, (t - t0) / ms)
      setV(to * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms])
  return v
}

export function Stat({ label, value, format, hint, icon: Icon, tone = 'rose', index = 0 }: { label: string; value: number; format?(v: number): string; hint?: string; icon?: LucideIcon; tone?: Tone; index?: number }) {
  const n = useCountUp(value)
  const [a, b] = TONE_COLORS[tone]
  return (
    <div className="card card-hover anim-up relative overflow-hidden" style={{ ['--i' as string]: index }}>
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${a}, ${b})` }} />
      <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-[.12]" style={{ background: `radial-gradient(circle, ${b}, transparent 70%)` }} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-taupe-deep">{label}</p>
          <p className="mt-2 font-serif text-[1.9rem] font-extrabold leading-none tracking-tight text-espresso">{(format ?? ((x) => String(Math.round(x))))(Math.round(n))}</p>
          {hint && <p className="mt-2.5 flex items-center gap-1 text-xs text-taupe-deep"><ArrowUpRight size={13} style={{ color: b }} />{hint}</p>}
        </div>
        {Icon && <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: `0 8px 20px -8px ${b}` }}><Icon size={20} strokeWidth={1.9} /></div>}
      </div>
    </div>
  )
}

/** Smooth path through points using Catmull-Rom → cubic Bézier. */
function smooth(pts: [number, number][]) {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`
  }
  return d
}

/** Animated gradient area/line chart with hover tooltip and a screen-reader table. */
export function AreaChart({ data, format, label, tone = 'violet' }: { data: { label: string; value: number }[]; format(v: number): string; label: string; tone?: Tone }) {
  const id = useId().replace(/:/g, '')
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [a, b] = TONE_COLORS[tone]
  if (!data.length) return <p className="py-10 text-center text-sm text-taupe-deep">No verified payments in this period yet.</p>
  const W = 720, H = 220, top = 16, padX = 6
  const max = Math.max(1, ...data.map((d) => d.value))
  const x = (i: number) => padX + (data.length === 1 ? (W - padX * 2) / 2 : (i * (W - padX * 2)) / (data.length - 1))
  const y = (v: number) => H - (v / max) * (H - top)
  const pts: [number, number][] = data.map((d, i) => [x(i), y(d.value)])
  const line = smooth(pts)
  const area = `${line} L${x(data.length - 1)},${H} L${x(0)},${H} Z`
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(((px - padX) / (W - padX * 2)) * (data.length - 1)))))
  }
  const h = hover === null ? null : data[hover]
  return (
    <figure className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H + 26}`} role="img" aria-label={label} className="w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`f${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={a} stopOpacity=".4" /><stop offset="1" stopColor={a} stopOpacity="0" /></linearGradient>
          <linearGradient id={`s${id}`} x1="0" x2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1={padX} x2={W - padX} y1={H - g * (H - top)} y2={H - g * (H - top)} stroke="#efe6e8" strokeDasharray="3 5" />)}
        <path d={area} fill={`url(#f${id})`} className="chart-fade" />
        <path d={line} fill="none" stroke={`url(#s${id})`} strokeWidth="3" strokeLinecap="round" pathLength={1} className="chart-draw" />
        {data.map((d, i) => (data.length <= 12 || i % Math.ceil(data.length / 8) === 0) && <text key={d.label} x={x(i)} y={H + 20} textAnchor="middle" fontSize="10" fill="#8a7b81">{d.label.slice(-5)}</text>)}
        {hover !== null && h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={top} y2={H} stroke={b} strokeOpacity=".35" strokeDasharray="4 4" />
            <circle cx={x(hover)} cy={y(h.value)} r="6" fill="#fff" stroke={b} strokeWidth="3" />
          </g>
        )}
      </svg>
      {hover !== null && h && (
        <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-espresso px-3 py-1.5 text-xs text-white shadow-xl" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <p className="text-white/60">{h.label}</p><p className="font-semibold">{format(h.value)}</p>
        </div>
      )}
      <table className="sr-only"><caption>{label}</caption><tbody>{data.map((d) => <tr key={d.label}><th>{d.label}</th><td>{format(d.value)}</td></tr>)}</tbody></table>
    </figure>
  )
}

/** Animated gradient bar chart. */
export function BarChart({ data, format, label, tone = 'rose' }: { data: { label: string; value: number }[]; format(v: number): string; label: string; tone?: Tone }) {
  const id = useId().replace(/:/g, '')
  const [a, b] = TONE_COLORS[tone]
  const max = Math.max(1, ...data.map((d) => d.value))
  const W = 720, H = 200, pad = 8
  const bw = data.length ? (W - pad * 2) / data.length : 0
  if (!data.length) return <p className="py-10 text-center text-sm text-taupe-deep">No verified payments in this period yet.</p>
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 28}`} role="img" aria-label={label} className="w-full">
        <defs><linearGradient id={`b${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
        {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1={pad} x2={W - pad} y1={H - g * (H - 14)} y2={H - g * (H - 14)} stroke="#efe6e8" strokeDasharray="3 5" />)}
        {data.map((d, i) => {
          const h = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * (H - 14))
          return (
            <g key={d.label}>
              <rect className="bar" style={{ animationDelay: `${i * 18}ms` }} x={pad + i * bw + bw * 0.18} y={H - h} width={bw * 0.64} height={h} rx={Math.min(5, bw * 0.25)} fill={`url(#b${id})`} opacity={d.value ? 1 : 0.25}><title>{`${d.label}: ${format(d.value)}`}</title></rect>
              {(data.length <= 12 || i % Math.ceil(data.length / 10) === 0) && <text x={pad + i * bw + bw / 2} y={H + 18} textAnchor="middle" fontSize="10" fill="#8a7b81">{d.label.slice(-5)}</text>}
            </g>
          )
        })}
      </svg>
      <table className="sr-only"><caption>{label}</caption><tbody>{data.map((d) => <tr key={d.label}><th>{d.label}</th><td>{format(d.value)}</td></tr>)}</tbody></table>
    </figure>
  )
}

/** Donut with a legend; each slice draws in. */
export function Donut({ data, label }: { data: { label: string; value: number; color: string }[]; label: string }) {
  const total = data.reduce((n, d) => n + d.value, 0)
  const R = 54, C = 2 * Math.PI * R
  let acc = 0
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 140 140" role="img" aria-label={label} className="h-40 w-40 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#f3eced" strokeWidth="16" />
        {data.filter((d) => d.value > 0).map((d, i) => {
          const len = (d.value / total) * C
          const el = <circle key={d.label} className="donut-seg" style={{ animationDelay: `${i * 120}ms`, ['--len' as string]: len }} cx="70" cy="70" r={R} fill="none" stroke={d.color} strokeWidth="16" strokeLinecap="butt" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc}><title>{`${d.label}: ${d.value}`}</title></circle>
          acc += len
          return el
        })}
        <g className="rotate-90" style={{ transformOrigin: '70px 70px' }}><text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1f1719">{total}</text><text x="70" y="84" textAnchor="middle" fontSize="9" fill="#8a7b81">orders</text></g>
      </svg>
      <ul className="min-w-40 flex-1 space-y-2 text-sm">
        {data.map((d) => (
          <li key={d.label} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.label}</span><b>{d.value}</b></li>
        ))}
      </ul>
    </div>
  )
}
