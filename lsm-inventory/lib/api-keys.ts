/**
 * API 키 관리 시스템
 *
 * 외부 시스템에서 API에 접근할 수 있는 키를 관리합니다.
 */

import { executeQuery, executeInsert, executeUpdate, executeDelete } from './postgres'
import { getCompanyId, isMultiTenantEnabled, getTenantSession } from './multi-tenant'
import { checkFeature } from './plan-limits'
import { createHash, randomBytes } from 'crypto'
import { headers } from 'next/headers'

// ============================================================
// 타입 정의
// ============================================================

export type ApiKeyPermission = 'READ' | 'WRITE' | 'DELETE'
export type ApiKeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED'

export interface ApiKey {
  id: number
  companyId: string
  name: string
  keyPrefix: string
  permissions: ApiKeyPermission[]
  lastUsedAt: Date | null
  expiresAt: Date | null
  status: ApiKeyStatus
  createdBy: number
  createdAt: Date
}

interface ApiKeyRow {
  ID: number
  COMPANY_ID: string
  NAME: string
  KEY_PREFIX: string
  KEY_HASH: string
  PERMISSIONS: string
  LAST_USED_AT: Date | null
  EXPIRES_AT: Date | null
  STATUS: string
  CREATED_BY: number
  CREATED_AT: Date
}

// ============================================================
// API 키 생성
// ============================================================

/**
 * 새 API 키를 생성합니다.
 * @returns 생성된 API 키 (한 번만 표시됨)
 */
export async function createApiKey(options: {
  name: string
  permissions?: ApiKeyPermission[]
  expiresInDays?: number
}): Promise<{ apiKey: string; keyInfo: ApiKey }> {
  // API 접근 기능 확인
  if (isMultiTenantEnabled()) {
    const apiAccessEnabled = await checkFeature('apiAccess')
    if (!apiAccessEnabled) {
      throw new Error('API 접근 기능은 프리미엄 이상 요금제에서 사용할 수 있습니다.')
    }
  }

  const session = await getTenantSession()
  if (!session) {
    throw new Error('인증이 필요합니다.')
  }

  const companyId = session.companyId || await getCompanyId()

  // 랜덤 API 키 생성 (32바이트 = 64자 hex)
  const rawKey = randomBytes(32).toString('hex')
  const keyPrefix = rawKey.substring(0, 8) // 앞 8자는 표시용

  // 키 해시 저장 (SHA-256)
  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  // 만료일 계산
  let expiresAt: Date | null = null
  if (options.expiresInDays) {
    expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + options.expiresInDays)
  }

  // 권한 문자열
  const permissions = options.permissions || ['READ']
  const permissionsStr = permissions.join(',')

  // DB에 저장 (PostgreSQL: RETURNING id 사용)
  const insertResult = await executeQuery<{ ID: number }>(
    `INSERT INTO api_keys (company_id, name, key_prefix, key_hash, permissions, expires_at, status, created_by)
     VALUES (:companyId, :name, :keyPrefix, :keyHash, :permissions, :expiresAt, 'ACTIVE', :createdBy)
     RETURNING id`,
    {
      companyId,
      name: options.name,
      keyPrefix,
      keyHash,
      permissions: permissionsStr,
      expiresAt,
      createdBy: session.userId,
    }
  )
  const nextId = insertResult[0]?.ID

  if (!nextId) {
    throw new Error('API 키 생성 실패')
  }

  // 전체 API 키 형식: lsm_{companyId}_{fullKey}
  const fullApiKey = `lsm_${companyId}_${rawKey}`

  return {
    apiKey: fullApiKey,
    keyInfo: {
      id: nextId,
      companyId,
      name: options.name,
      keyPrefix,
      permissions,
      lastUsedAt: null,
      expiresAt,
      status: 'ACTIVE',
      createdBy: session.userId,
      createdAt: new Date(),
    },
  }
}

// ============================================================
// API 키 검증
// ============================================================

export interface ApiKeyValidation {
  valid: boolean
  keyInfo?: ApiKey
  error?: string
}

/**
 * API 키를 검증하고 회사 정보를 반환합니다.
 */
