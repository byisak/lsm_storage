/**
 * 멀티테넌트 헬퍼 함수
 *
 * 핵심 원칙:
 * 1. 하위 호환성 - MULTI_TENANT_ENABLED=false면 기존처럼 동작
 * 2. 점진적 전환 - Feature Flag로 on/off 가능
 * 3. 자동 필터링 - 쿼리에 COMPANY_ID 조건 자동 추가
 */

import { cookies } from 'next/headers'
import { executeQuery } from './mysql'

// ============================================================
// 설정
// ============================================================

/**
 * 멀티테넌트 활성화 여부
 * .env에 MULTI_TENANT_ENABLED=true 설정
 */
export function isMultiTenantEnabled(): boolean {
  return process.env.MULTI_TENANT_ENABLED === 'true'
}

/**
 * 기본 회사 ID (LS Mecapion)
 * 멀티테넌트가 비활성화되어 있을 때 사용
 */
export const DEFAULT_COMPANY_ID = 'LSMECA'

// ============================================================
// 회사 정보 타입
// ============================================================

export interface Company {
  id: string
  name: string
  businessNumber?: string
  representative?: string
  phone?: string
  email?: string
  address?: string
  logoUrl?: string
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED'
  planType: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE'
  maxUsers: number
  maxWarehouses: number
  createdAt: Date
  updatedAt: Date
}

// ============================================================
// 세션 타입 확장
// ============================================================

export interface TenantSession {
  userId: number
  companyId: string
  email: string
  name: string
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
  // 회사 정보 (옵션)
  company?: {
    id: string
    name: string
    logoUrl?: string
  }
}

// ============================================================
// 세션에서 회사 ID 추출
// ============================================================

/**
 * 현재 세션에서 회사 ID를 추출합니다.
 * - 멀티테넌트 비활성화: 기본 회사 ID 반환
 * - 멀티테넌트 활성화: 세션에서 회사 ID 추출
 */
export async function getCompanyId(): Promise<string> {
  // 멀티테넌트가 비활성화되어 있으면 기본 회사 ID 반환
  if (!isMultiTenantEnabled()) {
    return DEFAULT_COMPANY_ID
  }

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('auth-session')

  if (!sessionCookie) {
    return DEFAULT_COMPANY_ID
  }

  try {
    const session = JSON.parse(sessionCookie.value)
    return session.companyId || DEFAULT_COMPANY_ID
  } catch {
    return DEFAULT_COMPANY_ID
  }
}

/**
 * 현재 세션에서 전체 테넌트 정보를 추출합니다.
 */
export async function getTenantSession(): Promise<TenantSession | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('auth-session')

  if (!sessionCookie) {
    return null
  }

  try {
    const session = JSON.parse(sessionCookie.value)

    // 기본 회사 ID 설정 (멀티테넌트 비활성화시)
    const companyId = session.companyId ||
      (isMultiTenantEnabled() ? null : DEFAULT_COMPANY_ID)

    if (!companyId) {
      return null
    }

    return {
      userId: session.userId,
      companyId,
      email: session.email || '',
      name: session.name || '',
      role: session.role || 'USER',
    }
  } catch {
    return null
  }
}

// ============================================================
// 회사 정보 조회
// ============================================================

interface CompanyRow {
  ID: string
  NAME: string
  BUSINESS_NUMBER: string | null
  REPRESENTATIVE: string | null
  PHONE: string | null
  EMAIL: string | null
  ADDRESS: string | null
  LOGO_URL: string | null
  STATUS: string
  PLAN_TYPE: string
  MAX_USERS: number
  MAX_WAREHOUSES: number
  CREATED_AT: Date
  UPDATED_AT: Date
}

/**
 * 회사 ID로 회사 정보를 조회합니다.
 */
