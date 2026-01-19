import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import {
  getActiveAnnouncements,
  getUnreadAnnouncementCount,
  markAnnouncementAsRead,
  markAllAnnouncementsAsRead,
} from '@/lib/announcements'

// 활성 공지사항 조회
export async function GET() {
  try {
    await requireAuth()

    const announcements = await getActiveAnnouncements()
    const unreadCount = await getUnreadAnnouncementCount()

    return NextResponse.json({
      success: true,
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        type: a.type,
        priority: a.priority,
        startDate: a.startDate,
        endDate: a.endDate,
        isRead: a.isRead,
        createdAt: a.createdAt,
      })),
      unreadCount,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Announcements fetch error:', error)
    return NextResponse.json(
      { success: false, message: '공지사항 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 공지사항 읽음 처리
export async function PUT(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const { announcementId, markAll } = body

    if (markAll) {
      await markAllAnnouncementsAsRead()
      return NextResponse.json({
        success: true,
        message: '모든 공지사항을 읽음 처리했습니다.',
      })
    }

    if (!announcementId) {
      return NextResponse.json(
        { success: false, message: '공지사항 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    await markAnnouncementAsRead(announcementId)

    return NextResponse.json({
      success: true,
      message: '공지사항을 읽음 처리했습니다.',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Announcement read error:', error)
    return NextResponse.json(
      { success: false, message: '공지사항 읽음 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
