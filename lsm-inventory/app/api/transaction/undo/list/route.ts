import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/postgres'

interface SubulRecord {
  ID: number
  STORAGE: string
  LOCATION: string
  ITEM_CODE: string
  ITEM_NAME: string
  QTY: number
  CATEGORY: string
  SUBUL_TIME: Date
  REMARK: string | null
  USER_ID: string
}

// REMARK에서 undoMeta 파싱
function parseUndoMeta(remark: string | null): { meta: Record<string, unknown> | null; displayRemark: string } {
  if (!remark) return { meta: null, displayRemark: '' }

  // JSON|displayText 형식 파싱
  const pipeIndex = remark.indexOf('|')
  if (pipeIndex === -1) {
    // JSON만 있는 경우
    try {
      const meta = JSON.parse(remark)
      return { meta, displayRemark: '' }
    } catch {
      return { meta: null, displayRemark: remark }
    }
  }

  const jsonPart = remark.substring(0, pipeIndex)
  const displayPart = remark.substring(pipeIndex + 1)

  try {
    const meta = JSON.parse(jsonPart)
    return { meta, displayRemark: displayPart }
  } catch {
    return { meta: null, displayRemark: remark }
  }
}

// 취소 가능한 카테고리 목록
const UNDOABLE_CATEGORIES = ['출고', '이동(출)', '이동(병합)']

// 최근 작업 조회 (취소 가능한 작업만)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '20')

    // 24시간 이내 작업만 조회
    const hoursLimit = 24

    let query = `
      SELECT ID, STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, QTY, CATEGORY, SUBUL_TIME, REMARK, USER_ID
      FROM LS_MOTOR_SUBUL
      WHERE CATEGORY IN ('출고', '이동(출)', '이동(병합)')
        AND SUBUL_TIME > NOW() - :hoursLimit/24
        AND REMARK NOT LIKE '%"undone":true%'
    `
    const params: Record<string, unknown> = { hoursLimit }

    // 사용자 필터링 (선택적)
    if (userId) {
      query += ` AND USER_ID = :userId`
      params.userId = userId
    }

    query += ` ORDER BY SUBUL_TIME DESC FETCH FIRST :limit ROWS ONLY`
    params.limit = limit

    const rows = await executeQuery<SubulRecord>(query, params)

    const items = rows.map(row => {
      const { meta, displayRemark } = parseUndoMeta(row.REMARK)

      return {
        id: row.ID,
        storage: row.STORAGE,
        location: row.LOCATION,
        itemCode: row.ITEM_CODE,
        itemName: row.ITEM_NAME,
        qty: row.QTY,
        category: row.CATEGORY,
        subulTime: row.SUBUL_TIME,
        displayRemark,
        userId: row.USER_ID,
        canUndo: meta !== null && UNDOABLE_CATEGORIES.includes(row.CATEGORY),
        undoMeta: meta,
      }
    })

    return NextResponse.json({
      success: true,
      items,
    })
  } catch (error) {
    console.error('Undo list error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