export async function getCompanyById(companyId: string): Promise<Company | null> {
  const rows = await executeQuery<CompanyRow>(
    `SELECT * FROM COMPANIES WHERE ID = :companyId AND STATUS != 'DELETED'`,
    { companyId }
  )

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]
  return {
    id: row.ID,
    name: row.NAME,
    businessNumber: row.BUSINESS_NUMBER || undefined,
    representative: row.REPRESENTATIVE || undefined,
    phone: row.PHONE || undefined,
    email: row.EMAIL || undefined,
    address: row.ADDRESS || undefined,
    logoUrl: row.LOGO_URL || undefined,
    status: row.STATUS as Company['status'],
    planType: row.PLAN_TYPE as Company['planType'],
    maxUsers: row.MAX_USERS,
    maxWarehouses: row.MAX_WAREHOUSES,
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT,
  }
}

/**
 * 현재 세션의 회사 정보를 조회합니다.
 */
export async function getCurrentCompany(): Promise<Company | null> {
  const companyId = await getCompanyId()
  return getCompanyById(companyId)
}

// ============================================================
// 쿼리 헬퍼 - COMPANY_ID 필터 자동 추가
// ============================================================

/**
 * 회사 ID 바인드 파라미터를 추가합니다.
 * 기존 바인드 파라미터에 companyId를 추가하여 반환합니다.
 * 멀티테넌트가 비활성화되면 원본 바인드만 반환합니다.
 */
export async function withCompanyId<T extends Record<string, unknown>>(
  binds: T
): Promise<T & { companyId?: string }> {
  // 멀티테넌트 비활성화시 companyId 추가하지 않음
  if (!isMultiTenantEnabled()) {
    return binds as T & { companyId?: string }
  }
  const companyId = await getCompanyId()
  return { ...binds, companyId }
}

/**
 * SQL 쿼리에 COMPANY_ID 조건을 추가합니다.
 * 멀티테넌트가 비활성화되면 원본 SQL을 그대로 반환합니다.
 *
 * @example
 * // Before
 * const sql = "SELECT * FROM ls_motor_rack WHERE LOCATION = :location"
 *
 * // After
 * const sql = addCompanyFilter("SELECT * FROM ls_motor_rack WHERE LOCATION = :location")
 * // Result: "SELECT * FROM ls_motor_rack WHERE LOCATION = :location AND COMPANY_ID = :companyId"
 */
export function addCompanyFilter(sql: string): string {
  // 멀티테넌트 비활성화시 원본 SQL 반환
  if (!isMultiTenantEnabled()) {
    return sql
  }

  // WHERE 절이 있는지 확인
  const hasWhere = /\bWHERE\b/i.test(sql)

  if (hasWhere) {
    // WHERE 절 뒤에 AND COMPANY_ID = :companyId 추가
    // ORDER BY, GROUP BY, LIMIT 등 앞에 추가해야 함
    const insertPoint = sql.search(/\b(ORDER\s+BY|GROUP\s+BY|LIMIT|OFFSET|FETCH|$)/i)
    const beforeInsert = sql.slice(0, insertPoint).trimEnd()
    const afterInsert = sql.slice(insertPoint)

    return `${beforeInsert} AND COMPANY_ID = :companyId ${afterInsert}`
  } else {
    // WHERE 절이 없으면 FROM 테이블 뒤에 WHERE 추가
    const insertPoint = sql.search(/\b(ORDER\s+BY|GROUP\s+BY|LIMIT|OFFSET|FETCH|$)/i)
    const beforeInsert = sql.slice(0, insertPoint).trimEnd()
    const afterInsert = sql.slice(insertPoint)

    return `${beforeInsert} WHERE COMPANY_ID = :companyId ${afterInsert}`
  }
}

// ============================================================
// INSERT 헬퍼 - 자동으로 COMPANY_ID 추가
// ============================================================

/**
 * INSERT 쿼리에 COMPANY_ID 컬럼과 값을 추가합니다.
 * 멀티테넌트가 비활성화되면 원본 SQL을 그대로 반환합니다.
 *
 * @example
 * const sql = "INSERT INTO ls_motor_rack (STORAGE, LOCATION) VALUES (:storage, :location)"
 * const result = addCompanyToInsert(sql)
 * // Result: "INSERT INTO ls_motor_rack (STORAGE, LOCATION, COMPANY_ID) VALUES (:storage, :location, :companyId)"
 */
