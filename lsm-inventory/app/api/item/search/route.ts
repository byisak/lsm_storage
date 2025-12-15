import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 품목코드 또는 품목명으로 검색
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')

    if (!q) {
      return NextResponse.json(
        { success: false, message: '검색어를 입력해주세요.' },
        { status: 400 }
      )
    }

    const items = await prisma.lsMotorRack.findMany({
      where: {
        OR: [
          { itemCode: { contains: q.trim() } },
          { itemName: { contains: q.trim() } },
        ],
      },
      orderBy: {
        itemCode: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
    })
  } catch (error) {
    console.error('Item search error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
