import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'
import {
  createAnnouncement,
  getAllAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
  AnnouncementType,
  AnnouncementTarget,
  AnnouncementStatus,
} from '@/lib/announcements'

// 전체 공지사항 조회 (슈퍼 관리자)
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
    const status = searchParams.get('status') as AnnouncementStatus | null
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const { announcements, total } = await getAllAnnouncements({
      status: status || undefined,
      limit,
      offset,
    })

    return NextResponse.json({
      success: true,
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        type: a.type,
        target: a.target,
        targetCompanyId: a.targetCompanyId,
        priority: a.priority,
        startDate: a.startDate,
        endDate: a.endDate,
        status: a.status,
        createdBy: a.createdBy,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Super admin announcements fetch error:', error)
    return NextResponse.json(
      { success: false, message: '공지사항 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 공지사항 생성 (슈퍼 관리자)
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin()

    if (!isMultiTenantEnabled()) {
      return NextResponse.json(
        { success: false, message: '멀티테넌트 모드가 활성화되어 있지 않습니다.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      title,
      content,
      type,
      target,
      targetCompanyId,
      priority,
      startDate,
      endDate,
      status,
    } = body

    if (!title || !content) {
      return NextResponse.json(
        { success: false, message: '제목과 내용은 필수입니다.' },
        { status: 400 }
      )
    }

    // 타입 검증
    const validTypes: AnnouncementType[] = ['INFO', 'WARNING', 'URGENT', 'MAINTENANCE']
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 공지 유형입니다.' },
        { status: 400 }
      )
    }

    const validTargets: AnnouncementTarget[] = ['ALL', 'COMPANY', 'PLAN']
    if (target && !validTargets.includes(target)) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 대상입니다.' },
        { status: 400 }
      )
    }

    const announcement = await createAnnouncement({
      title,
      content,
      type,
      target,
      targetCompanyId,
      priority: priority ? parseInt(priority, 10) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status,
    })

    return NextResponse.json({
      success: true,
      message: '공지사항이 생성되었습니다.',
      announcement: {
        id: announcement.id,
        title: announcement.title,
        type: announcement.type,
        status: announcement.status,
        createdAt: announcement.createdAt,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Announcement create error:', error)
    return NextResponse.json(
      { success: false, message: '공지사항 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 공지사항 수정 (슈퍼 관리자)
export async function PUT(request: NextRequest) {
  try {
    await requireSuperAdmin()

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { success: false, message: '공지사항 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 날짜 변환
    if (updates.startDate) {
      updates.startDate = new Date(updates.startDate)
    }
    if (updates.endDate) {
      updates.endDate = new Date(updates.endDate)
    }

    const success = await updateAnnouncement(id, updates)

    if (!success) {
      return NextResponse.json(
        { success: false, message: '공지사항을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '공지사항이 수정되었습니다.',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Announcement update error:', error)
    return NextResponse.json(
      { success: false, message: '공지사항 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 공지사항 삭제 (슈퍼 관리자)
export async function DELETE(request: NextRequest) {
  try {
    await requireSuperAdmin()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, message: '공지사항 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const success = await deleteAnnouncement(parseInt(id, 10))

    if (!success) {
      return NextResponse.json(
        { success: false, message: '공지사항을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '공지사항이 삭제되었습니다.',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Announcement delete error:', error)
    return NextResponse.json(
      { success: false, message: '공지사항 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
