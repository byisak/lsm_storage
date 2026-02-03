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
    const category = searchParams.get('category')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    let sql: string
    const binds: Record<string, unknown> = {}
    const conditions: string[] = []

    if (isMultiTenantEnabled()) {
      // 멀티테넌트: 회사별 필터링
      sql = `SELECT idx, storage, Location, itemCode, itemName, Qty, Category, Subul_Time, Remark, user
             FROM ls_motor_subul`
      conditions.push('COMPANY_ID = :companyId')
      binds.companyId = session.companyId
    } else {
      // 단일 테넌트: 기존 방식
      sql = `SELECT idx, storage, Location, itemCode, itemName, Qty, Category, Subul_Time, Remark, user
             FROM ls_motor_subul`
    }

    // 품목코드 필터
    if (itemCode) {
      conditions.push(`UPPER(itemCode) LIKE UPPER(:itemCode)`)
      binds.itemCode = `%${itemCode.trim()}%`
    }

    // 카테고리 필터
    if (category && category !== '전체') {
      if (category === '이동') {
        conditions.push(`Category LIKE '%이동%'`)
      } else {
        conditions.push(`Category = :category`)
        binds.category = category
      }
    }

    // 날짜 필터
    if (dateFrom) {
      conditions.push(`Subul_Time >= :dateFrom`)
      binds.dateFrom = dateFrom
    }
    if (dateTo) {
      conditions.push(`Subul_Time <= :dateTo`)
      binds.dateTo = dateTo + ' 23:59:59'
    }

    // WHERE 절 추가
    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ')
    }

    // MySQL uses LIMIT with OFFSET for pagination
    const safeLimit = Math.min(Math.max(1, limit), 100)
    const safeOffset = Math.max(0, offset)
    sql += ` ORDER BY Subul_Time DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`

    const items = await executeQuery<LsMotorSubul>(sql, binds)

    // camelCase로 변환
    const formattedItems = items.map(item => ({
      id: item.idx,
      storage: item.storage,
      location: item.Location,
      itemCode: item.itemCode,
      itemName: item.itemName,
      qty: item.Qty,
      category: item.Category,
      subulTime: item.Subul_Time,
      remark: item.Remark,
      user: item.user,
    }))

    return NextResponse.json({
      success: true,
      items: formattedItems,
      count: formattedItems.length,
      hasMore: formattedItems.length === safeLimit, // 더 불러올 데이터가 있는지
    })
  } catch (error) {
    console.error('History error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
