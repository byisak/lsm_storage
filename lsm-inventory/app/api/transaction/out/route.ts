import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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
    const rack = await prisma.lsMotorRack.findUnique({
      where: { id: rackId },
    })

    if (!rack) {
      return NextResponse.json(
        { success: false, message: '해당 재고를 찾을 수 없습니다.' },
        { status: 404 }
      )
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
    const result = await prisma.$transaction(async (tx) => {
      let updatedRack

      if (newQty === 0) {
        // 재고가 0이면 삭제
        await tx.lsMotorRack.delete({
          where: { id: rackId },
        })
        updatedRack = null
      } else {
        // 재고 차감
        updatedRack = await tx.lsMotorRack.update({
          where: { id: rackId },
          data: { nowQty: newQty },
        })
      }

      // 수불 이력 추가
      await tx.lsMotorSubul.create({
        data: {
          storage: rack.storage,
          location: rack.location,
          itemCode: rack.itemCode,
          itemName: rack.itemName,
          qty,
          category: '출고',
          subulTime: now,
          remark: remark || null,
          user: user || 'system',
        },
      })

      return updatedRack
    })

    return NextResponse.json({
      success: true,
      message: '출고가 완료되었습니다.',
      data: result,
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
