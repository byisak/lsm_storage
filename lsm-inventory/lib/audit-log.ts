/**
 * 감사 로그 헬퍼
 *
 * 시스템의 중요 활동을 추적하고 기록합니다.
 */

import { executeQuery, executeInsert } from './postgres'
import { getCompanyId, isMultiTenantEnabled, getTenantSession } from './multi-tenant'
import { checkFeature } from './plan-limits'
import { headers } from 'next/headers'

// ============================================================
// 타입 정의
// ============================================================

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'IMPORT'
  | 'EXPORT'
  | 'SETTINGS_CHANGE'
  | 'ROLE_CHANGE'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET'

export type ResourceType =
  | 'USER'
  | 'COMPANY'
  | 'WAREHOUSE'
  | 'RACK'
  | 'ITEM'
  | 'TRANSACTION'
  | 'SETTINGS'
  | 'SYSTEM'

export interface AuditLogEntry {
  id: number
  companyId: string
  userId: number
  userName: string
  userEmail: string
  action: AuditAction
  resourceType: ResourceType
  resourceId: string
  description: string
  ipAddress: string
  userAgent: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  createdAt: Date
}

interface AuditLogData {
  action: AuditAction
  resourceType: ResourceType
  resourceId?: string | number
  description?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  // 사용자 정보 (세션 없을 때 사용)
  userId?: number
  userName?: string
  userEmail?: string
  companyId?: string
}

// ============================================================
// 감사 로그 기록
// ============================================================

/**
 * 감사 로그를 기록합니다.
 *
 * @example
 * await logAudit({
 *   action: 'CREATE',
 *   resourceType: 'WAREHOUSE',
 *   resourceId: 'WH001',
 *   description: '창고 생성: 본사 창고',
 *   newValues: { name: '본사 창고', location: '서울' }
 * })
 */
export async function logAudit(data: AuditLogData): Promise<void> {
  try {
    // 감사 로그 기능 사용 가능 여부 확인 (멀티테넌트 모드에서)
    if (isMultiTenantEnabled()) {
      const auditEnabled = await checkFeature('auditLog')
      if (!auditEnabled) {
        // 감사 로그 기능이 비활성화되어 있으면 무시
        return
      }
    }

    // 세션 정보 가져오기
    const session = await getTenantSession()

    // 요청 정보 가져오기
    let ipAddress = ''
    let userAgent = ''

    try {
      const headersList = await headers()
      ipAddress = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                  headersList.get('x-real-ip') ||
                  headersList.get('cf-connecting-ip') ||
                  ''
      userAgent = headersList.get('user-agent') || ''
    } catch {
      // 헤더를 가져올 수 없는 경우 무시
    }

    // 회사 ID 결정
    const companyId = data.companyId || session?.companyId || await getCompanyId()

    // 사용자 정보 결정
    const userId = data.userId || session?.userId
    const userName = data.userName || session?.name || ''
    const userEmail = data.userEmail || session?.email || ''

    // 감사 로그 저장 (PostgreSQL SERIAL 사용)
    await executeInsert(
      `INSERT INTO audit_log (
        company_id, user_id, user_name, user_email,
        action, resource_type, resource_id, description,
        ip_address, user_agent, old_values, new_values
      ) VALUES (
        :companyId, :userId, :userName, :userEmail,
        :action, :resourceType, :resourceId, :description,
        :ipAddress, :userAgent, :oldValues, :newValues
      )`,
      {
        companyId,
        userId: userId || null,
        userName,
        userEmail,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId?.toString() || null,
        description: data.description || null,
        ipAddress,
        userAgent: userAgent.substring(0, 500), // 최대 500자
        oldValues: data.oldValues ? JSON.stringify(data.oldValues) : null,
        newValues: data.newValues ? JSON.stringify(data.newValues) : null,
      }
    )
  } catch (error) {
    // 감사 로그 기록 실패는 조용히 처리 (메인 작업에 영향 주지 않음)
    console.error('Failed to write audit log:', error)
  }
}

// ============================================================
// 편의 함수들
// ============================================================

/**
 * 로그인 성공 로그
 */