export function addCompanyToInsert(sql: string): string {
  // 멀티테넌트 비활성화시 원본 SQL 반환
  if (!isMultiTenantEnabled()) {
    return sql
  }

  // INSERT INTO table (columns) VALUES (values) 형태 파싱
  const match = sql.match(
    /INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i
  )

  if (!match) {
    // 매칭 실패시 원본 반환 (수동으로 처리 필요)
    console.warn('addCompanyToInsert: Could not parse INSERT statement')
    return sql
  }

  const [, table, columns, values] = match
  const newColumns = `${columns.trim()}, COMPANY_ID`
  const newValues = `${values.trim()}, :companyId`

  return `INSERT INTO ${table} (${newColumns}) VALUES (${newValues})`
}

// ============================================================
// 권한 검증 헬퍼
// ============================================================

/**
 * 리소스가 현재 회사 소유인지 검증합니다.
 * 멀티테넌트가 비활성화되면 항상 true를 반환합니다.
 */
export async function verifyResourceOwnership(
  tableName: string,
  resourceId: number | string,
  idColumn: string = 'ID'
): Promise<boolean> {
  // 멀티테넌트 비활성화시 항상 true 반환
  if (!isMultiTenantEnabled()) {
    return true
  }

  const companyId = await getCompanyId()

  const rows = await executeQuery<{ COMPANY_ID: string }>(
    `SELECT COMPANY_ID FROM ${tableName} WHERE ${idColumn} = :resourceId`,
    { resourceId }
  )

  if (rows.length === 0) {
    return false // 리소스가 존재하지 않음
  }

  return rows[0].COMPANY_ID === companyId
}

/**
 * 사용자가 특정 회사에 속해있는지 검증합니다.
 * 멀티테넌트가 비활성화되면 항상 true를 반환합니다.
 */
export async function verifyUserCompany(
  userId: number,
  companyId: string
): Promise<boolean> {
  // 멀티테넌트 비활성화시 항상 true 반환
  if (!isMultiTenantEnabled()) {
    return true
  }

  const rows = await executeQuery<{ COMPANY_ID: string }>(
    `SELECT COMPANY_ID FROM ls_users WHERE ID = :userId`,
    { userId }
  )

  if (rows.length === 0) {
    return false
  }

  return rows[0].COMPANY_ID === companyId
}

// ============================================================
// 회사 관리 함수 (관리자용)
// ============================================================

/**
 * 새 회사를 생성합니다.
 */
export async function createCompany(data: {
  id?: string
  name: string
  businessNumber?: string
  representative?: string
  phone?: string
  email?: string
  address?: string
  planType?: Company['planType']
}): Promise<string> {
  // ID 생성 (없으면 자동 생성)
  const companyId = data.id || `COMP${Date.now().toString(36).toUpperCase()}`

  await executeQuery(
    `INSERT INTO COMPANIES (
      ID, NAME, BUSINESS_NUMBER, REPRESENTATIVE, PHONE, EMAIL, ADDRESS, PLAN_TYPE
    ) VALUES (
      :id, :name, :businessNumber, :representative, :phone, :email, :address, :planType
    )`,
    {
      id: companyId,
      name: data.name,
      businessNumber: data.businessNumber || null,
      representative: data.representative || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      planType: data.planType || 'BASIC',
    }
  )

  return companyId
}

/**
 * 회사 정보를 수정합니다.
 */
