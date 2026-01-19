import { NextResponse } from 'next/server'
import { executeQuery } from '@/lib/mysql'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

interface CountResult {
  CNT: number
}

interface RecentCompany {
  ID: string
  NAME: string
  STATUS: string
  PLAN_TYPE: string
  CREATED_AT: Date
}

interface PlanStats {
  PLAN_TYPE: string
  CNT: number
}

// 슈퍼 관리자 대시보드 데이터
export async function GET() {
  try {
    await requireSuperAdmin()

    if (!isMultiTenantEnabled()) {
      return NextResponse.json(
        { success: false, message: '멀티테넌트 모드가 활성화되어 있지 않습니다.' },
        { status: 400 }
      )
    }

    // 병렬로 통계 조회
    const [
      companyCount,
      activeCompanyCount,
      totalUsers,
      totalWarehouses,
      totalRacks,
      totalTransactions,
      recentCompanies,
      planStats,
    ] = await Promise.all([
      // 전체 회사 수
      executeQuery<CountResult>(`SELECT COUNT(*) AS CNT FROM COMPANIES`),
      // 활성 회사 수
      executeQuery<CountResult>(`SELECT COUNT(*) AS CNT FROM COMPANIES WHERE STATUS = 'ACTIVE'`),
      // 전체 사용자 수
      executeQuery<CountResult>(`SELECT COUNT(*) AS CNT FROM LS_USERS`),
      // 전체 창고 수
      executeQuery<CountResult>(`SELECT COUNT(*) AS CNT FROM LS_WAREHOUSES`),
      // 전체 재고 항목 수
      executeQuery<CountResult>(`SELECT COUNT(*) AS CNT FROM LS_MOTOR_RACK`),
      // 전체 거래 수
      executeQuery<CountResult>(`SELECT COUNT(*) AS CNT FROM LS_MOTOR_SUBUL`),
      // 최근 가입 회사 (5개)
      executeQuery<RecentCompany>(
        `SELECT ID, NAME, STATUS, PLAN_TYPE, CREATED_AT
         FROM COMPANIES
         ORDER BY CREATED_AT DESC
         FETCH FIRST 5 ROWS ONLY`
      ),
      // 요금제별 회사 수
      executeQuery<PlanStats>(
        `SELECT PLAN_TYPE, COUNT(*) AS CNT FROM COMPANIES GROUP BY PLAN_TYPE`
      ),
    ])

    // 요금제 통계 변환
    const planStatsMap: Record<string, number> = {
      BASIC: 0,
      STANDARD: 0,
      PREMIUM: 0,
      ENTERPRISE: 0,
    }
    planStats.forEach((p) => {
      planStatsMap[p.PLAN_TYPE] = p.CNT
    })

    return NextResponse.json({
      success: true,
      dashboard: {
        // 주요 지표
        metrics: {
          totalCompanies: companyCount[0]?.CNT || 0,
          activeCompanies: activeCompanyCount[0]?.CNT || 0,
          totalUsers: totalUsers[0]?.CNT || 0,
          totalWarehouses: totalWarehouses[0]?.CNT || 0,
          totalRacks: totalRacks[0]?.CNT || 0,
          totalTransactions: totalTransactions[0]?.CNT || 0,
        },
        // 요금제별 통계
        planStats: planStatsMap,
        // 최근 가입 회사
        recentCompanies: recentCompanies.map((c) => ({
          id: c.ID,
          name: c.NAME,
          status: c.STATUS,
          planType: c.PLAN_TYPE,
          createdAt: c.CREATED_AT,
        })),
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Super admin dashboard error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
