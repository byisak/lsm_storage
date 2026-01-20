import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/mysql'

interface SubulRecord {
  idx: number
  storage: string
  Location: string
  itemCode: string
  itemName: string
  Qty: number
  Category: string
  Subul_Time: Date
  Remark: string | null
  user: string
}

// Remark에서 undoMeta 파싱
function parseUndoMeta(remark: string | null): { meta: Record<string, unknown> | null; displayRemark: string } {
  if (!remark) return { meta: null, displayRemark: '' }

  // JSON|displayText 형식 파싱
  const pipeIndex = remark.indexOf('|')
  if (pipeIndex === -1) {
    // JSON만 있는 경우 또는 일반 텍스트
    // JSON으로 시작하지 않으면 일반 텍스트로 처리
    if (!remark.startsWith('{')) {
      return { meta: null, displayRemark: remark }
    }
    try {
      const meta = JSON.parse(remark)
      return { meta, displayRemark: '' }
    } catch {
      // 잘린 JSON - 빈 문자열 반환 (깨진 JSON 표시 방지)
      return { meta: null, displayRemark: '' }
    }
  }

  const jsonPart = remark.substring(0, pipeIndex)
  const displayPart = remark.substring(pipeIndex + 1)

  try {
    const meta = JSON.parse(jsonPart)
    return { meta, displayRemark: displayPart }
  } catch {
    // 잘린 JSON - displayPart만 표시
    return { meta: null, displayRemark: displayPart || '' }
  }
}

// 취소 가능한 카테고리 목록
const UNDOABLE_CATEGORIES = ['출고', '이동(출)', '이동(병합)', '수정']

// 최근 작업 조회 (취소 가능한 작업만)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20')), 100)

    // 24시간 이내 작업만 조회
    const hoursLimit = 24

    let query = `
      SELECT idx, storage, Location, itemCode, itemName, Qty, Category, Subul_Time, Remark, user
      FROM ls_motor_subul
      WHERE Category IN ('출고', '이동(출)', '이동(병합)', '수정')
        AND Subul_Time > DATE_SUB(NOW(), INTERVAL ${hoursLimit} HOUR)
        AND (Remark IS NULL OR Remark NOT LIKE :undonePattern)
    `
    const params: Record<string, unknown> = {
      undonePattern: '%"undone":true%',
    }

    // 사용자 필터링 (선택적)
    if (userId) {
      query += ` AND user = :userId`
      params.userId = userId
    }

    query += ` ORDER BY Subul_Time DESC LIMIT ${limit}`

    const rows = await executeQuery<SubulRecord>(query, params)

    const items = rows.map(row => {
      const { meta, displayRemark } = parseUndoMeta(row.Remark)

      return {
        id: row.idx,
        storage: row.storage,
        location: row.Location,
        itemCode: row.itemCode,
        itemName: row.itemName,
        qty: row.Qty,
        category: row.Category,
        subulTime: row.Subul_Time,
        displayRemark,
        userId: row.user,
        canUndo: meta !== null && UNDOABLE_CATEGORIES.includes(row.Category),
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
