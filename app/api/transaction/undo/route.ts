import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, withTransaction, LsMotorRack } from '@/lib/mysql'

interface SubulRecord {
  ID: number
  storage: string
  Location: string
  itemCode: string
  itemName: string
  Qty: number
  Category: string
  Subul_Time: Date
  remark: string | null
  user: string
}

// 압축된 키 형식 (t=type, r=rackId, q=qty, ts=toStorage, tl=toLocation, m=isMerge, tq=targetBeforeQty)
interface UndoMeta {
  // 압축 키
  t?: string      // type: 'out' | 'mv'
  r?: number      // rackId
  q?: number      // beforeQty
  ts?: string     // toStorage
  tl?: string     // toLocation
  m?: number      // isMerge (0 or 1)
  tq?: number     // targetBeforeQty
  // 레거시 키 (하위 호환)
  type?: string
  rackId?: number
  beforeQty?: number
  toStorage?: string
  toLocation?: string
  isMerge?: boolean
  targetBeforeQty?: number
}

// remark에서 undoMeta 파싱
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
      `SELECT ID, storage, Location, itemCode, itemName, Qty, Category, Subul_Time, remark, user
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
    const meta = parseUndoMeta(subul.remark)

    if (!meta) {
      return NextResponse.json(
        { success: false, message: '이 작업은 취소할 수 없습니다. (복구 정보 없음)' },
        { status: 400 }
      )
    }

    // 이미 취소된 작업인지 확인
    if (subul.remark?.includes('"undone":true')) {
      return NextResponse.json(
        { success: false, message: '이미 취소된 작업입니다.' },
        { status: 400 }
      )
    }

    const now = new Date()

    // 카테고리별 역작업 수행
    if (subul.Category === '출고') {
      // 출고 취소 = 재입고
      await undoOutbound(subul, meta, now, user)
    } else if (subul.Category === '이동(출)' || subul.Category === '이동(병합)') {
      // 이동 취소 = 역방향 이동
      await undoMove(subul, meta, now, user)
    } else {
      return NextResponse.json(
        { success: false, message: `${subul.Category} 작업은 취소할 수 없습니다.` },
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
      `SELECT ID, Now_Qty FROM ls_motor_rack
       WHERE storage = :storage AND Location = :location AND itemCode = :itemCode`,
      { storage: subul.storage, location: subul.Location, itemCode: subul.itemCode }
    )

    if (existingRows.length > 0) {
      // 기존 품목이 있으면 수량 추가
      await connection.execute(
        `UPDATE ls_motor_rack SET Now_Qty = Now_Qty + :qty WHERE ID = :id`,
        { qty: subul.Qty, id: existingRows[0].ID },
        { autoCommit: false }
      )
    } else {
      // 품목이 없으면 새로 생성 (출고로 삭제된 경우)
      await connection.execute(
        `INSERT INTO ls_motor_rack (storage, Location, itemCode, itemName, Now_Qty, In_day, remark)
         VALUES (:storage, :location, :itemCode, :itemName, :nowQty, :inDay, :remark)`,
        {
          storage: subul.storage,
          location: subul.Location,
          itemCode: subul.itemCode,
          itemName: subul.itemName,
          nowQty: subul.Qty,
          inDay: meta.inDay || null,
          remark: meta.originalRemark || null,
        },
        { autoCommit: false }
      )
    }

    // 취소 이력 기록
    await connection.execute(
      `INSERT INTO ls_motor_subul (storage, Location, itemCode, itemName, Qty, Category, Subul_Time, remark, user)
       VALUES (:storage, :location, :itemCode, :itemName, :qty, :category, :subulTime, :remark, :userId)`,
      {
        storage: subul.storage,
        location: subul.Location,
        itemCode: subul.itemCode,
        itemName: subul.itemName,
        qty: subul.Qty,
        category: '출고취소',
        subulTime: now,
        remark: `출고 취소 (원본 ID: ${subul.ID})`,
        userId: user || 'system',
      },
      { autoCommit: false }
    )

    // 원본 이력에 취소 표시
    const updatedRemark = subul.remark?.replace('}', ',"undone":true}') || '{"undone":true}'
    await connection.execute(
      `UPDATE ls_motor_subul SET remark = :remark WHERE ID = :id`,
      { remark: updatedRemark, id: subul.ID },
      { autoCommit: false }
    )
  })
}

// 이동 취소 (역방향 이동)
async function undoMove(subul: SubulRecord, meta: UndoMeta, now: Date, user: string) {
  await withTransaction(async (connection) => {
    // 압축 키와 레거시 키 모두 지원
    const toStorage = meta.ts || meta.toStorage
    const toLocation = meta.tl || meta.toLocation
    const targetBeforeQty = meta.tq ?? meta.targetBeforeQty
    const isMerge = meta.m === 1 || meta.isMerge

    if (!toStorage || !toLocation) {
      throw new Error('이동 복구 정보가 불완전합니다.')
    }

    // 1. 목적지에서 수량 차감
    const targetRows = await connection.query<LsMotorRack>(
      `SELECT ID, Now_Qty FROM ls_motor_rack
       WHERE storage = :storage AND Location = :location AND itemCode = :itemCode`,
      { storage: toStorage, location: toLocation, itemCode: subul.itemCode }
    )

    if (targetRows.length > 0) {
      const targetRack = targetRows[0]
      const newQty = targetRack.Now_Qty - subul.Qty

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
          `UPDATE ls_motor_rack SET Now_Qty = :qty WHERE ID = :id`,
          { qty: newQty, id: targetRack.ID },
          { autoCommit: false }
        )
      }
    }

    // 2. 출발지에 수량 복원
    const sourceRows = await connection.query<LsMotorRack>(
      `SELECT ID, Now_Qty FROM ls_motor_rack
       WHERE storage = :storage AND Location = :location AND itemCode = :itemCode`,
      { storage: subul.storage, location: subul.Location, itemCode: subul.itemCode }
    )

    if (sourceRows.length > 0) {
      // 출발지에 품목이 있으면 수량 추가
      await connection.execute(
        `UPDATE ls_motor_rack SET Now_Qty = Now_Qty + :qty WHERE ID = :id`,
        { qty: subul.Qty, id: sourceRows[0].ID },
        { autoCommit: false }
      )
    } else {
      // 출발지에 품목이 없으면 새로 생성 (전체 이동으로 삭제된 경우)
      await connection.execute(
        `INSERT INTO ls_motor_rack (storage, Location, itemCode, itemName, Now_Qty, In_day, remark)
         VALUES (:storage, :location, :itemCode, :itemName, :nowQty, :inDay, :remark)`,
        {
          storage: subul.storage,
          location: subul.Location,
          itemCode: subul.itemCode,
          itemName: subul.itemName,
          nowQty: subul.Qty,
          inDay: meta.inDay || null,
          remark: meta.originalRemark || null,
        },
        { autoCommit: false }
      )
    }

    // 3. 취소 이력 기록
    const categoryLabel = isMerge ? '이동(병합)취소' : '이동취소'
    await connection.execute(
      `INSERT INTO ls_motor_subul (storage, Location, itemCode, itemName, Qty, Category, Subul_Time, remark, user)
       VALUES (:storage, :location, :itemCode, :itemName, :qty, :category, :subulTime, :remark, :userId)`,
      {
        storage: subul.storage,
        location: subul.Location,
        itemCode: subul.itemCode,
        itemName: subul.itemName,
        qty: subul.Qty,
        category: categoryLabel,
        subulTime: now,
        remark: `${toLocation}에서 복원 (원본 ID: ${subul.ID})`,
        userId: user || 'system',
      },
      { autoCommit: false }
    )

    // 4. 원본 이력에 취소 표시
    const updatedRemark = subul.remark?.replace('}', ',"undone":true}') || '{"undone":true}'
    await connection.execute(
      `UPDATE ls_motor_subul SET remark = :remark WHERE ID = :id`,
      { remark: updatedRemark, id: subul.ID },
      { autoCommit: false }
    )

    // 5. 이동(입) 이력도 취소 표시 (병합이 아닌 경우)
    if (!isMerge) {
      await connection.execute(
        `UPDATE ls_motor_subul
         SET remark = REPLACE(remark, '}', ',"undone":true}')
         WHERE Category = '이동(입)'
           AND storage = :storage AND Location = :location
           AND itemCode = :itemCode AND Qty = :qty
           AND Subul_Time = :subulTime`,
        {
          storage: toStorage,
          location: toLocation,
          itemCode: subul.itemCode,
          qty: subul.Qty,
          subulTime: subul.Subul_Time,
        },
        { autoCommit: false }
      )
    }
  })
}
