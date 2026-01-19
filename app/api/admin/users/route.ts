import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeUpdate, LsUser } from '@/lib/mysql'
import { requireAdmin, AuthError } from '@/lib/auth'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'
import { checkUserLimit } from '@/lib/plan-limits'

// 회원 목록 조회 (같은 회사 사용자만)
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin()
    const companyId = session.companyId

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING'

    let users: LsUser[]

    if (isMultiTenantEnabled()) {
      // 멀티테넌트: 같은 회사 사용자만 조회
      users = await executeQuery<LsUser>(
        `SELECT ID, NAME, EMAIL, STATUS, ROLE, CREATED_AT, APPROVED_AT, COMPANY_ID
         FROM ls_users
         WHERE STATUS = :status AND COMPANY_ID = :companyId
         ORDER BY CREATED_AT DESC`,
        { status, companyId }
      )
    } else {
      // 단일 테넌트: 기존 방식
      users = await executeQuery<LsUser>(
        `SELECT ID, NAME, EMAIL, STATUS, ROLE, CREATED_AT, APPROVED_AT
         FROM ls_users
         WHERE STATUS = :status
         ORDER BY CREATED_AT DESC`,
        { status }
      )
    }

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
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Admin users error:', error)
    return NextResponse.json(
      { success: false, message: '회원 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 회원 상태 변경 (승인/거절) - 같은 회사 사용자만
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin()
    const companyId = session.companyId

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

    // 승인 시 요금제 한도 확인
    if (status === 'APPROVED') {
      const limitCheck = await checkUserLimit()
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
    }

    let rowsAffected: number

    if (isMultiTenantEnabled()) {
      // 멀티테넌트: 같은 회사 사용자만 수정 가능
      rowsAffected = await executeUpdate(
        `UPDATE ls_users
         SET STATUS = :status,
             APPROVED_AT = CURRENT_TIMESTAMP,
             APPROVED_BY = :approvedBy
         WHERE ID = :userId AND COMPANY_ID = :companyId`,
        {
          status,
          approvedBy: session.id,
          userId,
          companyId,
        }
      )
    } else {
      // 단일 테넌트: 기존 방식
      rowsAffected = await executeUpdate(
        `UPDATE ls_users
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
    }

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
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Admin user update error:', error)
    return NextResponse.json(
      { success: false, message: '회원 상태 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
