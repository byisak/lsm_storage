import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { executeQuery } from '@/lib/mysql'
import { getCompanyId, isMultiTenantEnabled } from '@/lib/multi-tenant'
import { checkFeature } from '@/lib/plan-limits'

interface DailyTransactionRow {
  TRANS_DATE: string
  IN_COUNT: number
  OUT_COUNT: number
  MOVE_COUNT: number
  IN_Qty: number
  OUT_Qty: number
}

interface TopItemRow {
  itemCode: string
  itemName: string
  IN_Qty: number
  OUT_Qty: number
  TOTAL_Qty: number
}

interface WarehouseStatsRow {
  storage: string
  ITEM_COUNT: number
  TOTAL_Qty: number
  LocationS: number
}

interface ActivityRow {
  user: number
  USER_NAME: string
  TRANS_COUNT: number
  LAST_ACTIVITY: Date
}

// 사용량 분석 데이터 조회
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    // 고급 리포트 기능 확인
    if (isMultiTenantEnabled()) {
      const advancedReportsEnabled = await checkFeature('advancedReports')
      if (!advancedReportsEnabled) {
        return NextResponse.json(
          {
            success: false,
            message: '고급 리포트 기능은 스탠다드 이상 요금제에서 사용할 수 있습니다.',
            upgradeRequired: true,
          },
          { status: 403 }
        )
      }
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30' // 기본 30일
    const warehouseId = searchParams.get('warehouseId')

    const companyId = await getCompanyId()
    const days = parseInt(period, 10)

    // 일별 거래 통계
    let dailyQuery = `
      SELECT
        TO_CHAR(Subul_Time, 'YYYY-MM-DD') AS TRANS_DATE,
        SUM(CASE WHEN SUBUL_TYPE = 'IN' THEN 1 ELSE 0 END) AS IN_COUNT,
        SUM(CASE WHEN SUBUL_TYPE = 'OUT' THEN 1 ELSE 0 END) AS OUT_COUNT,
        SUM(CASE WHEN SUBUL_TYPE = 'MOVE' THEN 1 ELSE 0 END) AS MOVE_COUNT,
        SUM(CASE WHEN SUBUL_TYPE = 'IN' THEN Qty ELSE 0 END) AS IN_Qty,
        SUM(CASE WHEN SUBUL_TYPE = 'OUT' THEN Qty ELSE 0 END) AS OUT_Qty
      FROM ls_motor_subul
      WHERE Subul_Time >= NOW() - INTERVAL '1 day' * :days
    `

    const dailyBinds: Record<string, unknown> = { days }

    if (isMultiTenantEnabled()) {
      dailyQuery += ` AND COMPANY_ID = :companyId`
      dailyBinds.companyId = companyId
    }

    if (warehouseId) {
      dailyQuery += ` AND storage = :warehouseId`
      dailyBinds.warehouseId = warehouseId
    }

    dailyQuery += ` GROUP BY TO_CHAR(Subul_Time, 'YYYY-MM-DD') ORDER BY TRANS_DATE`

    const dailyStats = await executeQuery<DailyTransactionRow>(dailyQuery, dailyBinds)

    // 인기 품목 (입출고 빈도순)
    let topItemsQuery = `
      SELECT
        itemCode,
        MAX(itemName) AS itemName,
        SUM(CASE WHEN SUBUL_TYPE = 'IN' THEN Qty ELSE 0 END) AS IN_Qty,
        SUM(CASE WHEN SUBUL_TYPE = 'OUT' THEN Qty ELSE 0 END) AS OUT_Qty,
        SUM(Qty) AS TOTAL_Qty
      FROM ls_motor_subul
      WHERE Subul_Time >= NOW() - INTERVAL '1 day' * :days
    `

    const topItemsBinds: Record<string, unknown> = { days }

    if (isMultiTenantEnabled()) {
      topItemsQuery += ` AND COMPANY_ID = :companyId`
      topItemsBinds.companyId = companyId
    }

    if (warehouseId) {
      topItemsQuery += ` AND storage = :warehouseId`
      topItemsBinds.warehouseId = warehouseId
    }

    topItemsQuery += `
      GROUP BY itemCode
      ORDER BY TOTAL_Qty DESC
      LIMIT 10
    `

    const topItems = await executeQuery<TopItemRow>(topItemsQuery, topItemsBinds)

    // 창고별 통계
    let warehouseQuery = `
      SELECT
        storage,
        COUNT(DISTINCT itemCode) AS ITEM_COUNT,
        SUM(Qty) AS TOTAL_Qty,
        COUNT(DISTINCT Location) AS LocationS
      FROM ls_motor_rack
    `

    const warehouseBinds: Record<string, unknown> = {}

    if (isMultiTenantEnabled()) {
      warehouseQuery += ` WHERE COMPANY_ID = :companyId`
      warehouseBinds.companyId = companyId
    }

    if (warehouseId) {
      if (isMultiTenantEnabled()) {
        warehouseQuery += ` AND storage = :warehouseId`
      } else {
        warehouseQuery += ` WHERE storage = :warehouseId`
      }
      warehouseBinds.warehouseId = warehouseId
    }

    warehouseQuery += ` GROUP BY storage ORDER BY TOTAL_Qty DESC`

    const warehouseStats = await executeQuery<WarehouseStatsRow>(warehouseQuery, warehouseBinds)

    // 사용자 활동 통계
    let activityQuery = `
      SELECT
        s.user,
        u.NAME AS USER_NAME,
        COUNT(*) AS TRANS_COUNT,
        MAX(s.Subul_Time) AS LAST_ACTIVITY
      FROM ls_motor_subul s
      LEFT JOIN ls_users u ON s.user = u.ID
      WHERE s.Subul_Time >= NOW() - INTERVAL '1 day' * :days
    `

    const activityBinds: Record<string, unknown> = { days }

    if (isMultiTenantEnabled()) {
      activityQuery += ` AND s.COMPANY_ID = :companyId`
      activityBinds.companyId = companyId
    }

    activityQuery += `
      GROUP BY s.user, u.NAME
      ORDER BY TRANS_COUNT DESC
      LIMIT 10
    `

    const userActivity = await executeQuery<ActivityRow>(activityQuery, activityBinds)

    // 전체 통계 요약
    let summaryQuery = `
      SELECT
        COUNT(*) AS TOTAL_TRANSACTIONS,
        SUM(CASE WHEN SUBUL_TYPE = 'IN' THEN 1 ELSE 0 END) AS TOTAL_IN,
        SUM(CASE WHEN SUBUL_TYPE = 'OUT' THEN 1 ELSE 0 END) AS TOTAL_OUT,
        SUM(CASE WHEN SUBUL_TYPE = 'MOVE' THEN 1 ELSE 0 END) AS TOTAL_MOVE,
        SUM(CASE WHEN SUBUL_TYPE = 'IN' THEN Qty ELSE 0 END) AS TOTAL_IN_Qty,
        SUM(CASE WHEN SUBUL_TYPE = 'OUT' THEN Qty ELSE 0 END) AS TOTAL_OUT_Qty,
        COUNT(DISTINCT itemCode) AS UNIQUE_ITEMS,
        COUNT(DISTINCT user) AS ACTIVE_USERS
      FROM ls_motor_subul
      WHERE Subul_Time >= NOW() - INTERVAL '1 day' * :days
    `

    const summaryBinds: Record<string, unknown> = { days }

    if (isMultiTenantEnabled()) {
      summaryQuery += ` AND COMPANY_ID = :companyId`
      summaryBinds.companyId = companyId
    }

    if (warehouseId) {
      summaryQuery += ` AND storage = :warehouseId`
      summaryBinds.warehouseId = warehouseId
    }

    const summaryResult = await executeQuery<Record<string, number>>(summaryQuery, summaryBinds)
    const summary = summaryResult[0] || {}

    return NextResponse.json({
      success: true,
      period: days,
      analytics: {
        summary: {
          totalTransactions: summary.TOTAL_TRANSACTIONS || 0,
          totalIn: summary.TOTAL_IN || 0,
          totalOut: summary.TOTAL_OUT || 0,
          totalMove: summary.TOTAL_MOVE || 0,
          totalInQty: summary.TOTAL_IN_Qty || 0,
          totalOutQty: summary.TOTAL_OUT_Qty || 0,
          uniqueItems: summary.UNIQUE_ITEMS || 0,
          activeUsers: summary.ACTIVE_USERS || 0,
        },
        dailyStats: dailyStats.map((row) => ({
          date: row.TRANS_DATE,
          inCount: row.IN_COUNT,
          outCount: row.OUT_COUNT,
          moveCount: row.MOVE_COUNT,
          inQty: row.IN_Qty,
          outQty: row.OUT_Qty,
        })),
        topItems: topItems.map((row) => ({
          itemCode: row.itemCode,
          itemName: row.itemName,
          inQty: row.IN_Qty,
          outQty: row.OUT_Qty,
          totalQty: row.TOTAL_Qty,
        })),
        warehouseStats: warehouseStats.map((row) => ({
          warehouseId: row.storage,
          itemCount: row.ITEM_COUNT,
          totalQty: row.TOTAL_Qty,
          locations: row.LocationS,
        })),
        userActivity: userActivity.map((row) => ({
          userId: row.user,
          userName: row.USER_NAME || '알 수 없음',
          transactionCount: row.TRANS_COUNT,
          lastActivity: row.LAST_ACTIVITY,
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
    console.error('Analytics error:', error)
    return NextResponse.json(
      { success: false, message: '분석 데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
