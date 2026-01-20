import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, withTransaction, LsMotorRack } from '@/lib/mysql'
import { getSession } from '@/lib/auth'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

// 수정 내역 문자열 생성 함수
function buildChangeDescription(
  existing: {
    itemCode: string
    itemName: string
    nowQty: number
    inDay: Date | null
    remark: string | null
  },
  updated: {
    itemCode?: string
    itemName?: string
    nowQty?: number
    inDay?: Date | null
    remark?: string | null
  }
): string {
  const changes: string[] = []

  if (updated.itemCode !== undefined && updated.itemCode !== existing.itemCode) {
    changes.push(`품목코드: ${existing.itemCode} → ${updated.itemCode}`)
  }
  if (updated.itemName !== undefined && updated.itemName !== existing.itemName) {
    changes.push(`품목명: ${existing.itemName} → ${updated.itemName}`)
  }
  if (updated.nowQty !== undefined && updated.nowQty !== existing.nowQty) {
    changes.push(`수량: ${existing.nowQty} → ${updated.nowQty}`)
  }
  if (updated.inDay !== undefined) {
    const existingDate = existing.inDay ? new Date(existing.inDay).toISOString().split('T')[0] : '없음'
    const updatedDate = updated.inDay ? new Date(updated.inDay).toISOString().split('T')[0] : '없음'
    if (existingDate !== updatedDate) {
      changes.push(`입고일: ${existingDate} → ${updatedDate}`)
    }
  }
  if (updated.remark !== undefined && updated.remark !== existing.remark) {
    const existingRemark = existing.remark || '없음'
    const updatedRemark = updated.remark || '없음'
    changes.push(`비고: ${existingRemark} → ${updatedRemark}`)
  }

  return changes.length > 0 ? changes.join(', ') : '변경사항 없음'
}

