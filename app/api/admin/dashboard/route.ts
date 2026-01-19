import { NextResponse } from 'next/server'
import { requireAdmin, AuthError } from '@/lib/auth'
import { executeQuery } from '@/lib/mysql'
import { getCompanyId, isMultiTenantEnabled } from '@/lib/multi-tenant'
import { getCompanyPlan, checkUserLimit, checkWarehouseLimit, checkRackLimit } from '@/lib/plan-limits'

interface CountRow {
  CNT: number
}

interface RecentActivityRow {
  SUBUL_TIME: Date
  SUBUL_TYPE: string
  ITEM_NAME: string
  QTY: number
  USER_NAME: string
}

// 관리자 대시보드 데이터
export async function GET() {
  try {
    const session = await requireAdmin()
    const companyId = session.companyId || await getCompanyId()

    // 요금제 정보
    const { planType, limits } = await getCompanyPlan()

    // 사용량 조회
    const [userLimit, warehouseLimit, rackLimit] = await Promise.all([
      checkUserLimit(),
      checkWarehouseLimit(),
      checkRackLimit(),
    ])

    // 사용자 통계
    let userStatsQuery = `
      SELECT
        COUNT(*) AS TOTAL,
        SUM(CASE WHEN STATUS = 'PENDING' THEN 1 ELSE 0 END) AS PENDING,
        SUM(CASE WHEN STATUS = 'APPROVED' THEN 1 ELSE 0 END) AS APPROVED
      FROM ls_users
    `
    const userBinds: Record<string, unknown> = {}
    if (isMultiTenantEnabled()) {
      userStatsQuery += ` WHERE COMPANY_ID = :companyId`
      userBinds.companyId = companyId
    }
    const userStats = await executeQuery<{ TOTAL: number; PENDING: number; APPROVED: number }>(
      userStatsQuery, userBinds
    )

    // 창고 수
    let warehouseQuery = `SELECT COUNT(*) AS CNT FROM ls_warehouses`
    const warehouseBinds: Record<string, unknown> = {}
    if (isMultiTenantEnabled()) {
      warehouseQuery += ` WHERE COMPANY_ID = :companyId`
      warehouseBinds.companyId = companyId
    }
    const warehouseCount = await executeQuery<CountRow>(warehouseQuery, warehouseBinds)

    // 재고 품목 수
    let rackQuery = `SELECT COUNT(DISTINCT ITEM_CODE) AS CNT FROM ls_motor_rack`
    const rackBinds: Record<string, unknown> = {}
    if (isMultiTenantEnabled()) {
      rackQuery += ` WHERE COMPANY_ID = :companyId`
      rackBinds.companyId = companyId
    }
    const itemCount = await executeQuery<CountRow>(rackQuery, rackBinds)

    // 총 재고 수량
    let totalQtyQuery = `SELECT COALESCE(SUM(QTY), 0) AS CNT FROM ls_motor_rack`
    const totalQtyBinds: Record<string, unknown> = {}
    if (isMultiTenantEnabled()) {
      totalQtyQuery += ` WHERE COMPANY_ID = :companyId`
      totalQtyBinds.companyId = companyId
    }
    const totalQty = await executeQuery<CountRow>(totalQtyQuery, totalQtyBinds)

    // 오늘 거래 건수 (PostgreSQL)
    let todayTransQuery = `
      SELECT COUNT(*) AS CNT FROM ls_motor_subul
      WHERE subul_time::DATE = CURRENT_DATE
    `
    const todayTransBinds: Record<string, unknown> = {}
    if (isMultiTenantEnabled()) {
      todayTransQuery += ` AND company_id = :companyId`
      todayTransBinds.companyId = companyId
    }
    const todayTrans = await executeQuery<CountRow>(todayTransQuery, todayTransBinds)

    // 이번 달 거래 건수 (PostgreSQL)
    let monthTransQuery = `
      SELECT COUNT(*) AS CNT FROM ls_motor_subul
      WHERE DATE_TRUNC('month', subul_time) = DATE_TRUNC('month', NOW())
    `
    const monthTransBinds: Record<string, unknown> = {}
    if (isMultiTenantEnabled()) {
      monthTransQuery += ` AND company_id = :companyId`
      monthTransBinds.companyId = companyId
    }
    const monthTrans = await executeQuery<CountRow>(monthTransQuery, monthTransBinds)

    // 최근 활동 (5건 - PostgreSQL)
    let recentQuery = `
      SELECT s.subul_time, s.subul_type, s.item_name, s.qty, u.name AS user_name
      FROM ls_motor_subul s
      LEFT JOIN ls_users u ON s.user_id = u.id
    `
    const recentBinds: Record<string, unknown> = {}
    if (isMultiTenantEnabled()) {
      recentQuery += ` WHERE s.company_id = :companyId`
      recentBinds.companyId = companyId
    }
    recentQuery += ` ORDER BY s.subul_time DESC LIMIT 5`
    const recentActivity = await executeQuery<RecentActivityRow>(recentQuery, recentBinds)

    return NextResponse.json({
      success: true,
      dashboard: {
        plan: {
          type: planType,
          limits: {
            maxUsers: limits.maxUsers,
            maxWarehouses: limits.maxWarehouses,
            maxRacks: limits.maxRacks,
          },
        },
        usage: {
          users: {
            current: userLimit.current,
            limit: userLimit.limit,
            pending: userStats[0]?.PENDING || 0,
          },
          warehouses: {
            current: warehouseLimit.current,
            limit: warehouseLimit.limit,
          },
          racks: {
            current: rackLimit.current,
            limit: rackLimit.limit,
          },
        },
        stats: {
          totalUsers: userStats[0]?.TOTAL || 0,
          approvedUsers: userStats[0]?.APPROVED || 0,
          pendingUsers: userStats[0]?.PENDING || 0,
          warehouses: warehouseCount[0]?.CNT || 0,
          uniqueItems: itemCount[0]?.CNT || 0,
          totalQuantity: totalQty[0]?.CNT || 0,
          todayTransactions: todayTrans[0]?.CNT || 0,
          monthTransactions: monthTrans[0]?.CNT || 0,
        },
        recentActivity: recentActivity.map((r) => ({
          time: r.SUBUL_TIME,
          type: r.SUBUL_TYPE,
          itemName: r.ITEM_NAME,
          qty: r.QTY,
          userName: r.USER_NAME || '알 수 없음',
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
    console.error('Admin dashboard error:', error)
    return NextResponse.json(
      { success: false, message: '대시보드 데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
