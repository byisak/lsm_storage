import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/mysql'
import { getSession, requireAdmin, AuthError } from '@/lib/auth'

// 창고 목록 조회
// LSM_Warehouse_3D 호환: ls_motor_rack의 storage 컬럼에서 고유 값 조회
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // ls_motor_rack의 storage 컬럼에서 고유 창고 목록 조회
    const storageList = await executeQuery<{ storage: string }>(
      `SELECT DISTINCT storage FROM ls_motor_rack ORDER BY storage`
    )

    return NextResponse.json({
      success: true,
      warehouses: storageList.map((w, index) => ({
        id: w.storage,
        name: w.storage,
        sortOrder: index,
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

// 창고 추가 (LSM_Warehouse_3D에서는 지원하지 않음)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    return NextResponse.json(
      { success: false, message: '창고 추가는 LSM_Warehouse_3D 관리자 페이지에서 진행해주세요.' },
      { status: 400 }
    )
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

// 창고 수정 (LSM_Warehouse_3D에서는 지원하지 않음)
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin()

    return NextResponse.json(
      { success: false, message: '창고 수정은 LSM_Warehouse_3D 관리자 페이지에서 진행해주세요.' },
      { status: 400 }
    )
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

// 창고 삭제 (LSM_Warehouse_3D에서는 지원하지 않음)
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin()

    return NextResponse.json(
      { success: false, message: '창고 삭제는 LSM_Warehouse_3D 관리자 페이지에서 진행해주세요.' },
      { status: 400 }
    )
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
