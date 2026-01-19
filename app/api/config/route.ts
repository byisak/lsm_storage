import { NextResponse } from 'next/server'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

// 클라이언트 설정 정보 반환
export async function GET() {
  const multiTenantEnabled = isMultiTenantEnabled()

  // 디버그용 로그
  console.log('[Config API] MULTI_TENANT_ENABLED env:', process.env.MULTI_TENANT_ENABLED)
  console.log('[Config API] isMultiTenantEnabled():', multiTenantEnabled)

  return NextResponse.json({
    success: true,
    config: {
      multiTenantEnabled,
    },
    // 디버그 정보 (개발 환경에서만)
    debug: process.env.NODE_ENV === 'development' ? {
      envValue: process.env.MULTI_TENANT_ENABLED,
    } : undefined,
  })
}
