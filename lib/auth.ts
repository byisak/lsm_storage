/**
 * 서버 측 인증 헬퍼 함수
 *
 * 기존 세션 구조를 유지하면서 회사 정보를 추가합니다.
 * 하위 호환성을 위해 companyId가 없는 세션도 처리합니다.
 */

import { cookies } from 'next/headers'
import { executeQuery } from './mysql'
import { DEFAULT_COMPANY_ID, isMultiTenantEnabled } from './multi-tenant'

// ============================================================
// 타입 정의
// ============================================================

/**
 * 사용자 역할
 * - USER: 일반 사용자
 * - ADMIN: 회사 관리자
 * - SUPER_ADMIN: 슈퍼 관리자 (전체 시스템 관리)
 */
export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN'

/**
 * 기존 세션 구조 (하위 호환)
 */
export interface LegacySession {
  id: number
  name: string
  email: string
  role: UserRole
}

/**
 * 확장된 세션 구조 (멀티테넌트)
 */
export interface AuthSession extends LegacySession {
  companyId: string
  companyName?: string
}

/**
 * 사용자 정보 (API 응답용)
 */
export interface UserInfo {
  id: number
  name: string
  email: string
  role: UserRole
  companyId?: string
  companyName?: string
}

// ============================================================
// 세션 관리
// ============================================================

/**
 * 현재 세션을 가져옵니다.
 * - 하위 호환: companyId가 없으면 기본 회사 ID 사용
 */
export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('auth-session')

  if (!sessionCookie) {
    return null
  }

  try {
    const session = JSON.parse(sessionCookie.value) as LegacySession & { companyId?: string }

    // 하위 호환: companyId가 없으면 기본 회사 ID 사용
    const companyId = session.companyId || DEFAULT_COMPANY_ID

    return {
      id: session.id,
      name: session.name,
      email: session.email,
      role: session.role,
      companyId,
    }
  } catch {
    return null
  }
}

/**
 * 인증이 필요한 API에서 사용하는 헬퍼
 * 세션이 없으면 에러를 throw합니다.
 */
export async function requireAuth(): Promise<AuthSession> {
  const session = await getSession()

  if (!session) {
    throw new AuthError('로그인이 필요합니다.', 401)
  }

  return session
}

/**
 * 관리자 권한이 필요한 API에서 사용하는 헬퍼
 * ADMIN 또는 SUPER_ADMIN 모두 허용
 */
export async function requireAdmin(): Promise<AuthSession> {
  const session = await requireAuth()

  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    throw new AuthError('관리자 권한이 필요합니다.', 403)
  }

  return session
}

/**
 * 슈퍼 관리자 권한이 필요한 API에서 사용하는 헬퍼
 * SUPER_ADMIN만 허용
 */
export async function requireSuperAdmin(): Promise<AuthSession> {
  const session = await requireAuth()

  if (session.role !== 'SUPER_ADMIN') {
    throw new AuthError('슈퍼 관리자 권한이 필요합니다.', 403)
  }

  return session
}

/**
 * 슈퍼 관리자인지 확인
 */
export function isSuperAdmin(session: AuthSession | null): boolean {
  return session?.role === 'SUPER_ADMIN'
}

// ============================================================
// 인증 에러 클래스
// ============================================================

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

// ============================================================
// 세션 생성 헬퍼 (로그인 API에서 사용)
// ============================================================

interface UserWithCompany {
  ID: number
  NAME: string
  EMAIL: string
  PASSWORD: string
  STATUS: 'PENDING' | 'APPROVED' | 'REJECTED'
  ROLE: UserRole
  CREATED_AT: Date
  APPROVED_AT: Date | null
  APPROVED_BY: number | null
  COMPANY_ID: string | null
  COMPANY_NAME?: string
}

/**
 * 사용자 정보로 세션 데이터를 생성합니다.
 * - 멀티테넌트 활성화: DB의 COMPANY_ID 사용
 * - 멀티테넌트 비활성화: 기본 회사 ID 사용
 */
export function createSessionData(user: UserWithCompany): AuthSession {
  // 회사 ID 결정
  let companyId: string

  if (isMultiTenantEnabled()) {
    // 멀티테넌트 모드: 사용자의 회사 ID 사용
    companyId = user.COMPANY_ID || DEFAULT_COMPANY_ID
  } else {
    // 단일 테넌트 모드: 기본 회사 ID 사용
    companyId = DEFAULT_COMPANY_ID
  }

  return {
    id: user.ID,
    name: user.NAME,
    email: user.EMAIL,
    role: user.ROLE,
    companyId,
    companyName: user.COMPANY_NAME,
  }
}

/**
 * 세션 데이터를 API 응답용 사용자 정보로 변환합니다.
 * - 멀티테넌트 활성화: companyId 포함
 * - 멀티테넌트 비활성화: companyId 제외 (하위 호환)
 */
export function toUserInfo(session: AuthSession): UserInfo {
  const userInfo: UserInfo = {
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
  }

  // 멀티테넌트 모드에서만 회사 정보 포함
  if (isMultiTenantEnabled()) {
    userInfo.companyId = session.companyId
    userInfo.companyName = session.companyName
  }

  return userInfo
}

// ============================================================
// 회사별 사용자 조회
// ============================================================

/**
 * 이메일로 사용자를 조회합니다.
 * - 멀티테넌트 활성화: 회사 정보 포함
 * - 멀티테넌트 비활성화: 기존 방식
 */
export async function findUserByEmail(email: string): Promise<UserWithCompany | null> {
  const normalizedEmail = email.toLowerCase()

  if (isMultiTenantEnabled()) {
    // 멀티테넌트: 회사 정보 조인
    const users = await executeQuery<UserWithCompany>(
      `SELECT u.ID, u.NAME, u.EMAIL, u.PASSWORD, u.STATUS, u.ROLE,
              u.CREATED_AT, u.APPROVED_AT, u.APPROVED_BY, u.COMPANY_ID,
              c.NAME AS COMPANY_NAME
       FROM ls_users u
       LEFT JOIN COMPANIES c ON u.COMPANY_ID = c.ID
       WHERE u.EMAIL = :email`,
      { email: normalizedEmail }
    )
    return users[0] || null
  } else {
    // 단일 테넌트: 기존 방식
    const users = await executeQuery<UserWithCompany>(
      `SELECT ID, NAME, EMAIL, PASSWORD, STATUS, ROLE, CREATED_AT, APPROVED_AT, APPROVED_BY
       FROM ls_users
       WHERE EMAIL = :email`,
      { email: normalizedEmail }
    )

    if (users.length === 0) return null

    return {
      ...users[0],
      COMPANY_ID: DEFAULT_COMPANY_ID,
    }
  }
}

// ============================================================
// 회사 ID 헬퍼 (API에서 쉽게 사용)
// ============================================================

/**
 * 현재 세션의 회사 ID를 가져옵니다.
 * 세션이 없으면 기본 회사 ID를 반환합니다.
 */
export async function getCompanyIdFromSession(): Promise<string> {
  const session = await getSession()
  return session?.companyId || DEFAULT_COMPANY_ID
}
