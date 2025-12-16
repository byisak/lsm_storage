import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, withTransaction, LsMotorRack } from '@/lib/oracle'
import oracledb from 'oracledb'

// 재고 이동 (A 위치 → B 위치)
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { rackId, toStorage, toLocation, qty, user, merge } = data

    if (!rackId || !toStorage || !toLocation || !qty) {
      return NextResponse.json(
        { success: false, message: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 원본 재고 조회
    const sourceRows = await executeQuery<LsMotorRack>(
      `SELECT ID, STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, NOW_QTY, IN_DAY, REMARK
       FROM LS_MOTOR_RACK WHERE ID = :id`,
      { id: rackId }
    )

    if (sourceRows.length === 0) {
      return NextResponse.json(
        { success: false, message: '원본 재고를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const sourceRack = {
      id: sourceRows[0].ID,
      storage: sourceRows[0].STORAGE,
      location: sourceRows[0].LOCATION,
      itemCode: sourceRows[0].ITEM_CODE,
      itemName: sourceRows[0].ITEM_NAME,
      nowQty: sourceRows[0].NOW_QTY,
      inDay: sourceRows[0].IN_DAY,
      remark: sourceRows[0].REMARK,
    }

    if (qty > sourceRack.nowQty) {
      return NextResponse.json(
        { success: false, message: '이동 수량이 현재 재고보다 많습니다.' },
        { status: 400 }
      )
    }

    // 같은 위치로 이동 체크
    if (sourceRack.storage === toStorage && sourceRack.location === toLocation) {
      return NextResponse.json(
        { success: false, message: '같은 위치로는 이동할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 목적지에 동일 품목이 있는지 미리 확인 (병합 확인용)
    const existingTarget = await executeQuery<LsMotorRack>(
      `SELECT ID, NOW_QTY, ITEM_NAME FROM LS_MOTOR_RACK
       WHERE STORAGE = :storage AND LOCATION = :location AND ITEM_CODE = :itemCode`,
      { storage: toStorage, location: toLocation, itemCode: sourceRack.itemCode }
    )

    // 목적지에 동일 품목이 있고 merge 파라미터가 없으면 확인 요청
    if (existingTarget.length > 0 && !merge) {
      const targetItem = existingTarget[0]
      return NextResponse.json({
        success: false,
        canMerge: true,
        message: '이동 위치에 동일한 품목이 이미 존재합니다. 수량을 병합하시겠습니까?',
        existingItem: {
          id: targetItem.ID,
          currentQty: targetItem.NOW_QTY,
          itemName: targetItem.ITEM_NAME,
        },
        moveQty: qty,
        mergedQty: targetItem.NOW_QTY + qty,
      })
    }

    const now = new Date()

    // 트랜잭션으로 이동 처리
    await withTransaction(async (connection) => {
      // 1. 원본 재고 감소 또는 삭제
      if (qty === sourceRack.nowQty) {
        // 전체 이동이면 삭제
        await connection.execute(
          `DELETE FROM LS_MOTOR_RACK WHERE ID = :id`,
          { id: rackId },
          { autoCommit: false }
        )
      } else {
        // 부분 이동이면 수량 감소
        await connection.execute(
          `UPDATE LS_MOTOR_RACK SET NOW_QTY = :nowQty WHERE ID = :id`,
          { nowQty: sourceRack.nowQty - qty, id: rackId },
          { autoCommit: false }
        )
      }

      // 2. 목적지에 동일 품목이 있는지 확인
      const targetResult = await connection.execute<LsMotorRack>(
        `SELECT ID, NOW_QTY FROM LS_MOTOR_RACK
         WHERE STORAGE = :storage AND LOCATION = :location AND ITEM_CODE = :itemCode`,
        { storage: toStorage, location: toLocation, itemCode: sourceRack.itemCode },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      )
      const targetRows = targetResult.rows as LsMotorRack[]
      const existingTarget = targetRows.length > 0 ? targetRows[0] : null

      // 출발지 수량 변경 정보
      const sourceBeforeQty = sourceRack.nowQty
      const sourceAfterQty = sourceRack.nowQty - qty

      // 목적지 수량 변경 정보
      const targetBeforeQty = existingTarget ? existingTarget.NOW_QTY : 0
      const targetAfterQty = targetBeforeQty + qty

      if (existingTarget) {
        // 기존 재고에 수량 추가
        await connection.execute(
          `UPDATE LS_MOTOR_RACK SET NOW_QTY = :nowQty WHERE ID = :id`,
          { nowQty: existingTarget.NOW_QTY + qty, id: existingTarget.ID },
          { autoCommit: false }
        )
      } else {
        // 새 재고 생성
        await connection.execute(
          `INSERT INTO LS_MOTOR_RACK (STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, NOW_QTY, IN_DAY, REMARK)
           VALUES (:storage, :location, :itemCode, :itemName, :nowQty, :inDay, :remark)`,
          {
            storage: toStorage,
            location: toLocation,
            itemCode: sourceRack.itemCode,
            itemName: sourceRack.itemName,
            nowQty: qty,
            inDay: sourceRack.inDay,
            remark: sourceRack.remark,
          },
          { autoCommit: false }
        )
      }

      // 3. 이동 이력 기록 (출고) - 복구용 메타데이터 포함
      const isMerge = existingTarget && merge
      const sourceCategory = isMerge ? '이동(병합)' : '이동(출)'

      // 목적지 rack ID 조회 (신규 생성된 경우)
      let targetRackId = existingTarget ? existingTarget.ID : null
      if (!existingTarget) {
        const newTargetResult = await connection.execute<{ ID: number }>(
          `SELECT ID FROM LS_MOTOR_RACK WHERE STORAGE = :storage AND LOCATION = :location AND ITEM_CODE = :itemCode`,
          { storage: toStorage, location: toLocation, itemCode: sourceRack.itemCode },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        )
        const newTargetRows = newTargetResult.rows as { ID: number }[]
        if (newTargetRows.length > 0) {
          targetRackId = newTargetRows[0].ID
        }
      }

      const sourceUndoMeta = JSON.stringify({
        type: 'move_out',
        sourceRackId: rackId,
        targetRackId: targetRackId,
        toStorage: toStorage,
        toLocation: toLocation,
        beforeQty: sourceBeforeQty,
        afterQty: sourceAfterQty,
        inDay: sourceRack.inDay,
        originalRemark: sourceRack.remark,
        isMerge: isMerge,
        targetBeforeQty: targetBeforeQty,
      })
      const sourceRemark = `${sourceUndoMeta}|→ ${toLocation} (${toStorage}) [${sourceBeforeQty}개 → ${sourceAfterQty}개]`

      await connection.execute(
        `INSERT INTO LS_MOTOR_SUBUL (STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, QTY, CATEGORY, SUBUL_TIME, REMARK, USER_ID)
         VALUES (:storage, :location, :itemCode, :itemName, :qty, :category, :subulTime, :remark, :userId)`,
        {
          storage: sourceRack.storage,
          location: sourceRack.location,
          itemCode: sourceRack.itemCode,
          itemName: sourceRack.itemName,
          qty: qty,
          category: sourceCategory,
          subulTime: now,
          remark: sourceRemark,
          userId: user || 'mobile',
        },
        { autoCommit: false }
      )

      // 4. 이동 이력 기록 (입고) - 병합이 아닌 경우만 기록
      if (!isMerge) {
        const targetUndoMeta = JSON.stringify({
          type: 'move_in',
          sourceRackId: rackId,
          targetRackId: targetRackId,
          fromStorage: sourceRack.storage,
          fromLocation: sourceRack.location,
          beforeQty: targetBeforeQty,
          afterQty: targetAfterQty,
          isNew: !existingTarget,
        })
        const targetRemark = existingTarget
          ? `${targetUndoMeta}|← ${sourceRack.location} (${sourceRack.storage}) [${targetBeforeQty}개 → ${targetAfterQty}개]`
          : `${targetUndoMeta}|← ${sourceRack.location} (${sourceRack.storage}) [신규]`

        await connection.execute(
          `INSERT INTO LS_MOTOR_SUBUL (STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, QTY, CATEGORY, SUBUL_TIME, REMARK, USER_ID)
           VALUES (:storage, :location, :itemCode, :itemName, :qty, :category, :subulTime, :remark, :userId)`,
          {
            storage: toStorage,
            location: toLocation,
            itemCode: sourceRack.itemCode,
            itemName: sourceRack.itemName,
            qty: qty,
            category: '이동(입)',
            subulTime: now,
            remark: targetRemark,
            userId: user || 'mobile',
          },
          { autoCommit: false }
        )
      }
    })

    // 병합 여부에 따른 메시지
    const resultMessage = merge
      ? `${qty}개가 ${toLocation}으로 병합되었습니다.`
      : `${qty}개가 ${toLocation}으로 이동되었습니다.`

    return NextResponse.json({
      success: true,
      message: resultMessage,
    })
  } catch (error) {
    console.error('Move error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
