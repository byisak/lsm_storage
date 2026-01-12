/**
 * 데이터 가져오기 유틸리티
 *
 * CSV 파일에서 재고 데이터, 품목 마스터 등을 가져오기
 */

import { executeQuery, executeInsert, executeUpdate, getConnection } from './postgres'
import { getCompanyId, isMultiTenantEnabled } from './multi-tenant'
import { checkFeature, checkRackLimit } from './plan-limits'
import { logCreate } from './audit-log'

// ============================================================
// 타입 정의
// ============================================================

export interface ImportResult {
  success: boolean
  totalRows: number
  importedRows: number
  skippedRows: number
  errors: ImportError[]
}

export interface ImportError {
  row: number
  field?: string
  value?: string
  message: string
}

export interface ImportOptions {
  skipDuplicates?: boolean
  updateExisting?: boolean
}

// ============================================================
// CSV 파싱 헬퍼
// ============================================================

/**
 * CSV 문자열을 파싱합니다.
 */
export function parseCSV(csvContent: string): string[][] {
  const lines = csvContent.split(/\r?\n/)
  const result: string[][] = []

  for (const line of lines) {
    if (!line.trim()) continue

    const row: string[] = []
    let currentField = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentField += '"'
          i++ // 다음 따옴표 건너뛰기
        } else if (char === '"') {
          inQuotes = false
        } else {
          currentField += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ',') {
          row.push(currentField.trim())
          currentField = ''
        } else {
          currentField += char
        }
      }
    }

    row.push(currentField.trim())
    result.push(row)
  }

  return result
}

/**
 * CSV 데이터를 객체 배열로 변환합니다.
 */
export function csvToObjects<T>(
  csvContent: string,
  mapping: Record<string, keyof T>
): { data: Partial<T>[]; headers: string[] } {
  const rows = parseCSV(csvContent)

  if (rows.length === 0) {
    return { data: [], headers: [] }
  }

  // BOM 제거
  const headers = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim())
  const data: Partial<T>[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.length === 0 || row.every((cell) => !cell)) continue

    const obj: Partial<T> = {}

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]
      const key = mapping[header]
      if (key && row[j] !== undefined) {
        (obj as Record<string, unknown>)[key as string] = row[j]
      }
    }

    data.push(obj)
  }

  return { data, headers }
}

// ============================================================
// 품목 마스터 가져오기
// ============================================================

interface ItemImportData {
  itemCode: string
  itemName: string
  itemSpec?: string
  unit?: string
  category?: string
}

const ITEM_CSV_MAPPING: Record<string, keyof ItemImportData> = {
  품목코드: 'itemCode',
  품목명: 'itemName',
  규격: 'itemSpec',
  단위: 'unit',
  분류: 'category',
  // 영문 헤더 지원
  itemCode: 'itemCode',
  itemName: 'itemName',
  itemSpec: 'itemSpec',
  unit: 'unit',
  category: 'category',
}

/**
 * 품목 마스터 데이터를 가져옵니다.
 */
