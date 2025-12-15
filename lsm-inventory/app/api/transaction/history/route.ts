import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, LsMotorSubul } from '@/lib/oracle'

// 수불 이력 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const itemCode = searchParams.get('itemCode')
    const limit = parseInt(searchParams.get('limit') || '50')

    let sql = `SELECT ID, STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, QTY, CATEGORY, SUBUL_TIME, REMARK, USER_ID
               FROM LS_MOTOR_SUBUL`
    const binds: Record<string, unknown> = {}

    if (itemCode) {
      sql += ` WHERE UPPER(ITEM_CODE) LIKE UPPER(:itemCode)`
      binds.itemCode = `%${itemCode.trim()}%`
    }

    sql += ` ORDER BY SUBUL_TIME DESC FETCH FIRST :limit ROWS ONLY`
    binds.limit = limit

    const items = await executeQuery<LsMotorSubul>(sql, binds)

    // camelCase로 변환
    const formattedItems = items.map(item => ({
      id: item.ID,
      storage: item.STORAGE,
      location: item.LOCATION,
      itemCode: item.ITEM_CODE,
      itemName: item.ITEM_NAME,
      qty: item.QTY,
      category: item.CATEGORY,
      subulTime: item.SUBUL_TIME,
      remark: item.REMARK,
      user: item.USER_ID,
    }))

    return NextResponse.json({
      success: true,
      items: formattedItems,
      count: formattedItems.length,
    })
  } catch (error) {
    console.error('History error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
