/**
 * 요금제별 기능 제한 설정
 *
 * 각 요금제에 따라 사용 가능한 리소스 한도를 정의합니다.
 */

import { executeQuery } from './mysql'
import { getCompanyId, isMultiTenantEnabled } from './multi-tenant'

// ============================================================
// 요금제 타입
// ============================================================

export type PlanType = 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE'

// ============================================================
// 요금제별 제한 설정
// ============================================================

export interface PlanLimits {
  maxUsers: number
  maxWarehouses: number
  maxRacks: number
  maxItemsPerMonth: number // 월간 입고 가능 품목 수
  features: {
    multiWarehouse: boolean    // 다중 창고 지원
    advancedReports: boolean   // 고급 리포트
    apiAccess: boolean         // API 접근
    bulkImport: boolean        // 대량 데이터 가져오기
    customBranding: boolean    // 커스텀 브랜딩
    prioritySupport: boolean   // 우선 지원
    auditLog: boolean          // 감사 로그
    exportPdf: boolean         // PDF 내보내기
    exportExcel: boolean       // Excel 내보내기
  }
}

// 요금제별 기본 제한값
export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  BASIC: {
    maxUsers: 3,
    maxWarehouses: 1,
    maxRacks: 100,
    maxItemsPerMonth: 500,
    features: {
      multiWarehouse: false,
      advancedReports: false,
      apiAccess: false,
      bulkImport: false,
      customBranding: false,
      prioritySupport: false,
      auditLog: false,
      exportPdf: true,
      exportExcel: false,
    },
  },
  STANDARD: {
    maxUsers: 10,
    maxWarehouses: 3,
    maxRacks: 500,
    maxItemsPerMonth: 2000,
    features: {
      multiWarehouse: true,
      advancedReports: true,
      apiAccess: false,
      bulkImport: true,
      customBranding: false,
      prioritySupport: false,
      auditLog: true,
      exportPdf: true,
      exportExcel: true,
    },
  },
  PREMIUM: {
    maxUsers: 30,
    maxWarehouses: 10,
    maxRacks: 2000,
    maxItemsPerMonth: 10000,
    features: {
      multiWarehouse: true,
      advancedReports: true,
      apiAccess: true,
      bulkImport: true,
      customBranding: true,
      prioritySupport: true,
      auditLog: true,
      exportPdf: true,
      exportExcel: true,
    },
  },
  ENTERPRISE: {
    maxUsers: -1,  // 무제한
    maxWarehouses: -1,
    maxRacks: -1,
    maxItemsPerMonth: -1,
    features: {
      multiWarehouse: true,
      advancedReports: true,
      apiAccess: true,
      bulkImport: true,
      customBranding: true,
      prioritySupport: true,
      auditLog: true,
      exportPdf: true,
      exportExcel: true,
    },
  },
}

// ============================================================
// 요금제 정보 조회
// ============================================================

interface CompanyPlanRow {
  PLAN_TYPE: string
  MAX_USERS: number
  MAX_WAREHOUSES: number
}

/**
 * 현재 회사의 요금제 정보를 조회합니다.
 */
export async function getCompanyPlan(): Promise<{ planType: PlanType; limits: PlanLimits }> {
  // 멀티테넌트가 비활성화되어 있으면 엔터프라이즈 제한 적용
  if (!isMultiTenantEnabled()) {
    return {
      planType: 'ENTERPRISE',
      limits: PLAN_LIMITS.ENTERPRISE,
    }
  }

  const companyId = await getCompanyId()

  const rows = await executeQuery<CompanyPlanRow>(
    `SELECT PLAN_TYPE, MAX_USERS, MAX_WAREHOUSES FROM COMPANIES WHERE ID = :companyId`,
    { companyId }
  )

  if (rows.length === 0) {
    // 회사가 없으면 기본 요금제
    return {
      planType: 'BASIC',
      limits: PLAN_LIMITS.BASIC,
    }
  }

  const planType = (rows[0].PLAN_TYPE || 'BASIC') as PlanType
  const baseLimits = PLAN_LIMITS[planType] || PLAN_LIMITS.BASIC

  // DB에 저장된 커스텀 제한이 있으면 적용
  const customLimits = {
    ...baseLimits,
    maxUsers: rows[0].MAX_USERS || baseLimits.maxUsers,
    maxWarehouses: rows[0].MAX_WAREHOUSES || baseLimits.maxWarehouses,
  }

  return {
    planType,
    limits: customLimits,
  }
}

