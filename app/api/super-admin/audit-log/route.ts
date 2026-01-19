import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { getAllAuditLogs, AuditAction, ResourceType } from '@/lib/audit-log'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

// 전체 시스템 감사 로그 조회 (슈퍼 관리자용)
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin()

    if (!isMultiTenantEnabled()) {
      return NextResponse.json(
        { success: false, message: '멀티테넌트 모드가 활성화되어 있지 않습니다.' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)

    // 필터 파라미터 파싱
    const companyId = searchParams.get('companyId')
    const userId = searchParams.get('userId')
    const action = searchParams.get('action') as AuditAction | null
    const resourceType = searchParams.get('resourceType') as ResourceType | null
    const resourceId = searchParams.get('resourceId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const filter = {
      companyId: companyId || undefined,
      userId: userId ? parseInt(userId, 10) : undefined,
      action: action || undefined,
      resourceType: resourceType || undefined,
      resourceId: resourceId || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: Math.min(limit, 100), // 최대 100개
      offset,
    }

    const { logs, total } = await getAllAuditLogs(filter)

    return NextResponse.json({
      success: true,
      logs: logs.map((log) => ({
        id: log.id,
        companyId: log.companyId,
        userId: log.userId,
        userName: log.userName,
        userEmail: log.userEmail,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        description: log.description,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
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
    console.error('Super admin audit log fetch error:', error)
    return NextResponse.json(
      { success: false, message: '감사 로그 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
