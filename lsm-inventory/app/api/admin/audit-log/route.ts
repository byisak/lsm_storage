import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, AuthError } from '@/lib/auth'
import { getAuditLogs, AuditAction, ResourceType } from '@/lib/audit-log'
import { checkFeature } from '@/lib/plan-limits'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

// 감사 로그 조회 (관리자용)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    // 멀티테넌트 모드에서 감사 로그 기능 확인
    if (isMultiTenantEnabled()) {
      const auditEnabled = await checkFeature('auditLog')
      if (!auditEnabled) {
        return NextResponse.json(
          {
            success: false,
            message: '감사 로그 기능은 스탠다드 이상 요금제에서 사용할 수 있습니다.',
            upgradeRequired: true,
          },
          { status: 403 }
        )
      }
    }

    const { searchParams } = new URL(request.url)

    // 필터 파라미터 파싱
    const userId = searchParams.get('userId')
    const action = searchParams.get('action') as AuditAction | null
    const resourceType = searchParams.get('resourceType') as ResourceType | null
    const resourceId = searchParams.get('resourceId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const filter = {
      userId: userId ? parseInt(userId, 10) : undefined,
      action: action || undefined,
      resourceType: resourceType || undefined,
      resourceId: resourceId || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: Math.min(limit, 100), // 최대 100개
      offset,
    }

    const { logs, total } = await getAuditLogs(filter)

    return NextResponse.json({
      success: true,
      logs: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        userName: log.userName,
        userEmail: log.userEmail,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        description: log.description,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
        // 상세 값은 필요시 별도 API로
      })),
      pagination: {
        total,
        limit: filter.limit,
        offset: filter.offset,
        hasMore: filter.offset + filter.limit < total,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Audit log fetch error:', error)
    return NextResponse.json(
      { success: false, message: '감사 로그 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
