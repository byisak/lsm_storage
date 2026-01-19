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
      `SELECT idx, storage, Location, itemCode, itemName, Now_Qty, In_day, Remark
       FROM ls_motor_rack WHERE idx = :id`,
      { id: rackId }
    )

    if (rackRows.length === 0) {
      return NextResponse.json(
        { success: false, message: '해당 재고를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const rack = {
      id: rackRows[0].idx,
      storage: rackRows[0].storage,
      location: rackRows[0].Location,
      itemCode: rackRows[0].itemCode,
      itemName: rackRows[0].itemName,
      nowQty: rackRows[0].Now_Qty,
      inDay: rackRows[0].In_day,
      remark: rackRows[0].Remark,
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
          `DELETE FROM ls_motor_rack WHERE idx = :id`,
          { id: rackId },
          { autoCommit: false }
        )
      } else {
        // 재고 차감
        await connection.execute(
          `UPDATE ls_motor_rack SET Now_Qty = :nowQty WHERE idx = :id`,
          { nowQty: newQty, id: rackId },
          { autoCommit: false }
        )

        const rows = await connection.query<LsMotorRack>(
          `SELECT idx, storage, Location, itemCode, itemName, Now_Qty, In_day, Remark
           FROM ls_motor_rack WHERE idx = :id`,
          { id: rackId }
        )
        updatedRack = rows[0]
      }

      // 수불 이력 추가 (LSM_Warehouse_3D Remark 컬럼은 NOT NULL이므로 빈 문자열 사용)
      const simpleRemark = remark ? String(remark).substring(0, 100) : ''

      await connection.execute(
        `INSERT INTO ls_motor_subul (storage, Location, itemCode, itemName, Qty, Category, Subul_Time, Remark, user)
         VALUES (:storage, :location, :itemCode, :itemName, :qty, :category, :subulTime, :remark, :userId)`,
        {
          storage: rack.storage,
          location: rack.location,
          itemCode: rack.itemCode,
          itemName: rack.itemName,
          qty,
          category: '출고',
          subulTime: now,
          remark: simpleRemark,
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
        id: result.idx,
        storage: result.storage,
        location: result.Location,
        itemCode: result.itemCode,
        itemName: result.itemName,
        nowQty: result.Now_Qty,
        inDay: result.In_day,
        remark: result.Remark,
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
