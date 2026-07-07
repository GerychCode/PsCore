import * as XLSX from 'xlsx-js-style'

export interface ReportDepartment {
  id: number
  name: string
}

export interface ReportShift {
  date: string
  departmentId: number
  totalHours: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
}

export interface WorkHoursReportOptions {
  employeeName: string
  year: number
  month: number
  monthName: string
  departments: ReportDepartment[]
  shifts: ReportShift[]
  onlyApproved?: boolean
  roundToHalfHour?: boolean
  fileName?: string
}

const roundToNearestHalfHour = (hours: number): number =>
  (Math.round((hours * 60) / 30) * 30) / 60

export function exportWorkHoursReport(options: WorkHoursReportOptions): void {
  const {
    employeeName,
    year,
    month,
    monthName,
    departments,
    shifts,
    onlyApproved = true,
    roundToHalfHour = false,
    fileName,
  } = options

  const daysCount = new Date(year, month, 0).getDate()
  const colCount = 2 + departments.length
  const emptyRow = () => new Array(colCount).fill('')

  const hoursByDay: Record<number, Record<number, number>> = {}
  for (const shift of shifts) {
    if (onlyApproved && shift.status !== 'APPROVED') continue
    const date = new Date(shift.date)
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month) continue
    const day = date.getDate()
    if (!hoursByDay[day]) hoursByDay[day] = {}
    hoursByDay[day][shift.departmentId] =
      (hoursByDay[day][shift.departmentId] || 0) + (shift.totalHours || 0)
  }

  const data: (string | number)[][] = []

  data.push(emptyRow())

  const nameRow = emptyRow()
  nameRow[1] = "Прізвище\nта ім'я"
  nameRow[2] = employeeName
  data.push(nameRow)

  data.push(emptyRow())

  const monthRow = emptyRow()
  monthRow[1] = `${monthName} ${year}`
  data.push(monthRow)

  const headerMain = emptyRow()
  headerMain[1] = 'Дні'
  headerMain[2] = 'Години по відділенням'
  data.push(headerMain)

  const headerSub = emptyRow()
  departments.forEach((d, i) => {
    headerSub[2 + i] = d.name
  })
  data.push(headerSub)

  const colTotals = new Array(departments.length).fill(0)
  for (let day = 1; day <= daysCount; day++) {
    const row = emptyRow()
    row[1] = day
    departments.forEach((dept, idx) => {
      let hours = hoursByDay[day]?.[dept.id] || 0
      if (roundToHalfHour) hours = roundToNearestHalfHour(hours)
      if (hours > 0) {
        row[2 + idx] = Number(hours.toFixed(2))
        colTotals[idx] += hours
      }
    })
    data.push(row)
  }

  const totalRow = emptyRow()
  totalRow[1] = 'Всього'
  colTotals.forEach((total, i) => {
    totalRow[2 + i] = Number(total.toFixed(2))
  })
  data.push(totalRow)

  const grandTotal = colTotals.reduce((acc, value) => acc + value, 0)
  const grandRow = emptyRow()
  grandRow[1] = 'Загальна кількість'
  grandRow[2] = Number(grandTotal.toFixed(2))
  data.push(grandRow)

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(data) as any
  const lastRowIndex = data.length - 1
  const lastDeptCol = 2 + departments.length - 1

  worksheet['!merges'] = [
    { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
    { s: { r: 1, c: 2 }, e: { r: 2, c: lastDeptCol } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: 1 + departments.length } },
    { s: { r: 4, c: 2 }, e: { r: 4, c: lastDeptCol } },
    { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } },
    { s: { r: lastRowIndex, c: 2 }, e: { r: lastRowIndex, c: lastDeptCol } },
  ]

  const borderStyle = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  }
  const centerStyle = { horizontal: 'center', vertical: 'center', wrapText: true }
  const boldFont = { bold: true, name: 'Arial' }

  const range = XLSX.utils.decode_range(worksheet['!ref'])

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = worksheet[cellRef]
      if (!cell) continue

      if (!cell.s) cell.s = {}
      cell.s.alignment = centerStyle
      cell.s.font = { name: 'Arial' }

      if ((R === 1 || R === 2) && C === 1) {
        cell.s.font = boldFont
        cell.s.border = borderStyle
        cell.s.alignment = { horizontal: 'center', vertical: 'center', wrapText: true }
      }
      if ((R === 1 || R === 2) && C >= 2) {
        cell.s.font = { name: 'Arial', sz: 12, bold: true }
        cell.s.border = borderStyle
        cell.s.alignment = { horizontal: 'center', vertical: 'center' }
      }

      if (R === 3 && C >= 1) {
        cell.s.font = { bold: true, sz: 12, name: 'Arial' }
        cell.s.border = borderStyle
      }

      if ((R === 4 || R === 5) && C >= 1) {
        cell.s.border = borderStyle
        cell.s.font = boldFont
        cell.s.fill = { fgColor: { rgb: 'EEEEEE' } }
      }

      if (R >= 6 && R <= range.e.r - 2 && C >= 1) {
        cell.s.border = borderStyle
      }

      if (R === range.e.r - 1 && C >= 1) {
        cell.s.border = borderStyle
        cell.s.font = boldFont
        cell.s.fill = { fgColor: { rgb: 'DDDDDD' } }
      }

      if (R === range.e.r) {
        if (C === 1) {
          cell.s.font = { bold: true, sz: 11, name: 'Arial' }
          cell.s.alignment = { horizontal: 'left', vertical: 'center' }
          cell.s.border = borderStyle
        }
        if (C >= 2) {
          cell.s.font = { bold: true, sz: 12, name: 'Arial' }
          cell.s.alignment = { horizontal: 'right', vertical: 'center' }
          cell.s.border = borderStyle
        }
      }
    }
  }

  worksheet['!cols'] = [
    { wch: 2 },
    { wch: 18 },
    ...departments.map(() => ({ wch: 13 })),
  ]

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Звіт')
  const safeName = (fileName || `${employeeName}_${year}_${monthName}`).replace(
    /[\\/:*?"<>|]/g,
    '_',
  )
  XLSX.writeFile(workbook, `${safeName}.xlsx`)
}
