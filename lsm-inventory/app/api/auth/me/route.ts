import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('auth-session')

    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.', user: null },
        { status: 401 }
      )
    }

    try {
      const user = JSON.parse(sessionCookie.value)
      return NextResponse.json({
        success: true,
        user,
      })
    } catch {
      return NextResponse.json(
        { success: false, message: '세션이 유효하지 않습니다.', user: null },
        { status: 401 }
      )
    }
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
