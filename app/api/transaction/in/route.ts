import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, withTransaction, LsMotorRack } from '@/lib/mysql'
import { getSession } from '@/lib/auth'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

// 입고 처리
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const data = await request.json()

    const { storage, location, itemCode, itemName, qty, remark, user, merge } = data

    // 필수 값 검증
    if (!storage || !location || !itemCode || !itemName || !qty || qty <= 0) {
      return NextResponse.json(
        { success: false, message: '필수 입력값이 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 기존 데이터 체크 (회사별 필터링)
    let existing: LsMotorRack[]

    if (isMultiTenantEnabled()) {
      existing = await executeQuery<LsMotorRack>(
        `SELECT idx, Now_Qty, itemName FROM ls_motor_rack
         WHERE storage = :storage AND Location = :location AND itemCode = :itemCode AND COMPANY_ID = :companyId`,
        { storage, location, itemCode, companyId: session.companyId }
      )
    } else {
      existing = await executeQuery<LsMotorRack>(
        `SELECT idx, Now_Qty, itemName FROM ls_motor_rack
         WHERE storage = :storage AND Location = :location AND itemCode = :itemCode`,
        { storage, location, itemCode }
      )
    }

    if (existing.length > 0) {
      const existingItem = existing[0]

      // merge 파라미터가 없으면 병합 여부 확인 요청
      if (!merge) {
        return NextResponse.json({
          success: false,
          canMerge: true,
          message: '이미 해당 위치에 같은 품목이 존재합니다. 수량을 병합하시겠습니까?',
          existingItem: {
            id: existingItem.idx,
            currentQty: existingItem.Now_Qty,
            itemName: existingItem.itemName,
          },
          newQty: qty,
          mergedQty: existingItem.Now_Qty + qty,
        })
      }

      // merge=true면 수량 병합 처리
      const now = new Date()
      const beforeQty = existingItem.Now_Qty
      const afterQty = beforeQty + qty

      await withTransaction(async (connection) => {
        // 기존 재고 수량 업데이트
        await connection.execute(
          `UPDATE ls_motor_rack SET Now_Qty = :nowQty WHERE idx = :id`,
          { nowQty: afterQty, id: existingItem.idx },
          { autoCommit: false }
        )

        // 수불 이력 추가 (병합) - LSM_Warehouse_3D Remark 컬럼 길이 제한으로 100자로 자름
        const mergeRemark = `[${beforeQty}개 → ${afterQty}개] ${remark || ''}`.trim().substring(0, 100)
        await connection.execute(
          `INSERT INTO ls_motor_subul (storage, Location, itemCode, itemName, Qty, Category, Subul_Time, Remark, user)
           VALUES (:storage, :location, :itemCode, :itemName, :qty, :category, :subulTime, :remark, :userId)`,
          {
            storage,
            location,
            itemCode,
            itemName,
            qty,
            category: '입고(병합)',
            subulTime: now,
            remark: mergeRemark,
            userId: user || 'system',
          },
          { autoCommit: false }
        )
      })

      return NextResponse.json({
        success: true,
        message: `수량이 병합되었습니다. (${beforeQty}개 → ${afterQty}개)`,
        merged: true,
        data: {
          id: existingItem.idx,
          storage,
          location,
          itemCode,
          itemName,
          nowQty: afterQty,
        },
      })
    }

    const now = new Date()

    // LSM_Warehouse_3D Remark 컬럼 길이 제한으로 100자로 자름
    const truncatedRemark = remark ? String(remark).substring(0, 100) : null

    // 트랜잭션으로 처리
    const result = await withTransaction(async (connection) => {
      // 랙에 입고
      await connection.execute(
        `INSERT INTO ls_motor_rack (storage, Location, itemCode, itemName, Now_Qty, In_day, Remark)
         VALUES (:storage, :location, :itemCode, :itemName, :nowQty, :inDay, :remark)`,
        {
          storage,
          location,
          itemCode,
          itemName,
          nowQty: qty,
          inDay: now,
          remark: truncatedRemark,
        },
        { autoCommit: false }
      )

      // 수불 이력 추가
      await connection.execute(
        `INSERT INTO ls_motor_subul (storage, Location, itemCode, itemName, Qty, Category, Subul_Time, Remark, user)
         VALUES (:storage, :location, :itemCode, :itemName, :qty, :category, :subulTime, :remark, :userId)`,
        {
          storage,
          location,
          itemCode,
          itemName,
          qty,
          category: '입고',
          subulTime: now,
          remark: truncatedRemark,
          userId: user || 'system',
        },
        { autoCommit: false }
      )

      // 방금 입고된 재고 조회
      const rows = await connection.query<LsMotorRack>(
        `SELECT idx, storage, Location, itemCode, itemName, Now_Qty, In_day, Remark
         FROM ls_motor_rack
         WHERE storage = :storage AND Location = :location AND itemCode = :itemCode`,
        { storage, location, itemCode }
      )

      return rows[0]
    })

    return NextResponse.json({
      success: true,
      message: '입고가 완료되었습니다.',
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
    })
  } catch (error) {
    console.error('Transaction in error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
