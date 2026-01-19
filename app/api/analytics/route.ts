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
  IN_QTY: number
  OUT_QTY: number
}

interface TopItemRow {
  ITEM_CODE: string
  ITEM_NAME: string
  IN_QTY: number
  OUT_QTY: number
  TOTAL_QTY: number
}

interface WarehouseStatsRow {
  STORAGE: string
  ITEM_COUNT: number
  TOTAL_QTY: number
  LOCATIONS: number
}

interface ActivityRow {
  USER_ID: number
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
        TO_CHAR(SUBUL_TIME, 'YYYY-MM-DD') AS TRANS_DATE,
        SUM(CASE WHEN SUBUL_TYPE = 'IN' THEN 1 ELSE 0 END) AS IN_COUNT,
        SUM(CASE WHEN SUBUL_TYPE = 'OUT' THEN 1 ELSE 0 END) AS OUT_COUNT,
        SUM(CASE WHEN SUBUL_TYPE = 'MOVE' THEN 1 ELSE 0 END) AS MOVE_COUNT,
        SUM(CASE WHEN SUBUL_TYPE = 'IN' THEN QTY ELSE 0 END) AS IN_QTY,
        SUM(CASE WHEN SUBUL_TYPE = 'OUT' THEN QTY ELSE 0 END) AS OUT_QTY
      FROM ls_motor_subul
      WHERE SUBUL_TIME >= NOW() - INTERVAL '1 day' * :days
    `

    const dailyBinds: Record<string, unknown> = { days }

    if (isMultiTenantEnabled()) {
      dailyQuery += ` AND COMPANY_ID = :companyId`
      dailyBinds.companyId = companyId
    }

    if (warehouseId) {
      dailyQuery += ` AND STORAGE = :warehouseId`
      dailyBinds.warehouseId = warehouseId
    }

    dailyQuery += ` GROUP BY TO_CHAR(SUBUL_TIME, 'YYYY-MM-DD') ORDER BY TRANS_DATE`

    const dailyStats = await executeQuery<DailyTransactionRow>(dailyQuery, dailyBinds)

    // 인기 품목 (입출고 빈도순)
    let topItemsQuery = `
      SELECT
        ITEM_CODE,
        MAX(ITEM_NAME) AS ITEM_NAME,
        SUM(CASE WHEN SUBUL_TYPE = 'IN' THEN QTY ELSE 0 END) AS IN_QTY,
        SUM(CASE WHEN SUBUL_TYPE = 'OUT' THEN QTY ELSE 0 END) AS OUT_QTY,
        SUM(QTY) AS TOTAL_QTY
      FROM ls_motor_subul
      WHERE SUBUL_TIME >= NOW() - INTERVAL '1 day' * :days
    `

    const topItemsBinds: Record<string, unknown> = { days }

    if (isMultiTenantEnabled()) {
      topItemsQuery += ` AND COMPANY_ID = :companyId`
      topItemsBinds.companyId = companyId
    }

    if (warehouseId) {
      topItemsQuery += ` AND STORAGE = :warehouseId`
      topItemsBinds.warehouseId = warehouseId
    }

    topItemsQuery += `
      GROUP BY ITEM_CODE
      ORDER BY TOTAL_QTY DESC
      LIMIT 10
    `

    const topItems = await executeQuery<TopItemRow>(topItemsQuery, topItemsBinds)

    // 창고별 통계
    let warehouseQuery = `
      SELECT
        STORAGE,
        COUNT(DISTINCT ITEM_CODE) AS ITEM_COUNT,
        SUM(QTY) AS TOTAL_QTY,
        COUNT(DISTINCT LOCATION) AS LOCATIONS
      FROM ls_motor_rack
    `

    const warehouseBinds: Record<string, unknown> = {}

    if (isMultiTenantEnabled()) {
      warehouseQuery += ` WHERE COMPANY_ID = :companyId`
      warehouseBinds.companyId = companyId
    }

    if (warehouseId) {
      if (isMultiTenantEnabled()) {
        warehouseQuery += ` AND STORAGE = :warehouseId`
      } else {
        warehouseQuery += ` WHERE STORAGE = :warehouseId`
      }
      warehouseBinds.warehouseId = warehouseId
    }

    warehouseQuery += ` GROUP BY STORAGE ORDER BY TOTAL_QTY DESC`

    const warehouseStats = await executeQuery<WarehouseStatsRow>(warehouseQuery, warehouseBinds)

    // 사용자 활동 통계
    let activityQuery = `
      SELECT
        s.USER_ID,
        u.NAME AS USER_NAME,
        COUNT(*) AS TRANS_COUNT,
        MAX(s.SUBUL_TIME) AS LAST_ACTIVITY
      FROM ls_motor_subul s
      LEFT JOIN ls_users u ON s.USER_ID = u.ID
      WHERE s.SUBUL_TIME >= NOW() - INTERVAL '1 day' * :days
    `

    const activityBinds: Record<string, unknown> = { days }

    if (isMultiTenantEnabled()) {
      activityQuery += ` AND s.COMPANY_ID = :companyId`
      activityBinds.companyId = companyId
    }

    activityQuery += `
      GROUP BY s.USER_ID, u.NAME
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
        SUM(CASE WHEN SUBUL_TYPE = 'IN' THEN QTY ELSE 0 END) AS TOTAL_IN_QTY,
        SUM(CASE WHEN SUBUL_TYPE = 'OUT' THEN QTY ELSE 0 END) AS TOTAL_OUT_QTY,
        COUNT(DISTINCT ITEM_CODE) AS UNIQUE_ITEMS,
        COUNT(DISTINCT USER_ID) AS ACTIVE_USERS
      FROM ls_motor_subul
      WHERE SUBUL_TIME >= NOW() - INTERVAL '1 day' * :days
    `

    const summaryBinds: Record<string, unknown> = { days }

    if (isMultiTenantEnabled()) {
      summaryQuery += ` AND COMPANY_ID = :companyId`
      summaryBinds.companyId = companyId
    }

    if (warehouseId) {
      summaryQuery += ` AND STORAGE = :warehouseId`
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
          totalInQty: summary.TOTAL_IN_QTY || 0,
          totalOutQty: summary.TOTAL_OUT_QTY || 0,
          uniqueItems: summary.UNIQUE_ITEMS || 0,
          activeUsers: summary.ACTIVE_USERS || 0,
        },
        dailyStats: dailyStats.map((row) => ({
          date: row.TRANS_DATE,
          inCount: row.IN_COUNT,
          outCount: row.OUT_COUNT,
          moveCount: row.MOVE_COUNT,
          inQty: row.IN_QTY,
          outQty: row.OUT_QTY,
        })),
        topItems: topItems.map((row) => ({
          itemCode: row.ITEM_CODE,
          itemName: row.ITEM_NAME,
          inQty: row.IN_QTY,
          outQty: row.OUT_QTY,
          totalQty: row.TOTAL_QTY,
        })),
        warehouseStats: warehouseStats.map((row) => ({
          warehouseId: row.STORAGE,
          itemCount: row.ITEM_COUNT,
          totalQty: row.TOTAL_QTY,
          locations: row.LOCATIONS,
        })),
        userActivity: userActivity.map((row) => ({
          userId: row.USER_ID,
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
