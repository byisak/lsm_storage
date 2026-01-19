/**
 * 데이터 내보내기 유틸리티
 *
 * 재고 데이터, 거래 이력 등을 CSV/Excel 형식으로 내보내기
 */

import { executeQuery } from './mysql'
import { getCompanyId, isMultiTenantEnabled } from './multi-tenant'
import { checkFeature } from './plan-limits'

// ============================================================
// 타입 정의
// ============================================================

export type ExportFormat = 'csv' | 'json'

export interface ExportOptions {
  format?: ExportFormat
  startDate?: Date
  endDate?: Date
  warehouseId?: string
}

interface RackRow {
  itemCode: string
  itemName: string
  Qty: number
  Location: string
  storage: string
  remark: string
  CREATED_DATE: Date
  UPDATED_DATE: Date
}

interface TransactionRow {
  Subul_Time: Date
  SUBUL_TYPE: string
  itemCode: string
  itemName: string
  Qty: number
  Location: string
  FROM_Location: string
  TO_Location: string
  storage: string
  USER_NAME: string
  remark: string
}

interface ItemRow {
  itemCode: string
  itemName: string
  ITEM_SPEC: string
  UNIT: string
  Category: string
}

// ============================================================
// CSV 생성 헬퍼
// ============================================================

/**
 * 데이터를 CSV 문자열로 변환합니다.
 */
