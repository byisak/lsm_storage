import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'
import {
  getCompanyPlan,
  checkUserLimit,
  checkWarehouseLimit,
  checkRackLimit,
  checkFeatures,
  getUpgradeRecommendation,
  PLAN_INFO,
  FeatureKey,
} from '@/lib/plan-limits'

// 현재 회사의 요금제 및 사용량 정보 조회
export async function GET() {
  try {
    await requireAuth()

    // 멀티테넌트가 비활성화되어 있으면 엔터프라이즈 정보 반환
    if (!isMultiTenantEnabled()) {
      return NextResponse.json({
        success: true,
        plan: {
          type: 'ENTERPRISE',
          name: '엔터프라이즈',
          limits: {
            maxUsers: -1,
            maxWarehouses: -1,
            maxRacks: -1,
          },
          usage: {
            users: { current: 0, limit: -1, percentage: 0 },
            warehouses: { current: 0, limit: -1, percentage: 0 },
            racks: { current: 0, limit: -1, percentage: 0 },
          },
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
        availablePlans: [],
      })
    }

    // 요금제 정보 조회
    const { planType, limits } = await getCompanyPlan()

    // 사용량 조회
    const [userLimit, warehouseLimit, rackLimit] = await Promise.all([
      checkUserLimit(),
      checkWarehouseLimit(),
      checkRackLimit(),
    ])

    // 기능 사용 가능 여부 조회
    const features = await checkFeatures([
      'multiWarehouse',
      'advancedReports',
      'apiAccess',
      'bulkImport',
      'customBranding',
      'prioritySupport',
      'auditLog',
      'exportPdf',
      'exportExcel',
    ] as FeatureKey[])

    // 업그레이드 추천
    const upgradeRecommendation = await getUpgradeRecommendation()

    // 현재 요금제 정보 찾기
    const currentPlanInfo = PLAN_INFO.find((p) => p.type === planType)

    // 사용량 퍼센트 계산
    const calcPercentage = (current: number, limit: number) => {
      if (limit === -1) return 0
      return Math.round((current / limit) * 100)
    }

    return NextResponse.json({
      success: true,
      plan: {
        type: planType,
        name: currentPlanInfo?.name || planType,
        description: currentPlanInfo?.description,
        limits: {
          maxUsers: limits.maxUsers,
          maxWarehouses: limits.maxWarehouses,
          maxRacks: limits.maxRacks,
          maxItemsPerMonth: limits.maxItemsPerMonth,
        },
        usage: {
          users: {
            current: userLimit.current,
            limit: userLimit.limit,
            percentage: calcPercentage(userLimit.current, userLimit.limit),
          },
          warehouses: {
            current: warehouseLimit.current,
            limit: warehouseLimit.limit,
            percentage: calcPercentage(warehouseLimit.current, warehouseLimit.limit),
          },
          racks: {
            current: rackLimit.current,
            limit: rackLimit.limit,
            percentage: calcPercentage(rackLimit.current, rackLimit.limit),
          },
        },
        features,
        price: currentPlanInfo?.price,
      },
      upgradeRecommendation,
      availablePlans: PLAN_INFO.map((p) => ({
        type: p.type,
        name: p.name,
        description: p.description,
        price: p.price,
        limits: {
          maxUsers: p.limits.maxUsers,
          maxWarehouses: p.limits.maxWarehouses,
          maxRacks: p.limits.maxRacks,
        },
        features: p.limits.features,
      })),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Plan info error:', error)
    return NextResponse.json(
      { success: false, message: '요금제 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
