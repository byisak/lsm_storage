/**
 * 공지사항/알림 시스템
 *
 * 슈퍼 관리자가 전체 또는 특정 회사에 공지사항을 발송합니다.
 */

import { executeQuery, executeInsert, executeUpdate, executeDelete } from './mysql'
import { getCompanyId, isMultiTenantEnabled, getTenantSession } from './multi-tenant'
import { getCompanyPlan } from './plan-limits'

// ============================================================
// 타입 정의
// ============================================================

export type AnnouncementType = 'INFO' | 'WARNING' | 'URGENT' | 'MAINTENANCE'
export type AnnouncementTarget = 'ALL' | 'COMPANY' | 'PLAN'
export type AnnouncementStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

export interface Announcement {
  id: number
  title: string
  content: string
  type: AnnouncementType
  target: AnnouncementTarget
  targetCompanyId?: string
  priority: number
  startDate: Date
  endDate?: Date
  status: AnnouncementStatus
  createdBy: number
  createdAt: Date
  updatedAt: Date
  isRead?: boolean
}

interface AnnouncementRow {
  ID: number
  TITLE: string
  CONTENT: string
  TYPE: string
  TARGET: string
  TARGET_COMPANY_ID: string | null
  PRIORITY: number
  START_DATE: Date
  END_DATE: Date | null
  STATUS: string
  CREATED_BY: number
  CREATED_AT: Date
  UPDATED_AT: Date
  IS_READ?: number
}

// ============================================================
// 공지사항 생성 (슈퍼 관리자)
// ============================================================

export interface CreateAnnouncementInput {
  title: string
  content: string
  type?: AnnouncementType
  target?: AnnouncementTarget
  targetCompanyId?: string
  priority?: number
  startDate?: Date
  endDate?: Date
  status?: AnnouncementStatus
}

/**
 * 새 공지사항을 생성합니다. (슈퍼 관리자 전용)
 */