export async function importItems(
  csvContent: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  // 대량 가져오기 기능 확인
  if (isMultiTenantEnabled()) {
    const bulkImportEnabled = await checkFeature('bulkImport')
    if (!bulkImportEnabled) {
      throw new Error('대량 데이터 가져오기 기능은 스탠다드 이상 요금제에서 사용할 수 있습니다.')
    }
  }

  const companyId = await getCompanyId()
  const { data } = csvToObjects<ItemImportData>(csvContent, ITEM_CSV_MAPPING)

  const result: ImportResult = {
    success: true,
    totalRows: data.length,
    importedRows: 0,
    skippedRows: 0,
    errors: [],
  }

  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    const rowNum = i + 2 // 1-based, 헤더 다음 행부터

    // 필수 필드 확인
    if (!item.itemCode || !item.itemName) {
      result.errors.push({
        row: rowNum,
        message: '품목코드와 품목명은 필수입니다.',
      })
      result.skippedRows++
      continue
    }

    try {
      // 중복 확인
      const existing = await executeQuery<{ CNT: number }>(
        isMultiTenantEnabled()
          ? `SELECT COUNT(*) AS CNT FROM LS_MOTOR_ITEM WHERE ITEM_CODE = :itemCode AND COMPANY_ID = :companyId`
          : `SELECT COUNT(*) AS CNT FROM LS_MOTOR_ITEM WHERE ITEM_CODE = :itemCode`,
        isMultiTenantEnabled() ? { itemCode: item.itemCode, companyId } : { itemCode: item.itemCode }
      )

      if (existing[0]?.CNT > 0) {
        if (options.updateExisting) {
          // 기존 항목 업데이트
          await executeUpdate(
            isMultiTenantEnabled()
              ? `UPDATE LS_MOTOR_ITEM SET ITEM_NAME = :itemName, ITEM_SPEC = :itemSpec, UNIT = :unit, CATEGORY = :category WHERE ITEM_CODE = :itemCode AND COMPANY_ID = :companyId`
              : `UPDATE LS_MOTOR_ITEM SET ITEM_NAME = :itemName, ITEM_SPEC = :itemSpec, UNIT = :unit, CATEGORY = :category WHERE ITEM_CODE = :itemCode`,
            isMultiTenantEnabled()
              ? { ...item, companyId }
              : item
          )
          result.importedRows++
        } else if (options.skipDuplicates) {
          result.skippedRows++
        } else {
          result.errors.push({
            row: rowNum,
            field: 'itemCode',
            value: item.itemCode,
            message: '이미 존재하는 품목코드입니다.',
          })
          result.skippedRows++
        }
        continue
      }

      // 새 품목 추가
      await executeInsert(
        isMultiTenantEnabled()
          ? `INSERT INTO LS_MOTOR_ITEM (ITEM_CODE, ITEM_NAME, ITEM_SPEC, UNIT, CATEGORY, COMPANY_ID) VALUES (:itemCode, :itemName, :itemSpec, :unit, :category, :companyId)`
          : `INSERT INTO LS_MOTOR_ITEM (ITEM_CODE, ITEM_NAME, ITEM_SPEC, UNIT, CATEGORY) VALUES (:itemCode, :itemName, :itemSpec, :unit, :category)`,
        isMultiTenantEnabled()
          ? {
              itemCode: item.itemCode,
              itemName: item.itemName,
              itemSpec: item.itemSpec || null,
              unit: item.unit || null,
              category: item.category || null,
              companyId,
            }
          : {
              itemCode: item.itemCode,
              itemName: item.itemName,
              itemSpec: item.itemSpec || null,
              unit: item.unit || null,
              category: item.category || null,
            }
      )

      result.importedRows++
    } catch (error) {
      result.errors.push({
        row: rowNum,
        message: error instanceof Error ? error.message : '알 수 없는 오류',
      })
      result.skippedRows++
    }
  }

  // 감사 로그
  await logCreate('ITEM', 'bulk-import', `품목 대량 가져오기: ${result.importedRows}건 처리`, {
    totalRows: result.totalRows,
    importedRows: result.importedRows,
    skippedRows: result.skippedRows,
    errorCount: result.errors.length,
  })

  return result
}

// ============================================================
// 재고 데이터 가져오기
// ============================================================

interface InventoryImportData {
  itemCode: string
  itemName?: string
  qty: string
  location: string
  storage: string
  remark?: string
}

const INVENTORY_CSV_MAPPING: Record<string, keyof InventoryImportData> = {
  품목코드: 'itemCode',
  품목명: 'itemName',
  수량: 'qty',
  위치: 'location',
  창고: 'storage',
  비고: 'remark',
  // 영문 헤더 지원
  itemCode: 'itemCode',
  itemName: 'itemName',
  qty: 'qty',
  location: 'location',
  storage: 'storage',
  remark: 'remark',
}

/**
 * 재고 데이터를 가져옵니다.
 */
