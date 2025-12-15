import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 위치로 랙 검색
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get('location')

    if (!location) {
      return NextResponse.json(
        { success: false, message: '위치를 입력해주세요.' },
        { status: 400 }
      )
    }

    const items = await prisma.lsMotorRack.findMany({
      where: {
        location: {
          contains: location.trim(),
        },
      },
      orderBy: {
        location: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
    })
  } catch (error) {
    console.error('Rack search error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
