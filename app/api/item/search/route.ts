import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, LsMotorRack } from '@/lib/mysql'
import { getSession } from '@/lib/auth'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

// 품목코드 또는 품목명으로 검색
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')

    if (!q) {
      return NextResponse.json(
        { success: false, message: '검색어를 입력해주세요.' },
        { status: 400 }
      )
    }

    const searchTerm = `%${q.trim()}%`
    let items: LsMotorRack[]

    if (isMultiTenantEnabled()) {
      // 멀티테넌트: 회사별 필터링
      items = await executeQuery<LsMotorRack>(
        `SELECT ID, STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, NOW_QTY, IN_DAY, REMARK, COMPANY_ID
         FROM LS_MOTOR_RACK
         WHERE (UPPER(ITEM_CODE) LIKE UPPER(:searchTerm)
            OR UPPER(ITEM_NAME) LIKE UPPER(:searchTerm))
           AND COMPANY_ID = :companyId
         ORDER BY ITEM_CODE ASC`,
        { searchTerm, companyId: session.companyId }
      )
    } else {
      // 단일 테넌트: 기존 방식
      items = await executeQuery<LsMotorRack>(
        `SELECT ID, STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, NOW_QTY, IN_DAY, REMARK
         FROM LS_MOTOR_RACK
         WHERE UPPER(ITEM_CODE) LIKE UPPER(:searchTerm)
            OR UPPER(ITEM_NAME) LIKE UPPER(:searchTerm)
         ORDER BY ITEM_CODE ASC`,
        { searchTerm }
      )
    }

    // 컬럼명을 camelCase로 변환
    const formattedItems = items.map(item => ({
      id: item.ID,
      storage: item.STORAGE,
      location: item.LOCATION,
      itemCode: item.ITEM_CODE,
      itemName: item.ITEM_NAME,
      nowQty: item.NOW_QTY,
      inDay: item.IN_DAY,
      remark: item.REMARK,
    }))

    return NextResponse.json({
      success: true,
      items: formattedItems,
      count: formattedItems.length,
    })
  } catch (error) {
    console.error('Item search error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
