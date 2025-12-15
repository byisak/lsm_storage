import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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
    const existingDate = existing.inDay ? existing.inDay.toISOString().split('T')[0] : '없음'
    const updatedDate = updated.inDay ? updated.inDay.toISOString().split('T')[0] : '없음'
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
    const data = await request.json()
    const { id, itemCode, itemName, nowQty, inDay, remark, user } = data

    if (!id) {
      return NextResponse.json(
        { success: false, message: '재고 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 기존 재고 확인
    const existingRack = await prisma.lsMotorRack.findUnique({
      where: { id },
    })

    if (!existingRack) {
      return NextResponse.json(
        { success: false, message: '해당 재고를 찾을 수 없습니다.' },
        { status: 404 }
      )
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
      // 트랜잭션으로 삭제 및 이력 기록
      await prisma.$transaction(async (tx) => {
        // 삭제 이력 기록
        await tx.lsMotorSubul.create({
          data: {
            storage: existingRack.storage,
            location: existingRack.location,
            itemCode: existingRack.itemCode,
            itemName: existingRack.itemName,
            qty: existingRack.nowQty,
            category: '수정(삭제)',
            subulTime: now,
            remark: `수량 0으로 수정하여 삭제됨`,
            user: user || 'mobile',
          },
        })

        // 재고 삭제
        await tx.lsMotorRack.delete({
          where: { id },
        })
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
    const updatedRack = await prisma.$transaction(async (tx) => {
      // 재고 업데이트
      const rack = await tx.lsMotorRack.update({
        where: { id },
        data: updateData,
      })

      // 수정 이력 기록 (변경사항이 있을 때만)
      if (changeDescription !== '변경사항 없음') {
        // 수량 변경인 경우 수량 차이 기록
        const qtyDiff = updateData.nowQty !== undefined
          ? updateData.nowQty - existingRack.nowQty
          : 0

        await tx.lsMotorSubul.create({
          data: {
            storage: rack.storage,
            location: rack.location,
            itemCode: rack.itemCode,
            itemName: rack.itemName,
            qty: Math.abs(qtyDiff) || 0,
            category: '수정',
            subulTime: now,
            remark: changeDescription,
            user: user || 'mobile',
          },
        })
      }

      return rack
    })

    return NextResponse.json({
      success: true,
      message: '재고가 수정되었습니다.',
      data: updatedRack,
    })
  } catch (error) {
    console.error('Rack update error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
