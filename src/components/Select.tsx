import ReactSelect, { type StylesConfig } from 'react-select'

export interface Opt { value: string; label: string }

/** "refund_pending" → "Refund Pending" */
export const cap = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const RING = '0 0 0 4px rgba(125, 47, 72, .16)'
const styles = (small: boolean): StylesConfig<Opt, false> => ({
  control: (b, s) => ({ ...b, minHeight: small ? '2rem' : '2.6rem', borderRadius: small ? '.6rem' : '.75rem', borderColor: s.isFocused ? '#7d2f48' : '#ddd0d3', boxShadow: s.isFocused ? RING : 'none', background: s.isDisabled ? '#fbf8f5' : '#fff', cursor: 'pointer', fontSize: small ? '.78rem' : '.9rem', '&:hover': { borderColor: s.isFocused ? '#7d2f48' : '#cbb9be' } }),
  valueContainer: (b) => ({ ...b, padding: small ? '0 .5rem' : '0 .8rem' }),
  singleValue: (b) => ({ ...b, color: '#2a2023' }),
  placeholder: (b) => ({ ...b, color: '#b3a6aa' }),
  input: (b) => ({ ...b, color: '#2a2023' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (b, s) => ({ ...b, color: '#6e5f5f', padding: small ? '0 .4rem' : '0 .65rem', transition: 'transform .2s', transform: s.selectProps.menuIsOpen ? 'rotate(180deg)' : 'none' }),
  menu: (b) => ({ ...b, borderRadius: '.85rem', overflow: 'hidden', border: '1px solid #e8dfd9', boxShadow: '0 18px 40px -16px rgba(60,25,35,.35)', margin: '6px 0', minWidth: '12rem', zIndex: 70 }),
  menuPortal: (b) => ({ ...b, zIndex: 70 }),
  menuList: (b) => ({ ...b, padding: '.35rem', maxHeight: '18rem' }),
  option: (b, s) => ({ ...b, borderRadius: '.55rem', cursor: 'pointer', fontSize: small ? '.78rem' : '.88rem', padding: '.5rem .7rem', background: s.isSelected ? '#6a2540' : s.isFocused ? '#f5e8e6' : 'transparent', color: s.isSelected ? '#fff' : '#2a2023', '&:active': { background: s.isSelected ? '#6a2540' : '#efd9d8' } }),
  noOptionsMessage: (b) => ({ ...b, fontSize: '.85rem', color: '#6e5f5f' }),
})

/** Themed react-select used for every dropdown in the admin. */
export function Select({ value, onChange, options, placeholder = 'Select…', label, small = false, disabled = false, searchable, width, className }: {
  value: string; onChange(v: string): void; options: Opt[]; placeholder?: string; label?: string; small?: boolean; disabled?: boolean; searchable?: boolean; width?: string; className?: string
}) {
  return (
    <div className={className} style={{ width: width ?? '100%', minWidth: width ? undefined : 0 }} onClick={(e) => e.stopPropagation()}>
      <ReactSelect<Opt, false>
        aria-label={label} value={options.find((o) => o.value === value) ?? null} options={options} placeholder={placeholder}
        onChange={(o) => o && onChange(o.value)} isDisabled={disabled} isSearchable={searchable ?? options.length > 8}
        styles={styles(small)} menuPortalTarget={typeof document === 'undefined' ? undefined : document.body} menuPosition="fixed" classNamePrefix="rs"
      />
    </div>
  )
}
