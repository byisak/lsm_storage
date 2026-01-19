import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, LsMotorSubul } from '@/lib/mysql'
import { getSession } from '@/lib/auth'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

// 수불 이력 조회
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
    const itemCode = searchParams.get('itemCode')
    const limit = parseInt(searchParams.get('limit') || '50')

    let sql: string
    const binds: Record<string, unknown> = {}

    if (isMultiTenantEnabled()) {
      // 멀티테넌트: 회사별 필터링
      sql = `SELECT ID, storage, Location, itemCode, itemName, Qty, Category, Subul_Time, remark, user
             FROM ls_motor_subul WHERE COMPANY_ID = :companyId`
      binds.companyId = session.companyId

      if (itemCode) {
        sql += ` AND UPPER(itemCode) LIKE UPPER(:itemCode)`
        binds.itemCode = `%${itemCode.trim()}%`
      }
    } else {
      // 단일 테넌트: 기존 방식
      sql = `SELECT ID, storage, Location, itemCode, itemName, Qty, Category, Subul_Time, remark, user
             FROM ls_motor_subul`

      if (itemCode) {
        sql += ` WHERE UPPER(itemCode) LIKE UPPER(:itemCode)`
        binds.itemCode = `%${itemCode.trim()}%`
      }
    }

    sql += ` ORDER BY Subul_Time DESC FETCH FIRST :limit ROWS ONLY`
    binds.limit = limit

    const items = await executeQuery<LsMotorSubul>(sql, binds)

    // camelCase로 변환
    const formattedItems = items.map(item => ({
      id: item.ID,
      storage: item.storage,
      location: item.Location,
      itemCode: item.itemCode,
      itemName: item.itemName,
      qty: item.Qty,
      category: item.Category,
      subulTime: item.Subul_Time,
      remark: item.remark,
      user: item.user,
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
