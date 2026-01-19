import { NextRequest, NextResponse } from 'next/server'
import { findUserByEmail, createSessionData, toUserInfo } from '@/lib/auth'
import { verifyPassword } from '@/lib/password'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // 필수 필드 검증
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      )
    }

    // 사용자 조회 (멀티테넌트 지원)
    const user = await findUserByEmail(email)

    if (!user) {
      return NextResponse.json(
        { success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // 비밀번호 검증 (scrypt/bcrypt 자동 감지)
    const isValidPassword = await verifyPassword(password, user.PASSWORD)
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // 승인 상태 확인
    if (user.STATUS === 'PENDING') {
      return NextResponse.json(
        { success: false, message: '관리자 승인 대기 중입니다.', status: 'PENDING' },
        { status: 403 }
      )
    }

    if (user.STATUS === 'REJECTED') {
      return NextResponse.json(
        { success: false, message: '승인이 거절된 계정입니다.', status: 'REJECTED' },
        { status: 403 }
      )
    }

    // 세션 데이터 생성 (회사 정보 포함)
    const sessionData = createSessionData(user)

    // 응답용 사용자 정보 (멀티테넌트 모드에 따라 회사 정보 포함 여부 결정)
    const userInfo = toUserInfo(sessionData)

    // 응답 생성
    const response = NextResponse.json({
      success: true,
      message: '로그인 성공',
      user: userInfo,
    })

    // 세션 쿠키 설정 (7일)
    response.cookies.set('auth-session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, message: '로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