export async function importInventory(
  csvContent: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  // 대량 가져오기 기능 확인
  if (isMultiTenantEnabled()) {
    const bulkImportEnabled = await checkFeature('bulkImport')
    if (!bulkImportEnabled) {
      throw new Error('대량 데이터 가져오기 기능은 스탠다드 이상 요금제에서 사용할 수 있습니다.')
    }

    // 재고 한도 확인
    const limitCheck = await checkRackLimit()
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.message)
    }
  }

  const companyId = await getCompanyId()
  const { data } = csvToObjects<InventoryImportData>(csvContent, INVENTORY_CSV_MAPPING)

  const result: ImportResult = {
    success: true,
    totalRows: data.length,
    importedRows: 0,
    skippedRows: 0,
    errors: [],
  }

  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    const rowNum = i + 2

    // 필수 필드 확인
    if (!item.itemCode || !item.qty || !item.location || !item.storage) {
      result.errors.push({
        row: rowNum,
        message: '품목코드, 수량, 위치, 창고는 필수입니다.',
      })
      result.skippedRows++
      continue
    }

    const qty = parseInt(item.qty, 10)
    if (isNaN(qty) || qty < 0) {
      result.errors.push({
        row: rowNum,
        field: 'qty',
        value: item.qty,
        message: '수량은 0 이상의 숫자여야 합니다.',
      })
      result.skippedRows++
      continue
    }

    try {
      // 품목 마스터에서 품목명 가져오기
      let itemName = item.itemName
      if (!itemName) {
        const itemMaster = await executeQuery<{ ITEM_NAME: string }>(
          isMultiTenantEnabled()
            ? `SELECT ITEM_NAME FROM LS_MOTOR_ITEM WHERE ITEM_CODE = :itemCode AND COMPANY_ID = :companyId`
            : `SELECT ITEM_NAME FROM LS_MOTOR_ITEM WHERE ITEM_CODE = :itemCode`,
          isMultiTenantEnabled() ? { itemCode: item.itemCode, companyId } : { itemCode: item.itemCode }
        )
        itemName = itemMaster[0]?.ITEM_NAME || item.itemCode
      }

      // 중복 확인 (같은 위치에 같은 품목)
      const existing = await executeQuery<{ SEQ: number }>(
        isMultiTenantEnabled()
          ? `SELECT SEQ FROM LS_MOTOR_RACK WHERE ITEM_CODE = :itemCode AND LOCATION = :location AND STORAGE = :storage AND COMPANY_ID = :companyId`
          : `SELECT SEQ FROM LS_MOTOR_RACK WHERE ITEM_CODE = :itemCode AND LOCATION = :location AND STORAGE = :storage`,
        isMultiTenantEnabled()
          ? { itemCode: item.itemCode, location: item.location, storage: item.storage, companyId }
          : { itemCode: item.itemCode, location: item.location, storage: item.storage }
      )

      if (existing.length > 0) {
        if (options.updateExisting) {
          // 기존 재고 업데이트
          await executeUpdate(
            `UPDATE LS_MOTOR_RACK SET QTY = :qty, ITEM_NAME = :itemName, REMARK = :remark, UPDATED_DATE = CURRENT_TIMESTAMP WHERE SEQ = :seq`,
            {
              qty,
              itemName,
              remark: item.remark || null,
              seq: existing[0].SEQ,
            }
          )
          result.importedRows++
        } else if (options.skipDuplicates) {
          result.skippedRows++
        } else {
          result.errors.push({
            row: rowNum,
            message: `같은 위치에 같은 품목이 이미 존재합니다: ${item.location}`,
          })
          result.skippedRows++
        }
        continue
      }

      // 새 재고 추가
      const seqResult = await executeQuery<{ NEXT_SEQ: number }>(
        `SELECT COALESCE(MAX(SEQ), 0) + 1 AS NEXT_SEQ FROM LS_MOTOR_RACK`
      )
      const nextSeq = seqResult[0]?.NEXT_SEQ || 1

      await executeInsert(
        isMultiTenantEnabled()
          ? `INSERT INTO LS_MOTOR_RACK (SEQ, ITEM_CODE, ITEM_NAME, QTY, LOCATION, STORAGE, REMARK, COMPANY_ID, CREATED_DATE, UPDATED_DATE) VALUES (:seq, :itemCode, :itemName, :qty, :location, :storage, :remark, :companyId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          : `INSERT INTO LS_MOTOR_RACK (SEQ, ITEM_CODE, ITEM_NAME, QTY, LOCATION, STORAGE, REMARK, CREATED_DATE, UPDATED_DATE) VALUES (:seq, :itemCode, :itemName, :qty, :location, :storage, :remark, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        isMultiTenantEnabled()
          ? {
              seq: nextSeq,
              itemCode: item.itemCode,
              itemName,
              qty,
              location: item.location,
              storage: item.storage,
              remark: item.remark || null,
              companyId,
            }
          : {
              seq: nextSeq,
              itemCode: item.itemCode,
              itemName,
              qty,
              location: item.location,
              storage: item.storage,
              remark: item.remark || null,
            }
      )

      result.importedRows++
    } catch (error) {
      result.errors.push({
        row: rowNum,
        message: error instanceof Error ? error.message : '알 수 없는 오류',
      })
      result.skippedRows++
    }
  }

  // 감사 로그
  await logCreate('RACK', 'bulk-import', `재고 대량 가져오기: ${result.importedRows}건 처리`, {
    totalRows: result.totalRows,
    importedRows: result.importedRows,
    skippedRows: result.skippedRows,
    errorCount: result.errors.length,
  })

  return result
}