export async function updateCompany(
  companyId: string,
  data: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> {
  const updates: string[] = []
  const binds: Record<string, unknown> = { companyId }

  if (data.name !== undefined) {
    updates.push('NAME = :name')
    binds.name = data.name
  }
  if (data.businessNumber !== undefined) {
    updates.push('BUSINESS_NUMBER = :businessNumber')
    binds.businessNumber = data.businessNumber
  }
  if (data.representative !== undefined) {
    updates.push('REPRESENTATIVE = :representative')
    binds.representative = data.representative
  }
  if (data.phone !== undefined) {
    updates.push('PHONE = :phone')
    binds.phone = data.phone
  }
  if (data.email !== undefined) {
    updates.push('EMAIL = :email')
    binds.email = data.email
  }
  if (data.address !== undefined) {
    updates.push('ADDRESS = :address')
    binds.address = data.address
  }
  if (data.logoUrl !== undefined) {
    updates.push('LOGO_URL = :logoUrl')
    binds.logoUrl = data.logoUrl
  }
  if (data.status !== undefined) {
    updates.push('STATUS = :status')
    binds.status = data.status
  }
  if (data.planType !== undefined) {
    updates.push('PLAN_TYPE = :planType')
    binds.planType = data.planType
  }
  if (data.maxUsers !== undefined) {
    updates.push('MAX_USERS = :maxUsers')
    binds.maxUsers = data.maxUsers
  }
  if (data.maxWarehouses !== undefined) {
    updates.push('MAX_WAREHOUSES = :maxWarehouses')
    binds.maxWarehouses = data.maxWarehouses
  }

  if (updates.length === 0) {
    return false
  }

  updates.push('UPDATED_AT = CURRENT_TIMESTAMP')

  await executeQuery(
    `UPDATE COMPANIES SET ${updates.join(', ')} WHERE ID = :companyId`,
    binds
  )

  return true
}

// ============================================================
// 회사 통계 조회
// ============================================================

export interface CompanyStats {
  userCount: number
  warehouseCount: number
  rackCount: number
  itemCount: number
}

/**
 * 현재 회사의 통계를 조회합니다.
 * 멀티테넌트가 비활성화되면 전체 통계를 반환합니다.
 */
export async function getCompanyStats(): Promise<CompanyStats> {
  interface CountRow { CNT: number }

  // 멀티테넌트 비활성화시 전체 통계 반환
  if (!isMultiTenantEnabled()) {
    const [users, warehouses, racks, items] = await Promise.all([
      executeQuery<CountRow>(`SELECT COUNT(*) AS CNT FROM ls_users`),
      executeQuery<CountRow>(`SELECT COUNT(*) AS CNT FROM ls_warehouses`),
      executeQuery<CountRow>(`SELECT COUNT(*) AS CNT FROM ls_motor_rack`),
      executeQuery<CountRow>(`SELECT COUNT(*) AS CNT FROM ls_motor_item`),
    ])

    return {
      userCount: users[0]?.CNT || 0,
      warehouseCount: warehouses[0]?.CNT || 0,
      rackCount: racks[0]?.CNT || 0,
      itemCount: items[0]?.CNT || 0,
    }
  }

  const companyId = await getCompanyId()

  const [users, warehouses, racks, items] = await Promise.all([
    executeQuery<CountRow>(
      `SELECT COUNT(*) AS CNT FROM ls_users WHERE COMPANY_ID = :companyId`,
      { companyId }
    ),
    executeQuery<CountRow>(
      `SELECT COUNT(*) AS CNT FROM ls_warehouses WHERE COMPANY_ID = :companyId`,
      { companyId }
    ),
    executeQuery<CountRow>(
      `SELECT COUNT(*) AS CNT FROM ls_motor_rack WHERE COMPANY_ID = :companyId`,
      { companyId }
    ),
    executeQuery<CountRow>(
      `SELECT COUNT(*) AS CNT FROM ls_motor_item WHERE COMPANY_ID = :companyId`,
      { companyId }
    ),
  ])

  return {
    userCount: users[0]?.CNT || 0,
    warehouseCount: warehouses[0]?.CNT || 0,
    rackCount: racks[0]?.CNT || 0,
    itemCount: items[0]?.CNT || 0,
  }
}
