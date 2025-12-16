import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, LsMotorRack } from '@/lib/oracle'

// 조회 결과를 camelCase로 변환하는 헬퍼 함수
function formatItems(items: LsMotorRack[]) {
  return items.map(item => ({
    id: item.ID,
    storage: item.STORAGE,
    location: item.LOCATION,
    itemCode: item.ITEM_CODE,
    itemName: item.ITEM_NAME,
    nowQty: item.NOW_QTY,
    inDay: item.IN_DAY,
    remark: item.REMARK,
  }))
}

// QR 스캔 앱에서 POST 요청 수신
// 형식: "1|A-01-01" (창고번호|위치)
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()

    // "1|A-01-01" 형식 파싱
    const [storage, location] = body.split('|')

    if (!storage || !location) {
      return NextResponse.json(
        { success: false, message: '잘못된 형식입니다. (예: 1|A-01-01)' },
        { status: 400 }
      )
    }

    const storageVal = storage.trim()
    const locationVal = location.trim()

    // 해당 위치의 재고 조회
    const items = await executeQuery<LsMotorRack>(
      `SELECT ID, STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, NOW_QTY, IN_DAY, REMARK
       FROM LS_MOTOR_RACK
       WHERE STORAGE = :storage AND LOCATION = :location
       ORDER BY IN_DAY DESC NULLS LAST`,
      { storage: storageVal, location: locationVal }
    )

    return NextResponse.json({
      success: true,
      storage: storageVal,
      location: locationVal,
      items: formatItems(items),
      count: items.length,
    })
  } catch (error) {
    console.error('Rack scan error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// GET 요청도 지원 (URL 파라미터)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') // "1|A-01-01" 형식
    const storage = searchParams.get('storage')
    const location = searchParams.get('location')

    let storageValue: string | null = storage
    let locationValue: string | null = location

    // q 파라미터가 있으면 파싱
    if (q) {
      const parts = q.split('|')
      storageValue = parts[0] || null
      locationValue = parts[1] || null
    }

    if (!storageValue || !locationValue) {
      return NextResponse.json(
        { success: false, message: '창고와 위치를 입력해주세요.' },
        { status: 400 }
      )
    }

    const storageVal = storageValue.trim()
    const locationVal = locationValue.trim()

    const items = await executeQuery<LsMotorRack>(
      `SELECT ID, STORAGE, LOCATION, ITEM_CODE, ITEM_NAME, NOW_QTY, IN_DAY, REMARK
       FROM LS_MOTOR_RACK
       WHERE STORAGE = :storage AND LOCATION = :location
       ORDER BY IN_DAY DESC NULLS LAST`,
      { storage: storageVal, location: locationVal }
    )

    return NextResponse.json({
      success: true,
      storage: storageVal,
      location: locationVal,
      items: formatItems(items),
      count: items.length,
    })
  } catch (error) {
    console.error('Rack scan error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
