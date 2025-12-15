import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 재고 이동 (A 위치 → B 위치)
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { rackId, toStorage, toLocation, qty, user } = data

    if (!rackId || !toStorage || !toLocation || !qty) {
      return NextResponse.json(
        { success: false, message: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 원본 재고 조회
    const sourceRack = await prisma.lsMotorRack.findUnique({
      where: { id: rackId },
    })

    if (!sourceRack) {
      return NextResponse.json(
        { success: false, message: '원본 재고를 찾을 수 없습니다.' },
        { status: 404 }
      )
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

    const now = new Date()

    // 트랜잭션으로 이동 처리
    await prisma.$transaction(async (tx) => {
      // 1. 원본 재고 감소 또는 삭제
      if (qty === sourceRack.nowQty) {
        // 전체 이동이면 삭제
        await tx.lsMotorRack.delete({
          where: { id: rackId },
        })
      } else {
        // 부분 이동이면 수량 감소
        await tx.lsMotorRack.update({
          where: { id: rackId },
          data: { nowQty: sourceRack.nowQty - qty },
        })
      }

      // 2. 목적지에 동일 품목이 있는지 확인
      const existingTarget = await tx.lsMotorRack.findFirst({
        where: {
          storage: toStorage,
          location: toLocation,
          itemCode: sourceRack.itemCode,
        },
      })

      // 출발지 수량 변경 정보
      const sourceBeforeQty = sourceRack.nowQty
      const sourceAfterQty = sourceRack.nowQty - qty

      // 목적지 수량 변경 정보
      const targetBeforeQty = existingTarget ? existingTarget.nowQty : 0
      const targetAfterQty = targetBeforeQty + qty

      if (existingTarget) {
        // 기존 재고에 수량 추가
        await tx.lsMotorRack.update({
          where: { id: existingTarget.id },
          data: { nowQty: existingTarget.nowQty + qty },
        })
      } else {
        // 새 재고 생성
        await tx.lsMotorRack.create({
          data: {
            storage: toStorage,
            location: toLocation,
            itemCode: sourceRack.itemCode,
            itemName: sourceRack.itemName,
            nowQty: qty,
            inDay: sourceRack.inDay,
            remark: sourceRack.remark,
          },
        })
      }

      // 3. 이동 이력 기록 (출고)
      const sourceRemark = `→ ${toLocation} (${toStorage}) [${sourceBeforeQty}개 → ${sourceAfterQty}개]`
      await tx.lsMotorSubul.create({
        data: {
          storage: sourceRack.storage,
          location: sourceRack.location,
          itemCode: sourceRack.itemCode,
          itemName: sourceRack.itemName,
          qty: qty,
          category: '이동(출)',
          subulTime: now,
          remark: sourceRemark,
          user: user || 'mobile',
        },
      })

      // 4. 이동 이력 기록 (입고)
      const targetRemark = existingTarget
        ? `← ${sourceRack.location} (${sourceRack.storage}) [${targetBeforeQty}개 → ${targetAfterQty}개]`
        : `← ${sourceRack.location} (${sourceRack.storage}) [신규]`
      await tx.lsMotorSubul.create({
        data: {
          storage: toStorage,
          location: toLocation,
          itemCode: sourceRack.itemCode,
          itemName: sourceRack.itemName,
          qty: qty,
          category: '이동(입)',
          subulTime: now,
          remark: targetRemark,
          user: user || 'mobile',
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: `${qty}개가 ${toLocation}으로 이동되었습니다.`,
    })
  } catch (error) {
    console.error('Move error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
