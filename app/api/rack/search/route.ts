import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, LsMotorRack } from '@/lib/mysql'
import { getSession } from '@/lib/auth'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

// 창고 ID → 이름 매핑
const WAREHOUSE_MAP: Record<string, string> = {
  '1': '본사 창고',
  '01': '본사 창고',
  '2': '외부 창고',
  '02': '외부 창고',
  '3': '제품 창고',
  '03': '제품 창고',
}

function getWarehouseName(id: string): string {
  return WAREHOUSE_MAP[id] || id
}

// 위치로 랙 검색
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
    const location = searchParams.get('location')
    const storage = searchParams.get('storage') // 창고 필터 추가

    if (!location) {
      return NextResponse.json(
        { success: false, message: '위치를 입력해주세요.' },
        { status: 400 }
      )
    }

    const searchTerm = `%${location.trim()}%`
    let items: LsMotorRack[]

    // 창고 ID를 이름으로 변환
    const storageName = storage ? getWarehouseName(storage.trim()) : null

    if (isMultiTenantEnabled()) {
      // 멀티테넌트: 회사별 필터링
      if (storageName) {
        items = await executeQuery<LsMotorRack>(
          `SELECT idx, storage, Location, itemCode, itemName, Now_Qty, In_day, Remark, COMPANY_ID
           FROM ls_motor_rack
           WHERE UPPER(Location) LIKE UPPER(:searchTerm)
             AND storage = :storage
             AND COMPANY_ID = :companyId
           ORDER BY Location ASC`,
          { searchTerm, storage: storageName, companyId: session.companyId }
        )
      } else {
        items = await executeQuery<LsMotorRack>(
          `SELECT idx, storage, Location, itemCode, itemName, Now_Qty, In_day, Remark, COMPANY_ID
           FROM ls_motor_rack
           WHERE UPPER(Location) LIKE UPPER(:searchTerm)
             AND COMPANY_ID = :companyId
           ORDER BY Location ASC`,
          { searchTerm, companyId: session.companyId }
        )
      }
    } else {
      // 단일 테넌트
      if (storageName) {
        items = await executeQuery<LsMotorRack>(
          `SELECT idx, storage, Location, itemCode, itemName, Now_Qty, In_day, Remark
           FROM ls_motor_rack
           WHERE UPPER(Location) LIKE UPPER(:searchTerm)
             AND storage = :storage
           ORDER BY Location ASC`,
          { searchTerm, storage: storageName }
        )
      } else {
        items = await executeQuery<LsMotorRack>(
          `SELECT idx, storage, Location, itemCode, itemName, Now_Qty, In_day, Remark
           FROM ls_motor_rack
           WHERE UPPER(Location) LIKE UPPER(:searchTerm)
           ORDER BY Location ASC`,
          { searchTerm }
        )
      }
    }

    // 컬럼명을 camelCase로 변환
    const formattedItems = items.map(item => ({
      id: item.idx,
      storage: item.storage,
      location: item.Location,
      itemCode: item.itemCode,
      itemName: item.itemName,
      nowQty: item.Now_Qty,
      inDay: item.In_day,
      remark: item.Remark,
    }))

    return NextResponse.json({
      success: true,
      items: formattedItems,
      count: formattedItems.length,
      storage: storageName,
    })
  } catch (error) {
    console.error('Rack search error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
