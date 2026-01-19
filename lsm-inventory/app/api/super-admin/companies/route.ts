import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/mysql'
import { getSession, requireSuperAdmin, AuthError } from '@/lib/auth'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

interface CompanyWithStats {
  ID: string
  NAME: string
  STATUS: string
  PLAN_TYPE: string
  CREATED_AT: Date
  UPDATED_AT: Date
  USER_COUNT: number
  WAREHOUSE_COUNT: number
}

// 전체 회사 목록 조회 (슈퍼 관리자 전용)
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin()

    if (!isMultiTenantEnabled()) {
      return NextResponse.json(
        { success: false, message: '멀티테넌트 모드가 활성화되어 있지 않습니다.' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // ACTIVE, SUSPENDED, DELETED, all
    const search = searchParams.get('search') // 회사명 검색

    let sql = `
      SELECT
        c.ID,
        c.NAME,
        c.STATUS,
        c.PLAN_TYPE,
        c.CREATED_AT,
        c.UPDATED_AT,
        (SELECT COUNT(*) FROM LS_USERS u WHERE u.COMPANY_ID = c.ID) AS USER_COUNT,
        (SELECT COUNT(*) FROM LS_WAREHOUSES w WHERE w.COMPANY_ID = c.ID) AS WAREHOUSE_COUNT
      FROM COMPANIES c
      WHERE 1=1
    `
    const binds: Record<string, unknown> = {}

    // 상태 필터
    if (status && status !== 'all') {
      sql += ` AND c.STATUS = :status`
      binds.status = status
    }

    // 검색어 필터
    if (search) {
      sql += ` AND (UPPER(c.NAME) LIKE UPPER(:search) OR UPPER(c.ID) LIKE UPPER(:search))`
      binds.search = `%${search}%`
    }

    sql += ` ORDER BY c.CREATED_AT DESC`

    const companies = await executeQuery<CompanyWithStats>(sql, binds)

    // 통계 정보
    const stats = await executeQuery<{ STATUS: string; CNT: number }>(
      `SELECT STATUS, COUNT(*) AS CNT FROM COMPANIES GROUP BY STATUS`
    )

    const statsMap = {
      total: 0,
      active: 0,
      suspended: 0,
      deleted: 0,
    }

    stats.forEach((s) => {
      statsMap.total += s.CNT
      if (s.STATUS === 'ACTIVE') statsMap.active = s.CNT
      else if (s.STATUS === 'SUSPENDED') statsMap.suspended = s.CNT
      else if (s.STATUS === 'DELETED') statsMap.deleted = s.CNT
    })

    return NextResponse.json({
      success: true,
      companies: companies.map((c) => ({
        id: c.ID,
        name: c.NAME,
        status: c.STATUS,
        planType: c.PLAN_TYPE,
        createdAt: c.CREATED_AT,
        updatedAt: c.UPDATED_AT,
        userCount: c.USER_COUNT,
        warehouseCount: c.WAREHOUSE_COUNT,
      })),
      stats: statsMap,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Super admin companies error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 회사 상태 변경 (슈퍼 관리자 전용)
export async function PUT(request: NextRequest) {
  try {
    await requireSuperAdmin()

    if (!isMultiTenantEnabled()) {
      return NextResponse.json(
        { success: false, message: '멀티테넌트 모드가 활성화되어 있지 않습니다.' },
        { status: 400 }
      )
    }

    const data = await request.json()
    const { companyId, status, planType } = data

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: '회사 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const updates: string[] = []
    const binds: Record<string, unknown> = { companyId }

    if (status) {
      if (!['ACTIVE', 'SUSPENDED', 'DELETED'].includes(status)) {
        return NextResponse.json(
          { success: false, message: '유효하지 않은 상태값입니다.' },
          { status: 400 }
        )
      }
      updates.push('STATUS = :status')
      binds.status = status
    }

    if (planType) {
      if (!['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE'].includes(planType)) {
        return NextResponse.json(
          { success: false, message: '유효하지 않은 요금제입니다.' },
          { status: 400 }
        )
      }
      updates.push('PLAN_TYPE = :planType')
      binds.planType = planType
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, message: '변경할 내용이 없습니다.' },
        { status: 400 }
      )
    }

    updates.push('UPDATED_AT = :updatedAt')
    binds.updatedAt = new Date()

    await executeQuery(
      `UPDATE COMPANIES SET ${updates.join(', ')} WHERE ID = :companyId`,
      binds
    )

    return NextResponse.json({
      success: true,
      message: '회사 정보가 업데이트되었습니다.',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Super admin company update error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
