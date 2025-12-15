import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, LsMotorItem } from '@/lib/oracle'
import { matchChosung } from '@/lib/korean-utils'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''

    if (!query.trim() || query.length < 1) {
      return NextResponse.json({ success: true, items: [] })
    }

    // 모든 품목 가져오기
    const allItems = await executeQuery<LsMotorItem>(
      `SELECT ITEM_CODE, ITEM_NAME FROM LS_MOTOR_ITEM`
    )

    // 초성 검색 및 일반 검색
    const filtered = allItems.filter(item => {
      const codeMatch = item.ITEM_CODE.toLowerCase().includes(query.toLowerCase())
      const nameMatch = matchChosung(item.ITEM_NAME, query)
      return codeMatch || nameMatch
    })

    // 최대 10개만 반환 (camelCase 변환)
    const items = filtered.slice(0, 10).map(item => ({
      itemCode: item.ITEM_CODE,
      itemName: item.ITEM_NAME,
    }))

    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error('Autocomplete error:', error)
    return NextResponse.json(
      { success: false, message: '자동완성 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
