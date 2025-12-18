import { NextResponse } from 'next/server'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

// 클라이언트 설정 정보 반환
export async function GET() {
  return NextResponse.json({
    success: true,
    config: {
      multiTenantEnabled: isMultiTenantEnabled(),
    },
  })
}