export function toCSV<T extends Record<string, unknown>>(
  data: T[],
  headers: { key: keyof T; label: string }[]
): string {
  if (data.length === 0) {
    return headers.map((h) => `"${h.label}"`).join(',') + '\n'
  }

  // BOM 추가 (Excel에서 한글 인식용)
  const BOM = '\uFEFF'

  // 헤더 행
  const headerRow = headers.map((h) => `"${h.label}"`).join(',')

  // 데이터 행
  const dataRows = data.map((row) => {
    return headers
      .map((h) => {
        const value = row[h.key]
        if (value === null || value === undefined) {
          return '""'
        }
        if (value instanceof Date) {
          return `"${value.toISOString().split('T')[0]}"`
        }
        // 문자열 내의 쌍따옴표 이스케이프
        const strValue = String(value).replace(/"/g, '""')
        return `"${strValue}"`
      })
      .join(',')
  })

  return BOM + headerRow + '\n' + dataRows.join('\n')
}

/**
 * 날짜를 한국 형식으로 포맷합니다.
 */
function formatDate(date: Date | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatDateTime(date: Date | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ============================================================
// 재고 데이터 내보내기
// ============================================================

/**
 * 현재 재고 데이터를 내보냅니다.
 */
export async function exportInventory(options: ExportOptions = {}): Promise<{
  data: string
  filename: string
  contentType: string
}> {
  // Excel 내보내기 기능 확인
  if (isMultiTenantEnabled() && options.format !== 'csv') {
    const excelEnabled = await checkFeature('exportExcel')
    if (!excelEnabled) {
      throw new Error('Excel 내보내기 기능은 스탠다드 이상 요금제에서 사용할 수 있습니다.')
    }
  }

  const companyId = await getCompanyId()

  let query = `
    SELECT r.itemCode, r.itemName, r.Qty, r.Location, r.storage,
           r.remark, r.CREATED_DATE, r.UPDATED_DATE
    FROM ls_motor_rack r
  `

  const binds: Record<string, unknown> = {}

  if (isMultiTenantEnabled()) {
    query += ` WHERE r.COMPANY_ID = :companyId`
    binds.companyId = companyId
  } else {
    query += ` WHERE 1=1`
  }

  if (options.warehouseId) {
    query += ` AND r.storage = :warehouseId`
    binds.warehouseId = options.warehouseId
  }

  query += ` ORDER BY r.storage, r.Location, r.itemCode`

  const rows = await executeQuery<RackRow>(query, binds)

  const exportData = rows.map((row) => ({
    itemCode: row.itemCode,
    itemName: row.itemName,
    qty: row.Qty,
    location: row.Location,
    storage: row.storage,
    remark: row.remark || '',
    createdDate: formatDate(row.CREATED_DATE),
    updatedDate: formatDate(row.UPDATED_DATE),
  }))

  const headers = [
    { key: 'itemCode' as const, label: '품목코드' },
    { key: 'itemName' as const, label: '품목명' },
    { key: 'qty' as const, label: '수량' },
    { key: 'location' as const, label: '위치' },
    { key: 'storage' as const, label: '창고' },
    { key: 'remark' as const, label: '비고' },
    { key: 'createdDate' as const, label: '등록일' },
    { key: 'updatedDate' as const, label: '수정일' },
  ]

  if (options.format === 'json') {
    return {
      data: JSON.stringify(exportData, null, 2),
      filename: `inventory_${new Date().toISOString().split('T')[0]}.json`,
      contentType: 'application/json',
    }
  }

  return {
    data: toCSV(exportData, headers),
    filename: `inventory_${new Date().toISOString().split('T')[0]}.csv`,
    contentType: 'text/csv; charset=utf-8',
  }
}

// ============================================================
// 거래 이력 내보내기
// ============================================================

/**
 * 거래 이력을 내보냅니다.
 */
export async function exportTransactions(options: ExportOptions = {}): Promise<{
  data: string
  filename: string
  contentType: string
}> {
  // Excel 내보내기 기능 확인
  if (isMultiTenantEnabled() && options.format !== 'csv') {
    const excelEnabled = await checkFeature('exportExcel')
    if (!excelEnabled) {
      throw new Error('Excel 내보내기 기능은 스탠다드 이상 요금제에서 사용할 수 있습니다.')
    }
  }

  const companyId = await getCompanyId()

  let query = `
    SELECT s.Subul_Time, s.SUBUL_TYPE, s.itemCode, s.itemName, s.Qty,
           s.Location, s.FROM_Location, s.TO_Location, s.storage,
           u.NAME AS USER_NAME, s.remark
    FROM ls_motor_subul s
    LEFT JOIN ls_users u ON s.user = u.ID
  `

  const binds: Record<string, unknown> = {}

  if (isMultiTenantEnabled()) {
    query += ` WHERE s.COMPANY_ID = :companyId`
    binds.companyId = companyId
  } else {
    query += ` WHERE 1=1`
  }

  if (options.warehouseId) {
    query += ` AND s.storage = :warehouseId`
    binds.warehouseId = options.warehouseId
  }

  if (options.startDate) {
    query += ` AND s.Subul_Time >= :startDate`
    binds.startDate = options.startDate
  }

  if (options.endDate) {
    query += ` AND s.Subul_Time <= :endDate`
    binds.endDate = options.endDate
  }

  query += ` ORDER BY s.Subul_Time DESC`

  const rows = await executeQuery<TransactionRow>(query, binds)

  const getTransactionTypeName = (type: string): string => {
    switch (type) {
      case 'IN':
        return '입고'
      case 'OUT':
        return '출고'
      case 'MOVE':
        return '이동'
      case 'ADJ':
        return '조정'
      default:
        return type
    }
  }

  const exportData = rows.map((row) => ({
    datetime: formatDateTime(row.Subul_Time),
    type: getTransactionTypeName(row.SUBUL_TYPE),
    itemCode: row.itemCode,
    itemName: row.itemName,
    qty: row.Qty,
    location: row.Location || '',
    fromLocation: row.FROM_Location || '',
    toLocation: row.TO_Location || '',
    storage: row.storage,
    userName: row.USER_NAME || '',
    remark: row.remark || '',
  }))

  const headers = [
    { key: 'datetime' as const, label: '일시' },
    { key: 'type' as const, label: '유형' },
    { key: 'itemCode' as const, label: '품목코드' },
    { key: 'itemName' as const, label: '품목명' },
    { key: 'qty' as const, label: '수량' },
    { key: 'location' as const, label: '위치' },
    { key: 'fromLocation' as const, label: '출발위치' },
    { key: 'toLocation' as const, label: '도착위치' },
    { key: 'storage' as const, label: '창고' },
    { key: 'userName' as const, label: '담당자' },
    { key: 'remark' as const, label: '비고' },
  ]

  if (options.format === 'json') {
    return {
      data: JSON.stringify(exportData, null, 2),
      filename: `transactions_${new Date().toISOString().split('T')[0]}.json`,
      contentType: 'application/json',
    }
  }

  return {
    data: toCSV(exportData, headers),
    filename: `transactions_${new Date().toISOString().split('T')[0]}.csv`,
    contentType: 'text/csv; charset=utf-8',
  }
}

// ============================================================
// 품목 마스터 내보내기
// ============================================================

/**
 * 품목 마스터 데이터를 내보냅니다.
 */
export async function exportItems(options: ExportOptions = {}): Promise<{
  data: string
  filename: string
  contentType: string
}> {
  const companyId = await getCompanyId()

  let query = `
    SELECT itemCode, itemName, ITEM_SPEC, UNIT, Category
    FROM ls_motor_item
  `

  const binds: Record<string, unknown> = {}

  if (isMultiTenantEnabled()) {
    query += ` WHERE COMPANY_ID = :companyId`
    binds.companyId = companyId
  }

  query += ` ORDER BY itemCode`

  const rows = await executeQuery<ItemRow>(query, binds)

  const exportData = rows.map((row) => ({
    itemCode: row.itemCode,
    itemName: row.itemName,
    itemSpec: row.ITEM_SPEC || '',
    unit: row.UNIT || '',
    category: row.Category || '',
  }))

  const headers = [
    { key: 'itemCode' as const, label: '품목코드' },
    { key: 'itemName' as const, label: '품목명' },
    { key: 'itemSpec' as const, label: '규격' },
    { key: 'unit' as const, label: '단위' },
    { key: 'category' as const, label: '분류' },
  ]

  if (options.format === 'json') {
    return {
      data: JSON.stringify(exportData, null, 2),
      filename: `items_${new Date().toISOString().split('T')[0]}.json`,
      contentType: 'application/json',
    }
  }

  return {
    data: toCSV(exportData, headers),
    filename: `items_${new Date().toISOString().split('T')[0]}.csv`,
    contentType: 'text/csv; charset=utf-8',
  }
}