export async function logLogin(userId: number, userName: string, userEmail: string, companyId: string): Promise<void> {
  await logAudit({
    action: 'LOGIN',
    resourceType: 'USER',
    resourceId: userId,
    description: `사용자 로그인: ${userEmail}`,
    userId,
    userName,
    userEmail,
    companyId,
  })
}

/**
 * 로그인 실패 로그
 */
export async function logLoginFailed(email: string, reason: string): Promise<void> {
  await logAudit({
    action: 'LOGIN_FAILED',
    resourceType: 'USER',
    description: `로그인 실패 (${email}): ${reason}`,
    userEmail: email,
  })
}

/**
 * 로그아웃 로그
 */
export async function logLogout(): Promise<void> {
  await logAudit({
    action: 'LOGOUT',
    resourceType: 'USER',
    description: '사용자 로그아웃',
  })
}

/**
 * 리소스 생성 로그
 */
export async function logCreate(
  resourceType: ResourceType,
  resourceId: string | number,
  description: string,
  newValues?: Record<string, unknown>
): Promise<void> {
  await logAudit({
    action: 'CREATE',
    resourceType,
    resourceId,
    description,
    newValues,
  })
}

/**
 * 리소스 수정 로그
 */
export async function logUpdate(
  resourceType: ResourceType,
  resourceId: string | number,
  description: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
): Promise<void> {
  await logAudit({
    action: 'UPDATE',
    resourceType,
    resourceId,
    description,
    oldValues,
    newValues,
  })
}

/**
 * 리소스 삭제 로그
 */
export async function logDelete(
  resourceType: ResourceType,
  resourceId: string | number,
  description: string,
  oldValues?: Record<string, unknown>
): Promise<void> {
  await logAudit({
    action: 'DELETE',
    resourceType,
    resourceId,
    description,
    oldValues,
  })
}

/**
 * 설정 변경 로그
 */
export async function logSettingsChange(
  description: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
): Promise<void> {
  await logAudit({
    action: 'SETTINGS_CHANGE',
    resourceType: 'SETTINGS',
    description,
    oldValues,
    newValues,
  })
}

// ============================================================
// 감사 로그 조회
// ============================================================

interface AuditLogRow {
  ID: number
  COMPANY_ID: string
  USER_ID: number
  USER_NAME: string
  USER_EMAIL: string
  ACTION: string
  RESOURCE_TYPE: string
  RESOURCE_ID: string
  DESCRIPTION: string
  IP_ADDRESS: string
  USER_AGENT: string
  OLD_VALUES: string | null
  NEW_VALUES: string | null
  CREATED_AT: Date
}

