import { NextResponse } from 'next/server'
import { executeQuery } from '@/lib/mysql'
import { getSession } from '@/lib/auth'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

interface RecentLocation {
  Location: string
  storage: string
}

interface RecentItem {
  itemCode: string
  itemName: string
}

// 최근 입고 기록 조회 (위치, 품목코드)
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    let recentLocations: RecentLocation[]
    let recentItems: RecentItem[]

    if (isMultiTenantEnabled()) {
      // 멀티테넌트: 회사별 필터링
      recentLocations = await executeQuery<RecentLocation>(
        `SELECT Location, storage FROM ls_motor_subul
         WHERE Category = '입고' AND COMPANY_ID = :companyId
         ORDER BY Subul_Time DESC
         FETCH FIRST 50 ROWS ONLY`,
        { companyId: session.companyId }
      )

      recentItems = await executeQuery<RecentItem>(
        `SELECT itemCode, itemName FROM ls_motor_subul
         WHERE Category = '입고' AND COMPANY_ID = :companyId
         ORDER BY Subul_Time DESC
         FETCH FIRST 50 ROWS ONLY`,
        { companyId: session.companyId }
      )
    } else {
      // 단일 테넌트: 기존 방식
      recentLocations = await executeQuery<RecentLocation>(
        `SELECT Location, storage FROM ls_motor_subul
         WHERE Category = '입고'
         ORDER BY Subul_Time DESC
         FETCH FIRST 50 ROWS ONLY`
      )

      recentItems = await executeQuery<RecentItem>(
        `SELECT itemCode, itemName FROM ls_motor_subul
         WHERE Category = '입고'
         ORDER BY Subul_Time DESC
         FETCH FIRST 50 ROWS ONLY`
      )
    }

    // 위치 중복 제거 (location + storage 조합)
    const uniqueLocations = Array.from(
      new Map(
        recentLocations.map(item => [
          `${item.storage}-${item.Location}`,
          { location: item.Location, storage: item.storage }
        ])
      ).values()
    ).slice(0, 10)

    // 품목 중복 제거 (itemCode 기준)
    const uniqueItems = Array.from(
      new Map(
        recentItems.map(item => [
          item.itemCode,
          { itemCode: item.itemCode, itemName: item.itemName }
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
