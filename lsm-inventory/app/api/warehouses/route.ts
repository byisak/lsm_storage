import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeInsert, executeUpdate, executeDelete, LsWarehouse } from '@/lib/oracle'

// 창고 목록 조회
export async function GET() {
  try {
    const warehouses = await executeQuery<LsWarehouse>(
      `SELECT ID, NAME, SORT_ORDER, CREATED_AT
       FROM LS_WAREHOUSES
       ORDER BY SORT_ORDER, ID`
    )

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
    // 관리자 권한 확인
    const sessionCookie = request.cookies.get('auth-session')
    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const session = JSON.parse(sessionCookie.value)
    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, name } = body

    if (!id || !name) {
      return NextResponse.json(
        { success: false, message: '창고 ID와 이름은 필수입니다.' },
        { status: 400 }
      )
    }

    // 중복 확인
    const existing = await executeQuery<LsWarehouse>(
      `SELECT ID FROM LS_WAREHOUSES WHERE ID = :id`,
      { id }
    )

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, message: '이미 존재하는 창고 ID입니다.' },
        { status: 400 }
      )
    }

    // 최대 정렬 순서 조회
    const maxOrder = await executeQuery<{ MAX_ORDER: number }>(
      `SELECT NVL(MAX(SORT_ORDER), 0) + 1 AS MAX_ORDER FROM LS_WAREHOUSES`
    )

    await executeInsert(
      `INSERT INTO LS_WAREHOUSES (ID, NAME, SORT_ORDER)
       VALUES (:id, :name, :sortOrder)`,
      { id, name, sortOrder: maxOrder[0]?.MAX_ORDER || 1 }
    )

    return NextResponse.json({
      success: true,
      message: '창고가 추가되었습니다.',
    })
  } catch (error) {
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
    const sessionCookie = request.cookies.get('auth-session')
    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const session = JSON.parse(sessionCookie.value)
    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, name, sortOrder } = body

    if (!id || !name) {
      return NextResponse.json(
        { success: false, message: '창고 ID와 이름은 필수입니다.' },
        { status: 400 }
      )
    }

    const rowsAffected = await executeUpdate(
      `UPDATE LS_WAREHOUSES
       SET NAME = :name, SORT_ORDER = :sortOrder
       WHERE ID = :id`,
      { id, name, sortOrder: sortOrder || 0 }
    )

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
    const sessionCookie = request.cookies.get('auth-session')
    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const session = JSON.parse(sessionCookie.value)
    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, message: '창고 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const rowsAffected = await executeDelete(
      `DELETE FROM LS_WAREHOUSES WHERE ID = :id`,
      { id }
    )

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
    console.error('Warehouse delete error:', error)
    return NextResponse.json(
      { success: false, message: '창고 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
