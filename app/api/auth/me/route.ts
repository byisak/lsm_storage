import { NextResponse } from 'next/server'
import { getSession, toUserInfo } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.', user: null },
        { status: 401 }
      )
    }

    // 응답용 사용자 정보 (멀티테넌트 모드에 따라 회사 정보 포함 여부 결정)
    const userInfo = toUserInfo(session)

    return NextResponse.json({
      success: true,
      user: userInfo,
    })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { success: false, message: '인증 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 로그아웃
export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: '로그아웃 되었습니다.',
  })

  response.cookies.delete('auth-session')

  return response
}
