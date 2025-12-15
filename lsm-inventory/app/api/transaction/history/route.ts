import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 수불 이력 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const itemCode = searchParams.get('itemCode')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where = itemCode
      ? { itemCode: { contains: itemCode.trim() } }
      : {}

    const items = await prisma.lsMotorSubul.findMany({
      where,
      orderBy: {
        subulTime: 'desc',
      },
      take: limit,
    })

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
    })
  } catch (error) {
    console.error('History error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