export async function createAnnouncement(
  input: CreateAnnouncementInput
): Promise<Announcement> {
  const session = await getTenantSession()
  if (!session) {
    throw new Error('인증이 필요합니다.')
  }

  // PostgreSQL: INSERT with RETURNING
  const insertResult = await executeQuery<{ ID: number }>(
    `INSERT INTO announcements (
      title, content, type, target, target_company_id,
      priority, start_date, end_date, status, created_by
    ) VALUES (
      :title, :content, :type, :target, :targetCompanyId,
      :priority, :startDate, :endDate, :status, :createdBy
    ) RETURNING id`,
    {
      title: input.title,
      content: input.content,
      type: input.type || 'INFO',
      target: input.target || 'ALL',
      targetCompanyId: input.targetCompanyId || null,
      priority: input.priority || 0,
      startDate: input.startDate || new Date(),
      endDate: input.endDate || null,
      status: input.status || 'ACTIVE',
      createdBy: session.userId,
    }
  )
  const nextId = insertResult[0]?.ID

  if (!nextId) {
    throw new Error('공지사항 생성 실패')
  }

  return {
    id: nextId,
    title: input.title,
    content: input.content,
    type: input.type || 'INFO',
    target: input.target || 'ALL',
    targetCompanyId: input.targetCompanyId,
    priority: input.priority || 0,
    startDate: input.startDate || new Date(),
    endDate: input.endDate,
    status: input.status || 'ACTIVE',
    createdBy: session.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

// ============================================================
// 공지사항 조회
// ============================================================

/**
 * 현재 사용자에게 표시할 활성 공지사항을 조회합니다.
 */
export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const session = await getTenantSession()
  if (!session) {
    return []
  }

  const companyId = session.companyId || await getCompanyId()
  const { planType } = await getCompanyPlan()

  // 활성 공지 조회 (읽음 상태 포함)
  const rows = await executeQuery<AnnouncementRow>(
    `SELECT a.*,
            CASE WHEN ar.USER_ID IS NOT NULL THEN 1 ELSE 0 END AS IS_READ
     FROM ANNOUNCEMENTS a
     LEFT JOIN ANNOUNCEMENT_READS ar ON a.ID = ar.ANNOUNCEMENT_ID AND ar.USER_ID = :userId
     WHERE a.STATUS = 'ACTIVE'
       AND (a.START_DATE IS NULL OR a.START_DATE <= CURRENT_TIMESTAMP)
       AND (a.END_DATE IS NULL OR a.END_DATE >= CURRENT_TIMESTAMP)
       AND (
         a.TARGET = 'ALL'
         OR (a.TARGET = 'COMPANY' AND a.TARGET_COMPANY_ID = :companyId)
         OR (a.TARGET = 'PLAN' AND a.TARGET_COMPANY_ID = :planType)
       )
     ORDER BY a.PRIORITY DESC, a.CREATED_AT DESC`,
    { userId: session.userId, companyId, planType }
  )

  return rows.map(rowToAnnouncement)
}

/**
 * 읽지 않은 공지사항 개수를 조회합니다.
 */
export async function getUnreadAnnouncementCount(): Promise<number> {
  const session = await getTenantSession()
  if (!session) {
    return 0
  }

  const companyId = session.companyId || await getCompanyId()
  const { planType } = await getCompanyPlan()

  const result = await executeQuery<{ CNT: number }>(
    `SELECT COUNT(*) AS CNT
     FROM ANNOUNCEMENTS a
     WHERE a.STATUS = 'ACTIVE'
       AND (a.START_DATE IS NULL OR a.START_DATE <= CURRENT_TIMESTAMP)
       AND (a.END_DATE IS NULL OR a.END_DATE >= CURRENT_TIMESTAMP)
       AND (
         a.TARGET = 'ALL'
         OR (a.TARGET = 'COMPANY' AND a.TARGET_COMPANY_ID = :companyId)
         OR (a.TARGET = 'PLAN' AND a.TARGET_COMPANY_ID = :planType)
       )
       AND NOT EXISTS (
         SELECT 1 FROM ANNOUNCEMENT_READS ar
         WHERE ar.ANNOUNCEMENT_ID = a.ID AND ar.USER_ID = :userId
       )`,
    { companyId, planType, userId: session.userId }
  )

  return result[0]?.CNT || 0
}

/**
 * 전체 공지사항을 조회합니다. (슈퍼 관리자용)
 */
export async function getAllAnnouncements(options: {
  status?: AnnouncementStatus
  limit?: number
  offset?: number
} = {}): Promise<{ announcements: Announcement[]; total: number }> {
  const conditions: string[] = []
  const binds: Record<string, unknown> = {}

  if (options.status) {
    conditions.push('STATUS = :status')
    binds.status = options.status
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // 총 개수
  const countResult = await executeQuery<{ CNT: number }>(
    `SELECT COUNT(*) AS cnt FROM announcements ${whereClause}`,
    binds
  )
  const total = countResult[0]?.CNT || 0

  // 공지 조회 (페이징 - PostgreSQL)
  const limitVal = options.limit || 50
  const offsetVal = options.offset || 0

  const rows = await executeQuery<AnnouncementRow>(
    `SELECT * FROM announcements ${whereClause}
     ORDER BY priority DESC, created_at DESC
     LIMIT :limitVal OFFSET :offsetVal`,
    {
      ...binds,
      limitVal,
      offsetVal,
    }
  )

  return {
    announcements: rows.map(rowToAnnouncement),
    total,
  }
}

// ============================================================
// 공지사항 읽음 처리
// ============================================================

/**
 * 공지사항을 읽음 처리합니다.
 */
export async function markAnnouncementAsRead(announcementId: number): Promise<void> {
  const session = await getTenantSession()
  if (!session) {
    throw new Error('인증이 필요합니다.')
  }

  // 이미 읽음 처리되었는지 확인
  const existing = await executeQuery<{ CNT: number }>(
    `SELECT COUNT(*) AS CNT FROM ANNOUNCEMENT_READS
     WHERE USER_ID = :userId AND ANNOUNCEMENT_ID = :announcementId`,
    { userId: session.userId, announcementId }
  )

  if (existing[0]?.CNT > 0) {
    return // 이미 읽음 처리됨
  }

  await executeInsert(
    `INSERT INTO ANNOUNCEMENT_READS (USER_ID, ANNOUNCEMENT_ID)
     VALUES (:userId, :announcementId)`,
    { userId: session.userId, announcementId }
  )
}

/**
 * 모든 공지사항을 읽음 처리합니다.
 */
export async function markAllAnnouncementsAsRead(): Promise<void> {
  const session = await getTenantSession()
  if (!session) {
    throw new Error('인증이 필요합니다.')
  }

  const companyId = session.companyId || await getCompanyId()
  const { planType } = await getCompanyPlan()

  // 읽지 않은 공지 ID 조회
  const unreadIds = await executeQuery<{ ID: number }>(
    `SELECT a.ID
     FROM ANNOUNCEMENTS a
     WHERE a.STATUS = 'ACTIVE'
       AND (a.START_DATE IS NULL OR a.START_DATE <= CURRENT_TIMESTAMP)
       AND (a.END_DATE IS NULL OR a.END_DATE >= CURRENT_TIMESTAMP)
       AND (
         a.TARGET = 'ALL'
         OR (a.TARGET = 'COMPANY' AND a.TARGET_COMPANY_ID = :companyId)
         OR (a.TARGET = 'PLAN' AND a.TARGET_COMPANY_ID = :planType)
       )
       AND NOT EXISTS (
         SELECT 1 FROM ANNOUNCEMENT_READS ar
         WHERE ar.ANNOUNCEMENT_ID = a.ID AND ar.USER_ID = :userId
       )`,
    { companyId, planType, userId: session.userId }
  )

  // 각 공지를 읽음 처리
  for (const row of unreadIds) {
    await executeInsert(
      `INSERT INTO ANNOUNCEMENT_READS (USER_ID, ANNOUNCEMENT_ID)
       VALUES (:userId, :announcementId)`,
      { userId: session.userId, announcementId: row.ID }
    )
  }
}

// ============================================================
// 공지사항 관리 (슈퍼 관리자)
// ============================================================

/**
 * 공지사항을 수정합니다.
 */
export async function updateAnnouncement(
  id: number,
  input: Partial<CreateAnnouncementInput>
): Promise<boolean> {
  const updates: string[] = []
  const binds: Record<string, unknown> = { id }

  if (input.title !== undefined) {
    updates.push('TITLE = :title')
    binds.title = input.title
  }
  if (input.content !== undefined) {
    updates.push('CONTENT = :content')
    binds.content = input.content
  }
  if (input.type !== undefined) {
    updates.push('TYPE = :type')
    binds.type = input.type
  }
  if (input.target !== undefined) {
    updates.push('TARGET = :target')
    binds.target = input.target
  }
  if (input.targetCompanyId !== undefined) {
    updates.push('TARGET_COMPANY_ID = :targetCompanyId')
    binds.targetCompanyId = input.targetCompanyId || null
  }
  if (input.priority !== undefined) {
    updates.push('PRIORITY = :priority')
    binds.priority = input.priority
  }
  if (input.startDate !== undefined) {
    updates.push('START_DATE = :startDate')
    binds.startDate = input.startDate
  }
  if (input.endDate !== undefined) {
    updates.push('END_DATE = :endDate')
    binds.endDate = input.endDate
  }
  if (input.status !== undefined) {
    updates.push('STATUS = :status')
    binds.status = input.status
  }

  if (updates.length === 0) {
    return false
  }

  updates.push('UPDATED_AT = CURRENT_TIMESTAMP')

  const rowsAffected = await executeUpdate(
    `UPDATE ANNOUNCEMENTS SET ${updates.join(', ')} WHERE ID = :id`,
    binds
  )

  return rowsAffected > 0
}

/**
 * 공지사항을 삭제합니다.
 */
export async function deleteAnnouncement(id: number): Promise<boolean> {
  // 읽음 기록 먼저 삭제
  await executeDelete(
    `DELETE FROM ANNOUNCEMENT_READS WHERE ANNOUNCEMENT_ID = :id`,
    { id }
  )

  const rowsAffected = await executeDelete(
    `DELETE FROM ANNOUNCEMENTS WHERE ID = :id`,
    { id }
  )

  return rowsAffected > 0
}

// ============================================================
// 헬퍼 함수
// ============================================================

function rowToAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.ID,
    title: row.TITLE,
    content: row.CONTENT,
    type: row.TYPE as AnnouncementType,
    target: row.TARGET as AnnouncementTarget,
    targetCompanyId: row.TARGET_COMPANY_ID || undefined,
    priority: row.PRIORITY,
    startDate: row.START_DATE,
    endDate: row.END_DATE || undefined,
    status: row.STATUS as AnnouncementStatus,
    createdBy: row.CREATED_BY,
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT,
    isRead: row.IS_READ === 1,
  }
}
