import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/oracle'
import { expandLocation } from '@/lib/location-utils'
import { getSession } from '@/lib/auth'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

interface RackLocation {
  STORAGE: string
  LOCATION: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''

    if (!query.trim()) {
      return NextResponse.json({ success: true, locations: [] })
    }

    // 단축 입력 변환
    const expanded = expandLocation(query)

    // 고유 위치 목록 가져오기
    let racks: RackLocation[]

    if (isMultiTenantEnabled()) {
      // 멀티테넌트: 회사별 필터링
      racks = await executeQuery<RackLocation>(
        `SELECT DISTINCT STORAGE, LOCATION FROM LS_MOTOR_RACK WHERE COMPANY_ID = :companyId`,
        { companyId: session.companyId }
      )
    } else {
      // 단일 테넌트: 기존 방식
      racks = await executeQuery<RackLocation>(
        `SELECT DISTINCT STORAGE, LOCATION FROM LS_MOTOR_RACK`
      )
    }

    // 검색어로 필터링
    const searchUpper = expanded.toUpperCase()
    const filtered = racks.filter(rack =>
      rack.LOCATION.toUpperCase().includes(searchUpper)
    )

    // 위치별로 그룹화하고 정렬
    const uniqueLocations = [...new Set(filtered.map(r => ({
      location: r.LOCATION,
      storage: r.STORAGE
    })))]

    // 최대 10개만 반환
    const locations = uniqueLocations.slice(0, 10)

    return NextResponse.json({
      success: true,
      locations,
      expanded: expanded !== query.toUpperCase() ? expanded : null
    })
  } catch (error) {
    console.error('Rack autocomplete error:', error)
    return NextResponse.json(
      { success: false, message: '자동완성 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
