/** Animated vector illustration for the login page: gown on a dress form, swaying hanger, flowing thread, sparkles and petals. */
const Spark = ({ x, y, s = 1, d = 0, c = '#f3e3c3' }: { x: number; y: number; s?: number; d?: number; c?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path className="la-twinkle" style={{ animationDelay: `${d}s` }} fill={c} d="M0,-14 C1.5,-5 5,-1.5 14,0 C5,1.5 1.5,5 0,14 C-1.5,5 -5,1.5 -14,0 C-5,-1.5 -1.5,-5 0,-14Z" />
  </g>
)

const petals = [
  { x: 120, d: 0, t: 11, c: '#e9b5bd' }, { x: 210, d: 3, t: 13, c: '#f3e3c3' }, { x: 380, d: 6, t: 12, c: '#e9b5bd' },
  { x: 470, d: 1.5, t: 14, c: '#e8cf9e' }, { x: 300, d: 8, t: 10, c: '#f5e8e6' }, { x: 540, d: 5, t: 12.5, c: '#e9b5bd' },
]

const bokeh = [
  { x: 70, y: 620, r: 10, d: 0, t: 9 }, { x: 540, y: 560, r: 14, d: 2, t: 11 }, { x: 90, y: 440, r: 6, d: 4, t: 8 },
  { x: 520, y: 380, r: 8, d: 1, t: 10 }, { x: 150, y: 700, r: 7, d: 5, t: 12 }, { x: 460, y: 700, r: 9, d: 3, t: 9.5 },
]

export function LoginArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 800" role="img" aria-label="Illustration of a gown on a dress form" className={className} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="la-gown" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#e6a9b3" /><stop offset=".55" stopColor="#b9566f" /><stop offset="1" stopColor="#7d2f48" /></linearGradient>
        <linearGradient id="la-gold" x1="0" x2="1"><stop offset="0" stopColor="#c8a46a" /><stop offset=".5" stopColor="#f3e3c3" /><stop offset="1" stopColor="#c8a46a" /></linearGradient>
        <linearGradient id="la-arch" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity=".16" /><stop offset="1" stopColor="#ffffff" stopOpacity=".02" /></linearGradient>
        <linearGradient id="la-mini" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#f5e8e6" /><stop offset="1" stopColor="#d9a0a0" /></linearGradient>
        <radialGradient id="la-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#e8cf9e" stopOpacity=".55" /><stop offset="1" stopColor="#e8cf9e" stopOpacity="0" /></radialGradient>
        <linearGradient id="la-shine" x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".38" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <clipPath id="la-gownclip"><path d="M258,330 Q279,312 290,326 Q300,336 310,326 Q321,312 342,330 L336,420 C352,500 410,590 442,640 Q372,662 300,650 Q228,638 158,640 C190,590 248,500 264,420 Z" /></clipPath>
      </defs>

      {/* glow behind the arch */}
      <circle className="la-breathe" cx="300" cy="380" r="300" fill="url(#la-glow)" />

      {/* slowly rotating dotted ring */}
      <circle className="la-spin" cx="300" cy="330" r="262" fill="none" stroke="#e8cf9e" strokeOpacity=".45" strokeWidth="1.2" strokeDasharray="2 12" strokeLinecap="round" />
      <circle className="la-spin-rev" cx="300" cy="330" r="236" fill="none" stroke="#e8cf9e" strokeOpacity=".25" strokeWidth="1" strokeDasharray="30 18" />

      {/* arch window */}
      <path d="M110,730 L110,310 A190,190 0 0 1 490,310 L490,730 Z" fill="url(#la-arch)" />
      <path className="la-draw" pathLength={1} d="M110,730 L110,310 A190,190 0 0 1 490,310 L490,730" fill="none" stroke="url(#la-gold)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M134,730 L134,314 A166,166 0 0 1 466,314 L466,730" fill="none" stroke="#e8cf9e" strokeOpacity=".28" strokeWidth="1" />

      {/* floor shadow */}
      <ellipse cx="300" cy="712" rx="170" ry="16" fill="#12060c" opacity=".45" />

      {/* floating bokeh */}
      {bokeh.map((b, i) => <circle key={i} className="la-float" style={{ animationDelay: `${b.d}s`, animationDuration: `${b.t}s` }} cx={b.x} cy={b.y} r={b.r} fill={i % 2 ? '#e8cf9e' : '#e9b5bd'} opacity=".35" />)}

      {/* flowing thread + needle */}
      <path className="la-flow" d="M30,190 C130,130 90,300 170,250 S130,420 220,380 S250,500 300,470" fill="none" stroke="#e8cf9e" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="5 9" opacity=".85" />
      <g className="la-needle">
        <line x1="-26" y1="0" x2="26" y2="0" stroke="url(#la-gold)" strokeWidth="2.4" strokeLinecap="round" />
        <ellipse cx="-20" cy="0" rx="2.6" ry="1.1" fill="#2a1119" />
      </g>

      {/* dress form */}
      <g>
        <rect x="296.5" y="636" width="7" height="60" rx="3" fill="url(#la-gold)" />
        <ellipse cx="300" cy="700" rx="64" ry="10" fill="url(#la-gold)" />
        <ellipse cx="300" cy="697" rx="64" ry="9" fill="#f3e3c3" opacity=".25" />
        {/* torso */}
        <path d="M258,332 C254,312 268,298 290,294 L310,294 C332,298 346,312 342,332 Z" fill="#f5e8e6" />
        <rect x="294" y="262" width="12" height="36" rx="5" fill="#f5e8e6" />
        <circle cx="300" cy="256" r="7" fill="url(#la-gold)" />

        {/* gown (sways gently) */}
        <g className="la-gown">
          <path d="M258,330 Q279,312 290,326 Q300,336 310,326 Q321,312 342,330 L336,420 C352,500 410,590 442,640 Q372,662 300,650 Q228,638 158,640 C190,590 248,500 264,420 Z" fill="url(#la-gown)" />
          {/* pleats */}
          <g stroke="#fff" strokeOpacity=".16" strokeWidth="1.4" fill="none">
            <path d="M286,430 C280,500 250,580 218,646" /><path d="M300,430 C300,510 296,590 296,652" /><path d="M314,430 C320,500 350,580 382,646" />
            <path d="M274,430 C262,500 222,570 186,644" /><path d="M326,430 C338,500 378,570 414,644" />
          </g>
          {/* shimmer sweeping across the fabric */}
          <g clipPath="url(#la-gownclip)"><rect className="la-shimmer" x="-120" y="300" width="110" height="380" fill="url(#la-shine)" transform="skewX(-18)" /></g>
          {/* waist belt + jewel */}
          <path d="M264,414 L336,414 L335,430 L265,430 Z" fill="url(#la-gold)" />
          <circle cx="300" cy="422" r="5.5" fill="#fff" opacity=".9" /><circle cx="300" cy="422" r="2.6" fill="#b9566f" />
          {/* neckline trim + hem trim */}
          <path d="M258,330 Q279,312 290,326 Q300,336 310,326 Q321,312 342,330" fill="none" stroke="url(#la-gold)" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M158,640 Q228,638 300,650 Q372,662 442,640" fill="none" stroke="url(#la-gold)" strokeWidth="3" strokeLinecap="round" />
          <path d="M170,628 Q232,626 300,638 Q368,650 430,628" fill="none" stroke="#f3e3c3" strokeOpacity=".55" strokeWidth="1.2" strokeDasharray="1 8" strokeLinecap="round" />
        </g>
      </g>

      {/* hanging hanger with a small dress */}
      <g className="la-sway">
        <line x1="478" y1="0" x2="478" y2="120" stroke="#e8cf9e" strokeOpacity=".6" strokeWidth="1.2" />
        <path d="M478,138 C478,124 494,122 494,110 C494,100 482,96 476,104" fill="none" stroke="url(#la-gold)" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M478,138 L424,166 Q418,172 426,172 L530,172 Q538,172 532,166 Z" fill="none" stroke="url(#la-gold)" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M446,172 L510,172 L500,198 L534,278 Q478,296 422,278 L456,198 Z" fill="url(#la-mini)" />
        <path d="M456,198 L500,198" stroke="#c8a46a" strokeWidth="3" strokeLinecap="round" />
        <path d="M422,278 Q478,296 534,278" fill="none" stroke="#c8a46a" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* sparkles */}
      <Spark x={92} y={120} s={1.1} d={0} />
      <Spark x={196} y={74} s={0.7} d={0.8} c="#e9b5bd" />
      <Spark x={540} y={470} s={1} d={1.4} />
      <Spark x={72} y={520} s={0.8} d={2.1} c="#e9b5bd" />
      <Spark x={330} y={150} s={0.9} d={0.4} />
      <Spark x={410} y={560} s={0.6} d={1.8} c="#e9b5bd" />
      <Spark x={226} y={280} s={0.6} d={2.6} />

      {/* falling petals */}
      {petals.map((p, i) => (
        <g key={i} transform={`translate(${p.x} -20)`}>
          <ellipse className="la-fall" style={{ animationDelay: `${p.d}s`, animationDuration: `${p.t}s` }} rx="5" ry="9" fill={p.c} opacity=".8" />
        </g>
      ))}
    </svg>
  )
}
