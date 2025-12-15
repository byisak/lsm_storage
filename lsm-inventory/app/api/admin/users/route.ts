import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeUpdate, LsUser } from '@/lib/oracle'

// 회원 목록 조회
export async function GET(request: NextRequest) {
  try {
    // 세션 확인
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
    const status = searchParams.get('status') || 'PENDING'

    const users = await executeQuery<LsUser>(
      `SELECT ID, NAME, EMAIL, STATUS, ROLE, CREATED_AT, APPROVED_AT
       FROM LS_USERS
       WHERE STATUS = :status
       ORDER BY CREATED_AT DESC`,
      { status }
    )

    return NextResponse.json({
      success: true,
      users: users.map(u => ({
        id: u.ID,
        name: u.NAME,
        email: u.EMAIL,
        status: u.STATUS,
        role: u.ROLE,
        createdAt: u.CREATED_AT,
        approvedAt: u.APPROVED_AT,
      })),
    })
  } catch (error) {
    console.error('Admin users error:', error)
    return NextResponse.json(
      { success: false, message: '회원 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 회원 상태 변경 (승인/거절)
export async function PUT(request: NextRequest) {
  try {
    // 세션 확인
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
    const { userId, status } = body

    if (!userId || !status) {
      return NextResponse.json(
        { success: false, message: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { success: false, message: '올바르지 않은 상태값입니다.' },
        { status: 400 }
      )
    }

    const rowsAffected = await executeUpdate(
      `UPDATE LS_USERS
       SET STATUS = :status,
           APPROVED_AT = CURRENT_TIMESTAMP,
           APPROVED_BY = :approvedBy
       WHERE ID = :userId`,
      {
        status,
        approvedBy: session.id,
        userId,
      }
    )

    if (rowsAffected === 0) {
      return NextResponse.json(
        { success: false, message: '회원을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: status === 'APPROVED' ? '승인되었습니다.' : '거절되었습니다.',
    })
  } catch (error) {
    console.error('Admin user update error:', error)
    return NextResponse.json(
      { success: false, message: '회원 상태 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
