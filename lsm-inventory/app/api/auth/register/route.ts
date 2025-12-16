import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { executeQuery, executeInsert, LsUser } from '@/lib/oracle'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password } = body

    // 필수 필드 검증
    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, message: '이름, 이메일, 비밀번호는 필수입니다.' },
        { status: 400 }
      )
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      )
    }

    // 비밀번호 최소 길이 검증
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: '비밀번호는 최소 6자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // 이메일 중복 확인
    const existingUsers = await executeQuery<LsUser>(
      `SELECT ID FROM LS_USERS WHERE EMAIL = :email`,
      { email: email.toLowerCase() }
    )

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { success: false, message: '이미 등록된 이메일입니다.' },
        { status: 400 }
      )
    }

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10)

    // 회원 등록
    await executeInsert(
      `INSERT INTO LS_USERS (NAME, EMAIL, PASSWORD, STATUS, ROLE)
       VALUES (:name, :email, :password, 'PENDING', 'USER')`,
      {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
      }
    )

    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.',
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { success: false, message: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
