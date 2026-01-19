import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeInsert, executeUpdate, executeDelete, LsWarehouse } from '@/lib/mysql'
import { getSession, requireAdmin, AuthError } from '@/lib/auth'
import { getCompanyId, isMultiTenantEnabled } from '@/lib/multi-tenant'
import { checkWarehouseLimit } from '@/lib/plan-limits'

// 창고 목록 조회
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 멀티테넌트: 회사별 창고만 조회
    const companyId = await getCompanyId()

    let warehouses: LsWarehouse[]

    if (isMultiTenantEnabled()) {
      // 멀티테넌트 모드: 회사별 필터링
      warehouses = await executeQuery<LsWarehouse>(
        `SELECT ID, NAME, SORT_ORDER, CREATED_AT, COMPANY_ID
         FROM ls_warehouses
         WHERE COMPANY_ID = :companyId
         ORDER BY SORT_ORDER, ID`,
        { companyId }
      )
    } else {
      // 단일 테넌트 모드: 기존 방식 (하위 호환)
      warehouses = await executeQuery<LsWarehouse>(
        `SELECT ID, NAME, SORT_ORDER, CREATED_AT
         FROM ls_warehouses
         ORDER BY SORT_ORDER, ID`
      )
    }

    return NextResponse.json({
      success: true,
      warehouses: warehouses.map(w => ({
        id: w.ID,
        name: w.NAME,
        sortOrder: w.SORT_ORDER,
      })),
    })
  } catch (error) {
    console.error('Warehouses fetch error:', error)
    return NextResponse.json(
      { success: false, message: '창고 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 창고 추가
export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인 (헬퍼 사용)
    const session = await requireAdmin()
    const companyId = session.companyId

    const body = await request.json()
    const { id, name } = body

    if (!id || !name) {
      return NextResponse.json(
        { success: false, message: '창고 ID와 이름은 필수입니다.' },
        { status: 400 }
      )
    }

    // 요금제 한도 확인
    const limitCheck = await checkWarehouseLimit()
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: limitCheck.message,
          limitReached: true,
          current: limitCheck.current,
          limit: limitCheck.limit,
        },
        { status: 403 }
      )
    }

    // 중복 확인 (같은 회사 내에서만)
    let existing: LsWarehouse[]

    if (isMultiTenantEnabled()) {
      existing = await executeQuery<LsWarehouse>(
        `SELECT ID FROM ls_warehouses WHERE ID = :id AND COMPANY_ID = :companyId`,
        { id, companyId }
      )
    } else {
      existing = await executeQuery<LsWarehouse>(
        `SELECT ID FROM ls_warehouses WHERE ID = :id`,
        { id }
      )
    }

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, message: '이미 존재하는 창고 ID입니다.' },
        { status: 400 }
      )
    }

    // 최대 정렬 순서 조회 (회사별)
    let maxOrder: { MAX_ORDER: number }[]

    if (isMultiTenantEnabled()) {
      maxOrder = await executeQuery<{ MAX_ORDER: number }>(
        `SELECT COALESCE(MAX(SORT_ORDER), 0) + 1 AS MAX_ORDER
         FROM ls_warehouses
         WHERE COMPANY_ID = :companyId`,
        { companyId }
      )
    } else {
      maxOrder = await executeQuery<{ MAX_ORDER: number }>(
        `SELECT COALESCE(MAX(SORT_ORDER), 0) + 1 AS MAX_ORDER FROM ls_warehouses`
      )
    }

    // 창고 추가 (COMPANY_ID 포함)
    if (isMultiTenantEnabled()) {
      await executeInsert(
        `INSERT INTO ls_warehouses (ID, NAME, SORT_ORDER, COMPANY_ID)
         VALUES (:id, :name, :sortOrder, :companyId)`,
        { id, name, sortOrder: maxOrder[0]?.MAX_ORDER || 1, companyId }
      )
    } else {
      await executeInsert(
        `INSERT INTO ls_warehouses (ID, NAME, SORT_ORDER)
         VALUES (:id, :name, :sortOrder)`,
        { id, name, sortOrder: maxOrder[0]?.MAX_ORDER || 1 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '창고가 추가되었습니다.',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Warehouse add error:', error)
    return NextResponse.json(
      { success: false, message: '창고 추가 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 창고 수정
export async function PUT(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const session = await requireAdmin()
    const companyId = session.companyId

    const body = await request.json()
    const { id, name, sortOrder } = body

    if (!id || !name) {
      return NextResponse.json(
        { success: false, message: '창고 ID와 이름은 필수입니다.' },
        { status: 400 }
      )
    }

    // 창고 수정 (회사 소유권 확인)
    let rowsAffected: number

    if (isMultiTenantEnabled()) {
      rowsAffected = await executeUpdate(
        `UPDATE ls_warehouses
         SET NAME = :name, SORT_ORDER = :sortOrder
         WHERE ID = :id AND COMPANY_ID = :companyId`,
        { id, name, sortOrder: sortOrder || 0, companyId }
      )
    } else {
      rowsAffected = await executeUpdate(
        `UPDATE ls_warehouses
         SET NAME = :name, SORT_ORDER = :sortOrder
         WHERE ID = :id`,
        { id, name, sortOrder: sortOrder || 0 }
      )
    }

    if (rowsAffected === 0) {
      return NextResponse.json(
        { success: false, message: '창고를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '창고가 수정되었습니다.',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Warehouse update error:', error)
    return NextResponse.json(
      { success: false, message: '창고 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 창고 삭제
export async function DELETE(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const session = await requireAdmin()
    const companyId = session.companyId

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, message: '창고 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 창고 삭제 (회사 소유권 확인)
    let rowsAffected: number

    if (isMultiTenantEnabled()) {
      rowsAffected = await executeDelete(
        `DELETE FROM ls_warehouses WHERE ID = :id AND COMPANY_ID = :companyId`,
        { id, companyId }
      )
    } else {
      rowsAffected = await executeDelete(
        `DELETE FROM ls_warehouses WHERE ID = :id`,
        { id }
      )
    }

    if (rowsAffected === 0) {
      return NextResponse.json(
        { success: false, message: '창고를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '창고가 삭제되었습니다.',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Warehouse delete error:', error)
    return NextResponse.json(
      { success: false, message: '창고 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
