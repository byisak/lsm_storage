import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, withTransaction, LsMotorRack } from '@/lib/oracle'
import oracledb from 'oracledb'

// 입고 처리
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const { storage, location, itemCode, itemName, qty, remark, user } = data

    // 필수 값 검증
    if (!storage || !location || !itemCode || !itemName || !qty || qty <= 0) {
      return NextResponse.json(
        { success: false, message: '필수 입력값이 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 기존 데이터 체크
    const existing = await executeQuery<LsMotorRack>(
      `SELECT ID FROM LS_MOTOR_RACK
       WHERE STORAGE = :storage AND LOCATION = :location AND ITEM_CODE = :itemCode`,
      { storage, location, itemCode }
    )

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, message: '이미 해당 위치에 같은 품목이 존재합니다.' },
        { status: 400 }
      )
    }

    const now = new Date()

    // 트랜잭션으로 처리
    const result = await withTransaction(async (connection) => {
      // 랙에 입고
      await connection.execute(
        `INSERT INTO LS_MOTOR_RACK (STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, NOW_QTY, IN_DAY, REMARK)
         VALUES (:storage, :location, :itemCode, :itemName, :nowQty, :inDay, :remark)`,
        {
          storage,
          location,
          itemCode,
          itemName,
          nowQty: qty,
          inDay: now,
          remark: remark || null,
        },
        { autoCommit: false }
      )

      // 수불 이력 추가
      await connection.execute(
        `INSERT INTO LS_MOTOR_SUBUL (STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, QTY, CATEGORY, SUBUL_TIME, REMARK, USER_ID)
         VALUES (:storage, :location, :itemCode, :itemName, :qty, :category, :subulTime, :remark, :userId)`,
        {
          storage,
          location,
          itemCode,
          itemName,
          qty,
          category: '입고',
          subulTime: now,
          remark: remark || null,
          userId: user || 'system',
        },
        { autoCommit: false }
      )

      // 방금 입고된 재고 조회
      const newRack = await connection.execute<LsMotorRack>(
        `SELECT ID, STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, NOW_QTY, IN_DAY, REMARK
         FROM LS_MOTOR_RACK
         WHERE STORAGE = :storage AND LOCATION = :location AND ITEM_CODE = :itemCode`,
        { storage, location, itemCode },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      )

      const rows = newRack.rows as LsMotorRack[]
      return rows[0]
    })

    return NextResponse.json({
      success: true,
      message: '입고가 완료되었습니다.',
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
    })
  } catch (error) {
    console.error('Transaction in error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
