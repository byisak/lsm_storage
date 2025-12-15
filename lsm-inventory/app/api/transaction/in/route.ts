import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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
    const existing = await prisma.lsMotorRack.findFirst({
      where: {
        storage,
        location,
        itemCode,
      },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, message: '이미 해당 위치에 같은 품목이 존재합니다.' },
        { status: 400 }
      )
    }

    const now = new Date()

    // 트랜잭션으로 처리
    const result = await prisma.$transaction(async (tx) => {
      // 랙에 입고
      const rack = await tx.lsMotorRack.create({
        data: {
          storage,
          location,
          itemCode,
          itemName,
          nowQty: qty,
          inDay: now,
          remark: remark || null,
        },
      })

      // 수불 이력 추가
      await tx.lsMotorSubul.create({
        data: {
          storage,
          location,
          itemCode,
          itemName,
          qty,
          category: '입고',
          subulTime: now,
          remark: remark || null,
          user: user || 'system',
        },
      })

      return rack
    })

    return NextResponse.json({
      success: true,
      message: '입고가 완료되었습니다.',
      data: result,
    })
  } catch (error) {
    console.error('Transaction in error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