// ============================================================
// 제한 검사 함수
// ============================================================

interface CountResult {
  CNT: number
}

export interface LimitCheckResult {
  allowed: boolean
  current: number
  limit: number
  message?: string
}

/**
 * 사용자 추가 가능 여부를 확인합니다.
 */
export async function checkUserLimit(): Promise<LimitCheckResult> {
  if (!isMultiTenantEnabled()) {
    return { allowed: true, current: 0, limit: -1 }
  }

  const companyId = await getCompanyId()
  const { limits } = await getCompanyPlan()

  // 무제한인 경우
  if (limits.maxUsers === -1) {
    return { allowed: true, current: 0, limit: -1 }
  }

  const rows = await executeQuery<CountResult>(
    `SELECT COUNT(*) AS CNT FROM LS_USERS WHERE COMPANY_ID = :companyId AND STATUS != 'DELETED'`,
    { companyId }
  )

  const current = rows[0]?.CNT || 0

  if (current >= limits.maxUsers) {
    return {
      allowed: false,
      current,
      limit: limits.maxUsers,
      message: `사용자 수가 요금제 한도(${limits.maxUsers}명)에 도달했습니다. 업그레이드가 필요합니다.`,
    }
  }

  return { allowed: true, current, limit: limits.maxUsers }
}

/**
 * 창고 추가 가능 여부를 확인합니다.
 */
export async function checkWarehouseLimit(): Promise<LimitCheckResult> {
  if (!isMultiTenantEnabled()) {
    return { allowed: true, current: 0, limit: -1 }
  }

  const companyId = await getCompanyId()
  const { limits } = await getCompanyPlan()

  // 무제한인 경우
  if (limits.maxWarehouses === -1) {
    return { allowed: true, current: 0, limit: -1 }
  }

  const rows = await executeQuery<CountResult>(
    `SELECT COUNT(*) AS CNT FROM LS_WAREHOUSES WHERE COMPANY_ID = :companyId`,
    { companyId }
  )

  const current = rows[0]?.CNT || 0

  if (current >= limits.maxWarehouses) {
    return {
      allowed: false,
      current,
      limit: limits.maxWarehouses,
      message: `창고 수가 요금제 한도(${limits.maxWarehouses}개)에 도달했습니다. 업그레이드가 필요합니다.`,
    }
  }

  return { allowed: true, current, limit: limits.maxWarehouses }
}

/**
 * 재고 항목 추가 가능 여부를 확인합니다.
 */
export async function checkRackLimit(): Promise<LimitCheckResult> {
  if (!isMultiTenantEnabled()) {
    return { allowed: true, current: 0, limit: -1 }
  }

  const companyId = await getCompanyId()
  const { limits } = await getCompanyPlan()

  // 무제한인 경우
  if (limits.maxRacks === -1) {
    return { allowed: true, current: 0, limit: -1 }
  }

  const rows = await executeQuery<CountResult>(
    `SELECT COUNT(*) AS CNT FROM LS_MOTOR_RACK WHERE COMPANY_ID = :companyId`,
    { companyId }
  )

  const current = rows[0]?.CNT || 0

  if (current >= limits.maxRacks) {
    return {
      allowed: false,
      current,
      limit: limits.maxRacks,
      message: `재고 항목이 요금제 한도(${limits.maxRacks}개)에 도달했습니다. 업그레이드가 필요합니다.`,
    }
  }

  return { allowed: true, current, limit: limits.maxRacks }
}

// ============================================================
// 기능 사용 가능 여부 확인
// ============================================================

export type FeatureKey = keyof PlanLimits['features']

/**
 * 특정 기능의 사용 가능 여부를 확인합니다.
 */
