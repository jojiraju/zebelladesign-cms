/** One definition drives both the on-screen table and the Excel sheet. */
export type ColType = 'text' | 'int' | 'inr' | 'pct' | 'date' | 'dec'
export interface Col<T> { header: string; value(row: T): string | number | null | undefined; type?: ColType; width?: number }
export interface SheetDef<T = any> { name: string; rows: T[]; cols: Col<T>[] } // eslint-disable-line @typescript-eslint/no-explicit-any

export interface ExportMeta { title: string; period: string }

const FMT: Record<ColType, string | undefined> = {
  text: undefined, int: '#,##0', dec: '#,##0.0', inr: '"₹"#,##0.00', pct: '0.0"%"', date: 'dd-mmm-yyyy hh:mm',
}

const safeName = (s: string) => s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet'

/** Builds and downloads an .xlsx workbook (exceljs is loaded on demand). Money is stored in paise and written as rupees. */
export async function exportXlsx(fileName: string, sheets: SheetDef[], meta: ExportMeta) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Zebella CMS'
  wb.created = new Date()

  const info = wb.addWorksheet('Report')
  info.getColumn(1).width = 22
  info.getColumn(2).width = 60
  info.addRow(['Report', meta.title]).font = { bold: true, size: 14, color: { argb: 'FF6A2540' } }
  info.addRow(['Period', meta.period])
  info.addRow(['Generated', new Date().toLocaleString('en-IN')])
  info.addRow(['Sheets', sheets.map((s) => s.name).join(', ')])
  info.getColumn(1).font = { bold: true }

  for (const sh of sheets) {
    const ws = wb.addWorksheet(safeName(sh.name), { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = sh.cols.map((c) => ({ header: c.header, width: c.width ?? Math.max(12, Math.min(40, c.header.length + 4)) }))
    for (const r of sh.rows) {
      ws.addRow(sh.cols.map((c) => {
        const v = c.value(r)
        if (v == null || v === '') return null
        if (c.type === 'inr' && typeof v === 'number') return v / 100
        if (c.type === 'date' && typeof v === 'number') return new Date(v)
        return v
      }))
    }
    sh.cols.forEach((c, i) => { const f = FMT[c.type ?? 'text']; if (f) ws.getColumn(i + 1).numFmt = f })
    const head = ws.getRow(1)
    head.height = 22
    head.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6A2540' } }
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
    })
    if (sh.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sh.cols.length } }
    if (!sh.rows.length) ws.addRow(['No data for this period'])
  }

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