// 재고 수정
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const data = await request.json()
    const { id, itemCode, itemName, nowQty, inDay, remark, user } = data

    if (!id) {
      return NextResponse.json(
        { success: false, message: '재고 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 기존 재고 확인 (회사 소유권 검증 포함)
    let existingRows: LsMotorRack[]

    if (isMultiTenantEnabled()) {
      existingRows = await executeQuery<LsMotorRack>(
        `SELECT idx, storage, Location, itemCode, itemName, Now_Qty, In_day, Remark, COMPANY_ID
         FROM ls_motor_rack WHERE idx = :id AND COMPANY_ID = :companyId`,
        { id, companyId: session.companyId }
      )
    } else {
      existingRows = await executeQuery<LsMotorRack>(
        `SELECT idx, storage, Location, itemCode, itemName, Now_Qty, In_day, Remark
         FROM ls_motor_rack WHERE idx = :id`,
        { id }
      )
    }

    if (existingRows.length === 0) {
      return NextResponse.json(
        { success: false, message: '해당 재고를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const existingRack = {
      id: existingRows[0].idx,
      storage: existingRows[0].storage,
      location: existingRows[0].Location,
      itemCode: existingRows[0].itemCode,
      itemName: existingRows[0].itemName,
      nowQty: existingRows[0].Now_Qty,
      inDay: existingRows[0].In_day,
      remark: existingRows[0].Remark,
    }

    // 수정 데이터 구성
    const updateData: {
      itemCode?: string
      itemName?: string
      nowQty?: number
      inDay?: Date | null
      remark?: string | null
    } = {}

    if (itemCode !== undefined) updateData.itemCode = itemCode
    if (itemName !== undefined) updateData.itemName = itemName
    if (nowQty !== undefined) updateData.nowQty = nowQty
    if (inDay !== undefined) updateData.inDay = inDay ? new Date(inDay) : null
    if (remark !== undefined) updateData.remark = remark || null

    const now = new Date()

    // 수량이 0이면 삭제
    if (updateData.nowQty === 0) {
      await withTransaction(async (connection) => {
        // 삭제 이력 기록
        await connection.execute(
          `INSERT INTO ls_motor_subul (storage, Location, itemCode, itemName, Qty, Category, Subul_Time, Remark, user)
           VALUES (:storage, :location, :itemCode, :itemName, :qty, :category, :subulTime, :remark, :userId)`,
          {
            storage: existingRack.storage,
            location: existingRack.location,
            itemCode: existingRack.itemCode,
            itemName: existingRack.itemName,
            qty: existingRack.nowQty,
            category: '수정(삭제)',
            subulTime: now,
            remark: '수량 0으로 수정하여 삭제됨',
            userId: user || 'mobile',
          },
          { autoCommit: false }
        )

        // 재고 삭제
        await connection.execute(
          `DELETE FROM ls_motor_rack WHERE idx = :id`,
          { id },
          { autoCommit: false }
        )
      })

      return NextResponse.json({
        success: true,
        message: '수량이 0이므로 재고가 삭제되었습니다.',
        deleted: true,
      })
    }

    // 변경사항 설명 생성
    const changeDescription = buildChangeDescription(existingRack, updateData)

    // 트랜잭션으로 업데이트 및 이력 기록
    const updatedRack = await withTransaction(async (connection) => {
      // 재고 업데이트
      const updateFields: string[] = []
      const updateBinds: { [key: string]: unknown } = { id }

      if (updateData.itemCode !== undefined) {
        updateFields.push('itemCode = :itemCode')
        updateBinds.itemCode = updateData.itemCode
      }
      if (updateData.itemName !== undefined) {
        updateFields.push('itemName = :itemName')
        updateBinds.itemName = updateData.itemName
      }
      if (updateData.nowQty !== undefined) {
        updateFields.push('Now_Qty = :nowQty')
        updateBinds.nowQty = updateData.nowQty
      }
      if (updateData.inDay !== undefined) {
        updateFields.push('In_day = :inDay')
        updateBinds.inDay = updateData.inDay
      }
      if (updateData.remark !== undefined) {
        updateFields.push('Remark = :remark')
        // ls_motor_rack.Remark is NOT NULL, use empty string if null
        updateBinds.remark = updateData.remark ?? ''
      }

      if (updateFields.length > 0) {
        await connection.execute(
          `UPDATE ls_motor_rack SET ${updateFields.join(', ')} WHERE idx = :id`,
          updateBinds
        )
      }

      // 수정 이력 기록 (변경사항이 있을 때만)
      if (changeDescription !== '변경사항 없음') {
        const qtyDiff = updateData.nowQty !== undefined
          ? updateData.nowQty - existingRack.nowQty
          : 0

        // 되돌리기용 메타데이터 (최소한의 정보만 저장)
        const undoMeta = {
          t: 'e',
          q: existingRack.nowQty,
          d: existingRack.inDay ? new Date(existingRack.inDay).toISOString().split('T')[0] : null,
          rid: existingRack.id,
        }

        // JSON만 (100자 제한에 맞춤)
        const remarkWithMeta = JSON.stringify(undoMeta)

        await connection.execute(
          `INSERT INTO ls_motor_subul (storage, Location, itemCode, itemName, Qty, Category, Subul_Time, Remark, user)
           VALUES (:storage, :location, :itemCode, :itemName, :qty, :category, :subulTime, :remark, :userId)`,
          {
            storage: existingRack.storage,
            location: existingRack.location,
            itemCode: existingRack.itemCode,  // 수정 전 값 저장 (되돌리기용)
            itemName: existingRack.itemName,  // 수정 전 값 저장 (되돌리기용)
            qty: Math.abs(qtyDiff) || 0,
            category: '수정',
            subulTime: now,
            remark: remarkWithMeta,
            userId: user || 'mobile',
          },
          { autoCommit: false }
        )
      }

      // 업데이트된 데이터 조회
      const rows = await connection.query<LsMotorRack>(
        `SELECT idx, storage, Location, itemCode, itemName, Now_Qty, In_day, Remark
         FROM ls_motor_rack WHERE idx = :id`,
        { id }
      )

      return rows[0]
    })

    return NextResponse.json({
      success: true,
      message: '재고가 수정되었습니다.',
      data: updatedRack ? {
        id: updatedRack.idx,
        storage: updatedRack.storage,
        location: updatedRack.Location,
        itemCode: updatedRack.itemCode,
        itemName: updatedRack.itemName,
        nowQty: updatedRack.Now_Qty,
        inDay: updatedRack.In_day,
        remark: updatedRack.Remark,
      } : null,
    })
  } catch (error) {
    console.error('Rack update error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
