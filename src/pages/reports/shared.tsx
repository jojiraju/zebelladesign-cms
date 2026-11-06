import type { ReactNode } from 'react'
import type { Col, ColType } from '../../lib/excel'

export const col = <T,>(header: string, value: (r: T) => string | number | null | undefined, type?: ColType, width?: number): Col<T> => ({ header, value, type, width })
export const PALETTE = ['#8f3a55', '#c8a46a', '#b9a4b0', '#5a7a5f', '#d9a0a0', '#6e5566', '#e2c791', '#a8b89a']
export const colored = (data: { label: string; value: number }[]) => data.map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }))
export const Grid = ({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 | 6 }) => (
  <div className={`grid gap-4 sm:grid-cols-2 ${cols === 3 ? 'xl:grid-cols-3' : cols === 5 ? 'xl:grid-cols-5' : cols === 6 ? 'xl:grid-cols-3 2xl:grid-cols-6' : cols === 2 ? '' : 'xl:grid-cols-4'}`}>{children}</div>
)
export const Cols2 = ({ children }: { children: ReactNode }) => <div className="mt-4 grid gap-4 lg:grid-cols-2">{children}</div>
export const Gap = ({ children }: { children: ReactNode }) => <div className="mt-4">{children}</div>
export const Heading = ({ children, sub }: { children: ReactNode; sub?: string }) => (
  <div className="mb-3 mt-8 first:mt-0"><p className="eyebrow">{sub}</p><h2 className="mt-1 font-serif text-2xl">{children}</h2><hr className="hairline mt-2 w-16" /></div>
)

export const pl = (n: number, word: string) => `${n.toLocaleString('en-IN')} ${word}${n === 1 ? '' : 's'}`
export const compactINR = (paise: number) => `₹${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(paise / 100)}`
