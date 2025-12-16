import { NextResponse } from 'next/server'
import { executeQuery } from '@/lib/oracle'

interface RecentLocation {
  LOCATION: string
  STORAGE: string
}

interface RecentItem {
  ITEM_CODE: string
  ITEM_NAME: string
}

// 최근 입고 기록 조회 (위치, 품목코드)
export async function GET() {
  try {
    // 최근 입고 기록에서 위치 정보 가져오기
    const recentLocations = await executeQuery<RecentLocation>(
      `SELECT LOCATION, STORAGE FROM LS_MOTOR_SUBUL
       WHERE CATEGORY = '입고'
       ORDER BY SUBUL_TIME DESC
       FETCH FIRST 50 ROWS ONLY`
    )

    // 최근 입고 기록에서 품목 정보 가져오기
    const recentItems = await executeQuery<RecentItem>(
      `SELECT ITEM_CODE, ITEM_NAME FROM LS_MOTOR_SUBUL
       WHERE CATEGORY = '입고'
       ORDER BY SUBUL_TIME DESC
       FETCH FIRST 50 ROWS ONLY`
    )

    // 위치 중복 제거 (location + storage 조합)
    const uniqueLocations = Array.from(
      new Map(
        recentLocations.map(item => [
          `${item.STORAGE}-${item.LOCATION}`,
          { location: item.LOCATION, storage: item.STORAGE }
        ])
      ).values()
    ).slice(0, 10)

    // 품목 중복 제거 (itemCode 기준)
    const uniqueItems = Array.from(
      new Map(
        recentItems.map(item => [
          item.ITEM_CODE,
          { itemCode: item.ITEM_CODE, itemName: item.ITEM_NAME }
        ])
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