export interface AuditLogFilter {
  companyId?: string
  userId?: number
  action?: AuditAction
  resourceType?: ResourceType
  resourceId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

/**
 * 감사 로그를 조회합니다.
 */
export async function getAuditLogs(filter: AuditLogFilter = {}): Promise<{
  logs: AuditLogEntry[]
  total: number
}> {
  const conditions: string[] = []
  const binds: Record<string, unknown> = {}

  // 기본 회사 필터
  const companyId = filter.companyId || await getCompanyId()
  conditions.push('COMPANY_ID = :companyId')
  binds.companyId = companyId

  // 추가 필터
  if (filter.userId) {
    conditions.push('USER_ID = :userId')
    binds.userId = filter.userId
  }

  if (filter.action) {
    conditions.push('ACTION = :action')
    binds.action = filter.action
  }

  if (filter.resourceType) {
    conditions.push('RESOURCE_TYPE = :resourceType')
    binds.resourceType = filter.resourceType
  }

  if (filter.resourceId) {
    conditions.push('RESOURCE_ID = :resourceId')
    binds.resourceId = filter.resourceId
  }

  if (filter.startDate) {
    conditions.push('CREATED_AT >= :startDate')
    binds.startDate = filter.startDate
  }

  if (filter.endDate) {
    conditions.push('CREATED_AT <= :endDate')
    binds.endDate = filter.endDate
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // 총 개수 조회
  const countResult = await executeQuery<{ CNT: number }>(
    `SELECT COUNT(*) AS cnt FROM audit_log ${whereClause}`,
    binds
  )
  const total = countResult[0]?.CNT || 0

  // 로그 조회 (페이징 - PostgreSQL)
  const limitVal = filter.limit || 50
  const offsetVal = filter.offset || 0

  const rows = await executeQuery<AuditLogRow>(
    `SELECT * FROM audit_log ${whereClause}
     ORDER BY created_at DESC
     LIMIT :limitVal OFFSET :offsetVal`,
    {
      ...binds,
      limitVal,
      offsetVal,
    }
  )

  const logs: AuditLogEntry[] = rows.map((row) => ({
    id: row.ID,
    companyId: row.COMPANY_ID,
    userId: row.USER_ID,
    userName: row.USER_NAME,
    userEmail: row.USER_EMAIL,
    action: row.ACTION as AuditAction,
    resourceType: row.RESOURCE_TYPE as ResourceType,
    resourceId: row.RESOURCE_ID,
    description: row.DESCRIPTION,
    ipAddress: row.IP_ADDRESS,
    userAgent: row.USER_AGENT,
    oldValues: row.OLD_VALUES ? JSON.parse(row.OLD_VALUES) : undefined,
    newValues: row.NEW_VALUES ? JSON.parse(row.NEW_VALUES) : undefined,
    createdAt: row.CREATED_AT,
  }))

  return { logs, total }
}

// ============================================================
// 슈퍼 관리자용 전체 로그 조회
// ============================================================

/**
 * 전체 시스템 감사 로그를 조회합니다. (슈퍼 관리자용)
 */
export async function getAllAuditLogs(filter: Omit<AuditLogFilter, 'companyId'> & { companyId?: string } = {}): Promise<{
  logs: AuditLogEntry[]
  total: number
}> {
  const conditions: string[] = []
  const binds: Record<string, unknown> = {}

  // 회사 필터 (선택적)
  if (filter.companyId) {
    conditions.push('COMPANY_ID = :companyId')
    binds.companyId = filter.companyId
  }

  // 추가 필터
  if (filter.userId) {
    conditions.push('USER_ID = :userId')
    binds.userId = filter.userId
  }

  if (filter.action) {
    conditions.push('ACTION = :action')
    binds.action = filter.action
  }

  if (filter.resourceType) {
    conditions.push('RESOURCE_TYPE = :resourceType')
    binds.resourceType = filter.resourceType
  }

  if (filter.resourceId) {
    conditions.push('RESOURCE_ID = :resourceId')
    binds.resourceId = filter.resourceId
  }

  if (filter.startDate) {
    conditions.push('CREATED_AT >= :startDate')
    binds.startDate = filter.startDate
  }

  if (filter.endDate) {
    conditions.push('CREATED_AT <= :endDate')
    binds.endDate = filter.endDate
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // 총 개수 조회
  const countResult = await executeQuery<{ CNT: number }>(
    `SELECT COUNT(*) AS cnt FROM audit_log ${whereClause}`,
    binds
  )
  const total = countResult[0]?.CNT || 0

  // 로그 조회 (페이징 - PostgreSQL)
  const limitVal = filter.limit || 50
  const offsetVal = filter.offset || 0

  const rows = await executeQuery<AuditLogRow>(
    `SELECT * FROM audit_log ${whereClause}
     ORDER BY created_at DESC
     LIMIT :limitVal OFFSET :offsetVal`,
    {
      ...binds,
      limitVal,
      offsetVal,
    }
  )

  const logs: AuditLogEntry[] = rows.map((row) => ({
    id: row.ID,
    companyId: row.COMPANY_ID,
    userId: row.USER_ID,
    userName: row.USER_NAME,
    userEmail: row.USER_EMAIL,
    action: row.ACTION as AuditAction,
    resourceType: row.RESOURCE_TYPE as ResourceType,
    resourceId: row.RESOURCE_ID,
    description: row.DESCRIPTION,
    ipAddress: row.IP_ADDRESS,
    userAgent: row.USER_AGENT,
    oldValues: row.OLD_VALUES ? JSON.parse(row.OLD_VALUES) : undefined,
    newValues: row.NEW_VALUES ? JSON.parse(row.NEW_VALUES) : undefined,
    createdAt: row.CREATED_AT,
  }))

  return { logs, total }
}