export async function validateApiKey(apiKey: string): Promise<ApiKeyValidation> {
  // 키 형식 확인: lsm_{companyId}_{key}
  const parts = apiKey.split('_')
  if (parts.length !== 3 || parts[0] !== 'lsm') {
    return { valid: false, error: '잘못된 API 키 형식입니다.' }
  }

  const companyId = parts[1]
  const rawKey = parts[2]
  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.substring(0, 8)

  // DB에서 키 조회
  const rows = await executeQuery<ApiKeyRow>(
    `SELECT * FROM API_KEYS
     WHERE COMPANY_ID = :companyId AND KEY_HASH = :keyHash`,
    { companyId, keyHash }
  )

  if (rows.length === 0) {
    return { valid: false, error: 'API 키를 찾을 수 없습니다.' }
  }

  const keyData = rows[0]

  // 상태 확인
  if (keyData.STATUS === 'REVOKED') {
    return { valid: false, error: 'API 키가 비활성화되었습니다.' }
  }

  if (keyData.STATUS === 'EXPIRED') {
    return { valid: false, error: 'API 키가 만료되었습니다.' }
  }

  // 만료일 확인
  if (keyData.EXPIRES_AT && new Date(keyData.EXPIRES_AT) < new Date()) {
    // 만료된 키 상태 업데이트
    await executeUpdate(
      `UPDATE API_KEYS SET STATUS = 'EXPIRED' WHERE ID = :id`,
      { id: keyData.ID }
    )
    return { valid: false, error: 'API 키가 만료되었습니다.' }
  }

  // 마지막 사용 시간 업데이트
  await executeUpdate(
    `UPDATE API_KEYS SET LAST_USED_AT = CURRENT_TIMESTAMP WHERE ID = :id`,
    { id: keyData.ID }
  )

  return {
    valid: true,
    keyInfo: {
      id: keyData.ID,
      companyId: keyData.COMPANY_ID,
      name: keyData.NAME,
      keyPrefix: keyData.KEY_PREFIX,
      permissions: keyData.PERMISSIONS.split(',') as ApiKeyPermission[],
      lastUsedAt: keyData.LAST_USED_AT,
      expiresAt: keyData.EXPIRES_AT,
      status: keyData.STATUS as ApiKeyStatus,
      createdBy: keyData.CREATED_BY,
      createdAt: keyData.CREATED_AT,
    },
  }
}

// ============================================================
// API 키 목록 조회
// ============================================================

/**
 * 회사의 API 키 목록을 조회합니다.
 */
export async function listApiKeys(): Promise<ApiKey[]> {
  const companyId = await getCompanyId()

  const rows = await executeQuery<ApiKeyRow>(
    `SELECT * FROM API_KEYS
     WHERE COMPANY_ID = :companyId
     ORDER BY CREATED_AT DESC`,
    { companyId }
  )

  return rows.map((row) => ({
    id: row.ID,
    companyId: row.COMPANY_ID,
    name: row.NAME,
    keyPrefix: row.KEY_PREFIX,
    permissions: row.PERMISSIONS.split(',') as ApiKeyPermission[],
    lastUsedAt: row.LAST_USED_AT,
    expiresAt: row.EXPIRES_AT,
    status: row.STATUS as ApiKeyStatus,
    createdBy: row.CREATED_BY,
    createdAt: row.CREATED_AT,
  }))
}

// ============================================================
// API 키 관리
// ============================================================

/**
 * API 키를 비활성화합니다.
 */
export async function revokeApiKey(keyId: number): Promise<boolean> {
  const companyId = await getCompanyId()

  const rowsAffected = await executeUpdate(
    `UPDATE API_KEYS SET STATUS = 'REVOKED'
     WHERE ID = :keyId AND COMPANY_ID = :companyId`,
    { keyId, companyId }
  )

  return rowsAffected > 0
}

/**
 * API 키를 삭제합니다.
 */
export async function deleteApiKey(keyId: number): Promise<boolean> {
  const companyId = await getCompanyId()

  const rowsAffected = await executeDelete(
    `DELETE FROM API_KEYS WHERE ID = :keyId AND COMPANY_ID = :companyId`,
    { keyId, companyId }
  )

  return rowsAffected > 0
}

/**
 * API 키 권한을 업데이트합니다.
 */
export async function updateApiKeyPermissions(
  keyId: number,
  permissions: ApiKeyPermission[]
): Promise<boolean> {
  const companyId = await getCompanyId()

  const rowsAffected = await executeUpdate(
    `UPDATE API_KEYS SET PERMISSIONS = :permissions
     WHERE ID = :keyId AND COMPANY_ID = :companyId`,
    { keyId, permissions: permissions.join(','), companyId }
  )

  return rowsAffected > 0
}

// ============================================================
// API 인증 미들웨어 헬퍼
// ============================================================

/**
 * 요청에서 API 키를 추출합니다.
 */
export async function extractApiKey(): Promise<string | null> {
  try {
    const headersList = await headers()

    // Authorization: Bearer lsm_xxx 형식
    const authHeader = headersList.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7)
    }

    // X-API-Key 헤더
    const apiKeyHeader = headersList.get('x-api-key')
    if (apiKeyHeader) {
      return apiKeyHeader
    }

    return null
  } catch {
    return null
  }
}

/**
 * API 요청을 인증합니다.
 */
export async function authenticateApiRequest(): Promise<{
  authenticated: boolean
  companyId?: string
  permissions?: ApiKeyPermission[]
  error?: string
}> {
  const apiKey = await extractApiKey()

  if (!apiKey) {
    return { authenticated: false, error: 'API 키가 필요합니다.' }
  }

  const validation = await validateApiKey(apiKey)

  if (!validation.valid) {
    return { authenticated: false, error: validation.error }
  }

  return {
    authenticated: true,
    companyId: validation.keyInfo!.companyId,
    permissions: validation.keyInfo!.permissions,
  }
}

/**
 * 특정 권한이 있는지 확인합니다.
 */
export function hasPermission(
  permissions: ApiKeyPermission[],
  required: ApiKeyPermission
): boolean {
  // DELETE 권한이 있으면 모든 권한 허용
  if (permissions.includes('DELETE')) {
    return true
  }

  // WRITE 권한이 있으면 READ도 허용
  if (required === 'READ' && permissions.includes('WRITE')) {
    return true
  }

  return permissions.includes(required)
}
