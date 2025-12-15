import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { matchChosung } from '@/lib/korean-utils'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''

    if (!query.trim() || query.length < 1) {
      return NextResponse.json({ success: true, items: [] })
    }

    // 모든 품목 가져오기 (캐싱 고려 필요시 추가)
    const allItems = await prisma.lsMotorItem.findMany({
      select: {
        itemCode: true,
        itemName: true,
      },
    })

    // 초성 검색 및 일반 검색
    const filtered = allItems.filter(item => {
      const codeMatch = item.itemCode.toLowerCase().includes(query.toLowerCase())
      const nameMatch = matchChosung(item.itemName, query)
      return codeMatch || nameMatch
    })

    // 최대 10개만 반환
    const items = filtered.slice(0, 10)

    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error('Autocomplete error:', error)
    return NextResponse.json(
      { success: false, message: '자동완성 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
