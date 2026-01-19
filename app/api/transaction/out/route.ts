import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, withTransaction, LsMotorRack } from '@/lib/mysql'

// 출고 처리
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const { rackId, qty, remark, user } = data

    // 필수 값 검증
    if (!rackId || !qty || qty <= 0) {
      return NextResponse.json(
        { success: false, message: '필수 입력값이 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 기존 재고 확인
    const rackRows = await executeQuery<LsMotorRack>(
      `SELECT ID, STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, NOW_QTY, IN_DAY, REMARK
       FROM ls_motor_rack WHERE ID = :id`,
      { id: rackId }
    )

    if (rackRows.length === 0) {
      return NextResponse.json(
        { success: false, message: '해당 재고를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const rack = {
      id: rackRows[0].ID,
      storage: rackRows[0].STORAGE,
      location: rackRows[0].LOCATION,
      itemCode: rackRows[0].ITEM_CODE,
      itemName: rackRows[0].ITEM_NAME,
      nowQty: rackRows[0].NOW_QTY,
      inDay: rackRows[0].IN_DAY,
      remark: rackRows[0].REMARK,
    }

    if (rack.nowQty < qty) {
      return NextResponse.json(
        { success: false, message: `재고가 부족합니다. (현재고: ${rack.nowQty})` },
        { status: 400 }
      )
    }

    const now = new Date()
    const newQty = rack.nowQty - qty

    // 트랜잭션으로 처리
    const result = await withTransaction(async (connection) => {
      let updatedRack = null

      if (newQty === 0) {
        // 재고가 0이면 삭제
        await connection.execute(
          `DELETE FROM ls_motor_rack WHERE ID = :id`,
          { id: rackId },
          { autoCommit: false }
        )
      } else {
        // 재고 차감
        await connection.execute(
          `UPDATE ls_motor_rack SET NOW_QTY = :nowQty WHERE ID = :id`,
          { nowQty: newQty, id: rackId },
          { autoCommit: false }
        )

        const rows = await connection.query<LsMotorRack>(
          `SELECT ID, STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, NOW_QTY, IN_DAY, REMARK
           FROM ls_motor_rack WHERE ID = :id`,
          { id: rackId }
        )
        updatedRack = rows[0]
      }

      // 수불 이력 추가 (복구용 메타데이터 포함)
      const undoMeta = JSON.stringify({
        type: 'out',
        rackId: rack.id,
        beforeQty: rack.nowQty,
        afterQty: newQty,
        inDay: rack.inDay,
        originalRemark: rack.remark,
      })
      const fullRemark = remark ? `${undoMeta}|${remark}` : undoMeta

      await connection.execute(
        `INSERT INTO ls_motor_subul (STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, QTY, CATEGORY, SUBUL_TIME, REMARK, USER_ID)
         VALUES (:storage, :location, :itemCode, :itemName, :qty, :category, :subulTime, :remark, :userId)`,
        {
          storage: rack.storage,
          location: rack.location,
          itemCode: rack.itemCode,
          itemName: rack.itemName,
          qty,
          category: '출고',
          subulTime: now,
          remark: fullRemark,
          userId: user || 'system',
        },
        { autoCommit: false }
      )

      return updatedRack
    })

    return NextResponse.json({
      success: true,
      message: '출고가 완료되었습니다.',
      data: result ? {
        id: result.ID,
        storage: result.STORAGE,
        location: result.LOCATION,
        itemCode: result.ITEM_CODE,
        itemName: result.ITEM_NAME,
        nowQty: result.NOW_QTY,
        inDay: result.IN_DAY,
        remark: result.REMARK,
      } : null,
      deleted: result === null,
    })
  } catch (error) {
    console.error('Transaction out error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
