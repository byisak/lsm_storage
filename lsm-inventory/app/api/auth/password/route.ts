import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { executeQuery, withTransaction, LsUser } from '@/lib/oracle'

// 비밀번호 변경
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, currentPassword, newPassword } = body

    // 필수 필드 검증
    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 새 비밀번호 유효성 검사
    if (newPassword.length < 4) {
      return NextResponse.json(
        { success: false, message: '비밀번호는 4자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // 사용자 조회
    const users = await executeQuery<LsUser>(
      `SELECT ID, PASSWORD FROM LS_USERS WHERE ID = :id`,
      { id: userId }
    )

    if (users.length === 0) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const user = users[0]

    // 현재 비밀번호 검증
    const isValidPassword = await bcrypt.compare(currentPassword, user.PASSWORD)
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, message: '현재 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // 새 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // 비밀번호 업데이트
    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE LS_USERS SET PASSWORD = :password WHERE ID = :id`,
        { password: hashedPassword, id: userId },
        { autoCommit: false }
      )
    })

    return NextResponse.json({
      success: true,
      message: '비밀번호가 변경되었습니다.',
    })
  } catch (error) {
    console.error('Password change error:', error)
    return NextResponse.json(
      { success: false, message: '비밀번호 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
