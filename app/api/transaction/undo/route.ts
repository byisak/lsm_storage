import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, withTransaction, LsMotorRack } from '@/lib/mysql'

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

interface UndoMeta {
  type: string
  rackId?: number
  beforeQty?: number
  afterQty?: number
  inDay?: Date | null
  originalRemark?: string | null
  // 이동 관련
  sourceRackId?: number
  targetRackId?: number
  toStorage?: string
  toLocation?: string
  fromStorage?: string
  fromLocation?: string
  isMerge?: boolean
  targetBeforeQty?: number
}

// REMARK에서 undoMeta 파싱
function parseUndoMeta(remark: string | null): UndoMeta | null {
  if (!remark) return null

  const pipeIndex = remark.indexOf('|')
  const jsonPart = pipeIndex === -1 ? remark : remark.substring(0, pipeIndex)

  try {
    return JSON.parse(jsonPart) as UndoMeta
  } catch {
    return null
  }
}

// 실행취소 처리
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { subulId, user } = data

    if (!subulId) {
      return NextResponse.json(
        { success: false, message: '취소할 작업 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 이력 조회
    const subulRows = await executeQuery<SubulRecord>(
      `SELECT ID, STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, QTY, CATEGORY, SUBUL_TIME, REMARK, USER_ID
       FROM ls_motor_subul WHERE ID = :id`,
      { id: subulId }
    )

    if (subulRows.length === 0) {
      return NextResponse.json(
        { success: false, message: '해당 작업을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const subul = subulRows[0]
    const meta = parseUndoMeta(subul.REMARK)

    if (!meta) {
      return NextResponse.json(
        { success: false, message: '이 작업은 취소할 수 없습니다. (복구 정보 없음)' },
        { status: 400 }
      )
    }

    // 이미 취소된 작업인지 확인
    if (subul.REMARK?.includes('"undone":true')) {
      return NextResponse.json(
        { success: false, message: '이미 취소된 작업입니다.' },
        { status: 400 }
      )
    }

    const now = new Date()

    // 카테고리별 역작업 수행
    if (subul.CATEGORY === '출고') {
      // 출고 취소 = 재입고
      await undoOutbound(subul, meta, now, user)
    } else if (subul.CATEGORY === '이동(출)' || subul.CATEGORY === '이동(병합)') {
      // 이동 취소 = 역방향 이동
      await undoMove(subul, meta, now, user)
    } else {
      return NextResponse.json(
        { success: false, message: `${subul.CATEGORY} 작업은 취소할 수 없습니다.` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '작업이 취소되었습니다.',
    })
  } catch (error) {
    console.error('Undo error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 출고 취소 (재입고)
async function undoOutbound(subul: SubulRecord, meta: UndoMeta, now: Date, user: string) {
  await withTransaction(async (connection) => {
    // 현재 해당 위치에 품목이 있는지 확인
    const existingRows = await connection.query<LsMotorRack>(
      `SELECT ID, NOW_QTY FROM ls_motor_rack
       WHERE STORAGE = :storage AND LOCATION = :location AND ITEM_CODE = :itemCode`,
      { storage: subul.STORAGE, location: subul.LOCATION, itemCode: subul.ITEM_CODE }
    )

    if (existingRows.length > 0) {
      // 기존 품목이 있으면 수량 추가
      await connection.execute(
        `UPDATE ls_motor_rack SET NOW_QTY = NOW_QTY + :qty WHERE ID = :id`,
        { qty: subul.QTY, id: existingRows[0].ID },
        { autoCommit: false }
      )
    } else {
      // 품목이 없으면 새로 생성 (출고로 삭제된 경우)
      await connection.execute(
        `INSERT INTO ls_motor_rack (STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, NOW_QTY, IN_DAY, REMARK)
         VALUES (:storage, :location, :itemCode, :itemName, :nowQty, :inDay, :remark)`,
        {
          storage: subul.STORAGE,
          location: subul.LOCATION,
          itemCode: subul.ITEM_CODE,
          itemName: subul.ITEM_NAME,
          nowQty: subul.QTY,
          inDay: meta.inDay || null,
          remark: meta.originalRemark || null,
        },
        { autoCommit: false }
      )
    }

    // 취소 이력 기록
    await connection.execute(
      `INSERT INTO ls_motor_subul (STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, QTY, CATEGORY, SUBUL_TIME, REMARK, USER_ID)
       VALUES (:storage, :location, :itemCode, :itemName, :qty, :category, :subulTime, :remark, :userId)`,
      {
        storage: subul.STORAGE,
        location: subul.LOCATION,
        itemCode: subul.ITEM_CODE,
        itemName: subul.ITEM_NAME,
        qty: subul.QTY,
        category: '출고취소',
        subulTime: now,
        remark: `출고 취소 (원본 ID: ${subul.ID})`,
        userId: user || 'system',
      },
      { autoCommit: false }
    )

    // 원본 이력에 취소 표시
    const updatedRemark = subul.REMARK?.replace('}', ',"undone":true}') || '{"undone":true}'
    await connection.execute(
      `UPDATE ls_motor_subul SET REMARK = :remark WHERE ID = :id`,
      { remark: updatedRemark, id: subul.ID },
      { autoCommit: false }
    )
  })
}

// 이동 취소 (역방향 이동)
async function undoMove(subul: SubulRecord, meta: UndoMeta, now: Date, user: string) {
  await withTransaction(async (connection) => {
    const { toStorage, toLocation, sourceRackId, targetRackId, targetBeforeQty, isMerge } = meta

    if (!toStorage || !toLocation) {
      throw new Error('이동 복구 정보가 불완전합니다.')
    }

    // 1. 목적지에서 수량 차감
    const targetRows = await connection.query<LsMotorRack>(
      `SELECT ID, NOW_QTY FROM ls_motor_rack
       WHERE STORAGE = :storage AND LOCATION = :location AND ITEM_CODE = :itemCode`,
      { storage: toStorage, location: toLocation, itemCode: subul.ITEM_CODE }
    )

    if (targetRows.length > 0) {
      const targetRack = targetRows[0]
      const newQty = targetRack.NOW_QTY - subul.QTY

      if (newQty <= 0) {
        // 목적지 품목 삭제
        await connection.execute(
          `DELETE FROM ls_motor_rack WHERE ID = :id`,
          { id: targetRack.ID },
          { autoCommit: false }
        )
      } else {
        // 목적지 수량 감소
        await connection.execute(
          `UPDATE ls_motor_rack SET NOW_QTY = :qty WHERE ID = :id`,
          { qty: newQty, id: targetRack.ID },
          { autoCommit: false }
        )
      }
    }

    // 2. 출발지에 수량 복원
    const sourceRows = await connection.query<LsMotorRack>(
      `SELECT ID, NOW_QTY FROM ls_motor_rack
       WHERE STORAGE = :storage AND LOCATION = :location AND ITEM_CODE = :itemCode`,
      { storage: subul.STORAGE, location: subul.LOCATION, itemCode: subul.ITEM_CODE }
    )

    if (sourceRows.length > 0) {
      // 출발지에 품목이 있으면 수량 추가
      await connection.execute(
        `UPDATE ls_motor_rack SET NOW_QTY = NOW_QTY + :qty WHERE ID = :id`,
        { qty: subul.QTY, id: sourceRows[0].ID },
        { autoCommit: false }
      )
    } else {
      // 출발지에 품목이 없으면 새로 생성 (전체 이동으로 삭제된 경우)
      await connection.execute(
        `INSERT INTO ls_motor_rack (STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, NOW_QTY, IN_DAY, REMARK)
         VALUES (:storage, :location, :itemCode, :itemName, :nowQty, :inDay, :remark)`,
        {
          storage: subul.STORAGE,
          location: subul.LOCATION,
          itemCode: subul.ITEM_CODE,
          itemName: subul.ITEM_NAME,
          nowQty: subul.QTY,
          inDay: meta.inDay || null,
          remark: meta.originalRemark || null,
        },
        { autoCommit: false }
      )
    }

    // 3. 취소 이력 기록
    const categoryLabel = isMerge ? '이동(병합)취소' : '이동취소'
    await connection.execute(
      `INSERT INTO ls_motor_subul (STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, QTY, CATEGORY, SUBUL_TIME, REMARK, USER_ID)
       VALUES (:storage, :location, :itemCode, :itemName, :qty, :category, :subulTime, :remark, :userId)`,
      {
        storage: subul.STORAGE,
        location: subul.LOCATION,
        itemCode: subul.ITEM_CODE,
        itemName: subul.ITEM_NAME,
        qty: subul.QTY,
        category: categoryLabel,
        subulTime: now,
        remark: `${toLocation}에서 복원 (원본 ID: ${subul.ID})`,
        userId: user || 'system',
      },
      { autoCommit: false }
    )

    // 4. 원본 이력에 취소 표시
    const updatedRemark = subul.REMARK?.replace('}', ',"undone":true}') || '{"undone":true}'
    await connection.execute(
      `UPDATE ls_motor_subul SET REMARK = :remark WHERE ID = :id`,
      { remark: updatedRemark, id: subul.ID },
      { autoCommit: false }
    )

    // 5. 이동(입) 이력도 취소 표시 (병합이 아닌 경우)
    if (!isMerge) {
      await connection.execute(
        `UPDATE ls_motor_subul
         SET REMARK = REPLACE(REMARK, '}', ',"undone":true}')
         WHERE CATEGORY = '이동(입)'
           AND STORAGE = :storage AND LOCATION = :location
           AND ITEM_CODE = :itemCode AND QTY = :qty
           AND SUBUL_TIME = :subulTime`,
        {
          storage: toStorage,
          location: toLocation,
          itemCode: subul.ITEM_CODE,
          qty: subul.QTY,
          subulTime: subul.SUBUL_TIME,
        },
        { autoCommit: false }
      )
    }
  })
}