export async function checkFeature(feature: FeatureKey): Promise<boolean> {
  if (!isMultiTenantEnabled()) {
    return true // 싱글테넌트 모드에서는 모든 기능 사용 가능
  }

  const { limits } = await getCompanyPlan()
  return limits.features[feature]
}

/**
 * 여러 기능의 사용 가능 여부를 한 번에 확인합니다.
 */
export async function checkFeatures(features: FeatureKey[]): Promise<Record<FeatureKey, boolean>> {
  if (!isMultiTenantEnabled()) {
    return features.reduce((acc, feature) => {
      acc[feature] = true
      return acc
    }, {} as Record<FeatureKey, boolean>)
  }

  const { limits } = await getCompanyPlan()
  return features.reduce((acc, feature) => {
    acc[feature] = limits.features[feature]
    return acc
  }, {} as Record<FeatureKey, boolean>)
}

// ============================================================
// 요금제 비교 및 업그레이드 정보
// ============================================================

export interface PlanInfo {
  type: PlanType
  name: string
  description: string
  limits: PlanLimits
  price?: {
    monthly: number
    yearly: number
  }
}

export const PLAN_INFO: PlanInfo[] = [
  {
    type: 'BASIC',
    name: '베이직',
    description: '소규모 사업장을 위한 기본 요금제',
    limits: PLAN_LIMITS.BASIC,
    price: { monthly: 0, yearly: 0 },
  },
  {
    type: 'STANDARD',
    name: '스탠다드',
    description: '성장하는 비즈니스를 위한 표준 요금제',
    limits: PLAN_LIMITS.STANDARD,
    price: { monthly: 29000, yearly: 290000 },
  },
  {
    type: 'PREMIUM',
    name: '프리미엄',
    description: '중대형 기업을 위한 프리미엄 요금제',
    limits: PLAN_LIMITS.PREMIUM,
    price: { monthly: 99000, yearly: 990000 },
  },
  {
    type: 'ENTERPRISE',
    name: '엔터프라이즈',
    description: '대기업 맞춤형 무제한 요금제',
    limits: PLAN_LIMITS.ENTERPRISE,
    price: undefined, // 문의
  },
]

/**
 * 요금제 업그레이드 필요 여부를 확인합니다.
 */
export async function getUpgradeRecommendation(): Promise<{
  needsUpgrade: boolean
  currentPlan: PlanType
  recommendedPlan?: PlanType
  reasons: string[]
}> {
  const companyId = await getCompanyId()
  const { planType, limits } = await getCompanyPlan()

  const reasons: string[] = []

  // 사용자 수 확인
  const userResult = await checkUserLimit()
  if (!userResult.allowed || (userResult.limit > 0 && userResult.current >= userResult.limit * 0.8)) {
    reasons.push(`사용자 한도 ${userResult.current}/${userResult.limit} 사용 중`)
  }

  // 창고 수 확인
  const warehouseResult = await checkWarehouseLimit()
  if (!warehouseResult.allowed || (warehouseResult.limit > 0 && warehouseResult.current >= warehouseResult.limit * 0.8)) {
    reasons.push(`창고 한도 ${warehouseResult.current}/${warehouseResult.limit} 사용 중`)
  }

  // 재고 수 확인
  const rackResult = await checkRackLimit()
  if (!rackResult.allowed || (rackResult.limit > 0 && rackResult.current >= rackResult.limit * 0.8)) {
    reasons.push(`재고 항목 한도 ${rackResult.current}/${rackResult.limit} 사용 중`)
  }

  const needsUpgrade = reasons.length > 0

  // 추천 요금제 결정
  let recommendedPlan: PlanType | undefined
  if (needsUpgrade) {
    const planOrder: PlanType[] = ['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE']
    const currentIndex = planOrder.indexOf(planType)
    if (currentIndex < planOrder.length - 1) {
      recommendedPlan = planOrder[currentIndex + 1]
    }
  }

  return {
    needsUpgrade,
    currentPlan: planType,
    recommendedPlan,
    reasons,
  }
}
