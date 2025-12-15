import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 최근 입고 기록 조회 (위치, 품목코드)
export async function GET() {
  try {
    // 최근 입고 기록에서 위치 정보 가져오기 (중복 제거)
    const recentLocations = await prisma.lsMotorSubul.findMany({
      where: {
        category: '입고',
      },
      select: {
        location: true,
        storage: true,
      },
      orderBy: {
        subulTime: 'desc',
      },
      take: 50,
    })

    // 최근 입고 기록에서 품목 정보 가져오기 (중복 제거)
    const recentItems = await prisma.lsMotorSubul.findMany({
      where: {
        category: '입고',
      },
      select: {
        itemCode: true,
        itemName: true,
      },
      orderBy: {
        subulTime: 'desc',
      },
      take: 50,
    })

    // 위치 중복 제거 (location + storage 조합)
    const uniqueLocations = Array.from(
      new Map(
        recentLocations.map(item => [`${item.storage}-${item.location}`, item])
      ).values()
    ).slice(0, 10)

    // 품목 중복 제거 (itemCode 기준)
    const uniqueItems = Array.from(
      new Map(
        recentItems.map(item => [item.itemCode, item])
      ).values()
    ).slice(0, 10)

    return NextResponse.json({
      success: true,
      locations: uniqueLocations,
      items: uniqueItems,
    })
  } catch (error) {
    console.error('Recent history error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
