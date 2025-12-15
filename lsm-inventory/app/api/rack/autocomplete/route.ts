import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { expandLocation } from '@/lib/location-utils'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''

    if (!query.trim()) {
      return NextResponse.json({ success: true, locations: [] })
    }

    // 단축 입력 변환
    const expanded = expandLocation(query)

    // 고유 위치 목록 가져오기
    const racks = await prisma.lsMotorRack.findMany({
      select: {
        storage: true,
        location: true,
      },
      distinct: ['storage', 'location'],
    })

    // 검색어로 필터링
    const searchUpper = expanded.toUpperCase()
    const filtered = racks.filter(rack =>
      rack.location.toUpperCase().includes(searchUpper)
    )

    // 위치별로 그룹화하고 정렬
    const uniqueLocations = [...new Set(filtered.map(r => ({
      location: r.location,
      storage: r.storage
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
