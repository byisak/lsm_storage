import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, LsMotorRack } from '@/lib/mysql'
import { getSession } from '@/lib/auth'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

// 창고 ID → 이름 매핑 (warehouse-config.ts와 동일하게 유지)
const WAREHOUSE_MAP: Record<string, string> = {
  '1': '본사 창고',
  '01': '본사 창고',
  '2': '외부 창고',
  '02': '외부 창고',
  '3': '제품 창고',
  '03': '제품 창고',
}

// 창고 ID를 이름으로 변환
function getWarehouseName(id: string): string {
  return WAREHOUSE_MAP[id] || id
}

// 조회 결과를 camelCase로 변환하는 헬퍼 함수
function formatItems(items: LsMotorRack[]) {
  return items.map(item => ({
    id: item.idx,
    storage: item.storage,
    location: item.Location,
    itemCode: item.itemCode,
    itemName: item.itemName,
    nowQty: item.Now_Qty,
    inDay: item.In_day,
    remark: item.Remark,
  }))
}

// QR 스캔 앱에서 POST 요청 수신
// 형식: "1|A-01-01" (창고번호|위치)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.text()

    // "1|A-01-01" 형식 파싱
    const [storage, location] = body.split('|')

    if (!storage || !location) {
      return NextResponse.json(
        { success: false, message: '잘못된 형식입니다. (예: 1|A-01-01)' },
        { status: 400 }
      )
    }

    const storageId = storage.trim()
    const locationVal = location.trim()
    // 창고 ID를 이름으로 변환
    const storageName = getWarehouseName(storageId)

    let items: LsMotorRack[]

    if (isMultiTenantEnabled()) {
      // 멀티테넌트: 회사별 필터링
      items = await executeQuery<LsMotorRack>(
        `SELECT idx, storage, Location, itemCode, itemName, Now_Qty, In_day, Remark, COMPANY_ID
         FROM ls_motor_rack
         WHERE storage = :storage AND Location = :location AND COMPANY_ID = :companyId
         ORDER BY In_day DESC`,
        { storage: storageName, location: locationVal, companyId: session.companyId }
      )
    } else {
      // 단일 테넌트: 기존 방식
      items = await executeQuery<LsMotorRack>(
        `SELECT idx, storage, Location, itemCode, itemName, Now_Qty, In_day, Remark
         FROM ls_motor_rack
         WHERE storage = :storage AND Location = :location
         ORDER BY In_day DESC`,
        { storage: storageName, location: locationVal }
      )
    }

    return NextResponse.json({
      success: true,
      storage: storageName,
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
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

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

    const storageId = storageValue.trim()
    const locationVal = locationValue.trim()
    // 창고 ID를 이름으로 변환
    const storageName = getWarehouseName(storageId)

    let items: LsMotorRack[]

    if (isMultiTenantEnabled()) {
      // 멀티테넌트: 회사별 필터링
      items = await executeQuery<LsMotorRack>(
        `SELECT idx, storage, Location, itemCode, itemName, Now_Qty, In_day, Remark, COMPANY_ID
         FROM ls_motor_rack
         WHERE storage = :storage AND Location = :location AND COMPANY_ID = :companyId
         ORDER BY In_day DESC`,
        { storage: storageName, location: locationVal, companyId: session.companyId }
      )
    } else {
      // 단일 테넌트: 기존 방식
      items = await executeQuery<LsMotorRack>(
        `SELECT idx, storage, Location, itemCode, itemName, Now_Qty, In_day, Remark
         FROM ls_motor_rack
         WHERE storage = :storage AND Location = :location
         ORDER BY In_day DESC`,
        { storage: storageName, location: locationVal }
      )
    }

    return NextResponse.json({
      success: true,
      storage: storageName,
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
