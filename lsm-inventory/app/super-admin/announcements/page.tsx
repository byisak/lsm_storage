'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Loader2,
  Megaphone,
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  AlertCircle,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react'

type AnnouncementType = 'INFO' | 'WARNING' | 'URGENT' | 'MAINTENANCE'
type AnnouncementTarget = 'ALL' | 'COMPANY' | 'PLAN'
type AnnouncementStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

interface Announcement {
  id: number
  title: string
  content: string
  type: AnnouncementType
  target: AnnouncementTarget
  targetCompanyId?: string
  priority: number
  startDate: string
  endDate?: string
  status: AnnouncementStatus
  createdAt: string
  updatedAt: string
}

interface Pagination {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

const typeLabels: Record<AnnouncementType, { label: string; icon: React.ReactNode; color: string }> = {
  INFO: { label: '정보', icon: <Info className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  WARNING: { label: '경고', icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  URGENT: { label: '긴급', icon: <AlertCircle className="w-4 h-4" />, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  MAINTENANCE: { label: '점검', icon: <Wrench className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
}

const statusLabels: Record<AnnouncementStatus, { label: string; color: string }> = {
  DRAFT: { label: '임시', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
  ACTIVE: { label: '활성', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  ARCHIVED: { label: '보관', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
}

const targetLabels: Record<AnnouncementTarget, string> = {
  ALL: '전체',
  COMPANY: '특정 회사',
  PLAN: '특정 요금제',
}

export default function SuperAdminAnnouncementsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false,
  })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatus | 'ALL'>('ALL')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Create/Edit form
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'INFO' as AnnouncementType,
    target: 'ALL' as AnnouncementTarget,
    targetCompanyId: '',
    priority: '0',
    startDate: '',
    endDate: '',
    status: 'ACTIVE' as AnnouncementStatus,
  })

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SUPER_ADMIN')) {
      router.push('/')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      fetchAnnouncements(0)
    }
  }, [user, statusFilter])

  const fetchAnnouncements = async (offset: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '20',
        offset: String(offset),
      })
      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter)
      }

      const res = await fetch(`/api/super-admin/announcements?${params.toString()}`)
      const data = await res.json()

      if (data.success) {
        setAnnouncements(data.announcements)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch announcements:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      setMessage({ type: 'error', text: '제목과 내용을 입력해주세요.' })
      return
    }

    setActionLoading(-1)
    try {
      const res = await fetch('/api/super-admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          priority: parseInt(formData.priority, 10),
          startDate: formData.startDate || undefined,
          endDate: formData.endDate || undefined,
          targetCompanyId: formData.target !== 'ALL' ? formData.targetCompanyId : undefined,
        }),
      })
      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: '공지사항이 생성되었습니다.' })
        setShowForm(false)
        resetForm()
        fetchAnnouncements(0)
      } else {
        setMessage({ type: 'error', text: data.message })
      }
    } catch {
      setMessage({ type: 'error', text: '공지사항 생성 중 오류가 발생했습니다.' })
    } finally {
      setActionLoading(null)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleUpdate = async () => {
    if (!editingId) return

    setActionLoading(editingId)
    try {
      const res = await fetch('/api/super-admin/announcements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          ...formData,
          priority: parseInt(formData.priority, 10),
          startDate: formData.startDate || undefined,
          endDate: formData.endDate || undefined,
          targetCompanyId: formData.target !== 'ALL' ? formData.targetCompanyId : undefined,
        }),
      })
      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: '공지사항이 수정되었습니다.' })
        setShowForm(false)
        setEditingId(null)
        resetForm()
        fetchAnnouncements(pagination.offset)
      } else {
        setMessage({ type: 'error', text: data.message })
      }
    } catch {
      setMessage({ type: 'error', text: '공지사항 수정 중 오류가 발생했습니다.' })
    } finally {
      setActionLoading(null)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('이 공지사항을 삭제하시겠습니까?')) return

    setActionLoading(id)
    try {
      const res = await fetch(`/api/super-admin/announcements?id=${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: '공지사항이 삭제되었습니다.' })
        fetchAnnouncements(pagination.offset)
      } else {
        setMessage({ type: 'error', text: data.message })
      }
    } catch {
      setMessage({ type: 'error', text: '삭제 중 오류가 발생했습니다.' })
    } finally {
      setActionLoading(null)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleStatusChange = async (id: number, newStatus: AnnouncementStatus) => {
    setActionLoading(id)
    try {
      const res = await fetch('/api/super-admin/announcements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
      const data = await res.json()

      if (data.success) {
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
        )
        setMessage({ type: 'success', text: '상태가 변경되었습니다.' })
      }
    } catch {
      setMessage({ type: 'error', text: '상태 변경 중 오류가 발생했습니다.' })
    } finally {
      setActionLoading(null)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      type: 'INFO',
      target: 'ALL',
      targetCompanyId: '',
      priority: '0',
      startDate: '',
      endDate: '',
      status: 'ACTIVE',
    })
  }

  const startEdit = (announcement: Announcement) => {
    setEditingId(announcement.id)
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      target: announcement.target,
      targetCompanyId: announcement.targetCompanyId || '',
      priority: String(announcement.priority),
      startDate: announcement.startDate ? announcement.startDate.split('T')[0] : '',
      endDate: announcement.endDate ? announcement.endDate.split('T')[0] : '',
      status: announcement.status,
    })
    setShowForm(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handlePrevPage = () => {
    if (pagination.offset > 0) {
      fetchAnnouncements(Math.max(0, pagination.offset - pagination.limit))
    }
  }

  const handleNextPage = () => {
    if (pagination.hasMore) {
      fetchAnnouncements(pagination.offset + pagination.limit)
    }
  }

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(pagination.total / pagination.limit)

  if (authLoading || !user || user.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 pb-8">
      {/* 헤더 */}
      <div className="mb-6">
        <Link
          href="/super-admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          시스템 관리
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <Megaphone className="w-5 h-5 text-orange-500" />
          <h1 className="text-xl font-bold text-foreground">공지사항 관리</h1>
        </div>
        <p className="text-sm text-muted-foreground">시스템 공지사항 작성 및 관리</p>
      </div>

      {/* 메시지 */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 border ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* 생성/수정 폼 */}
      {showForm ? (
        <Card className="border-0 shadow-sm mb-4">
          <CardContent className="p-4">
            <h3 className="font-bold mb-4">{editingId ? '공지사항 수정' : '새 공지사항'}</h3>
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="제목"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="h-11"
              />
              <textarea
                placeholder="내용"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full h-32 px-3 py-2 rounded-lg border border-border bg-background resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">유형</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as AnnouncementType })}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background"
                  >
                    {Object.entries(typeLabels).map(([value, { label }]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">대상</label>
                  <select
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: e.target.value as AnnouncementTarget })}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background"
                  >
                    {Object.entries(targetLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {formData.target !== 'ALL' && (
                <Input
                  type="text"
                  placeholder={formData.target === 'COMPANY' ? '회사 ID' : '요금제 (BASIC, STANDARD, PREMIUM, ENTERPRISE)'}
                  value={formData.targetCompanyId}
                  onChange={(e) => setFormData({ ...formData, targetCompanyId: e.target.value })}
                  className="h-10"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">시작일</label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">종료일</label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="h-10"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">우선순위 (높을수록 상단)</label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">상태</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as AnnouncementStatus })}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background"
                  >
                    {Object.entries(statusLabels).map(([value, { label }]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={editingId ? handleUpdate : handleCreate}
                  disabled={actionLoading !== null}
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                >
                  {actionLoading !== null ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {editingId ? '수정' : '생성'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                    resetForm()
                  }}
                >
                  취소
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          onClick={() => setShowForm(true)}
          className="w-full mb-4 h-11 bg-orange-600 hover:bg-orange-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          새 공지사항
        </Button>
      )}

      {/* 필터 */}
      <div className="flex bg-muted rounded-xl p-1 mb-4">
        {(['ALL', 'ACTIVE', 'DRAFT', 'ARCHIVED'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
              statusFilter === status
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {status === 'ALL' ? '전체' : statusLabels[status].label}
          </button>
        ))}
      </div>

      {/* 공지사항 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : announcements.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Megaphone className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">공지사항이 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {announcements.map((ann) => (
              <Card key={ann.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${typeLabels[ann.type].color}`}>
                        {typeLabels[ann.type].icon}
                        {typeLabels[ann.type].label}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${statusLabels[ann.status].color}`}>
                        {statusLabels[ann.status].label}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(ann.createdAt)}
                    </span>
                  </div>

                  <h3 className="font-bold mb-1">{ann.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{ann.content}</p>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <span>대상: {targetLabels[ann.target]}</span>
                    {ann.targetCompanyId && <span>({ann.targetCompanyId})</span>}
                    {ann.priority > 0 && <span>• 우선순위: {ann.priority}</span>}
                  </div>

                  <div className="flex gap-2">
                    {ann.status === 'ACTIVE' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(ann.id, 'ARCHIVED')}
                        disabled={actionLoading === ann.id}
                        className="flex-1"
                      >
                        {actionLoading === ann.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <EyeOff className="w-4 h-4 mr-1" />
                            비활성화
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(ann.id, 'ACTIVE')}
                        disabled={actionLoading === ann.id}
                        className="flex-1"
                      >
                        {actionLoading === ann.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            활성화
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(ann)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      수정
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(ann.id)}
                      disabled={actionLoading === ann.id}
                      className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 페이징 */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between mt-4 px-2">
              <span className="text-sm text-muted-foreground">
                총 {pagination.total}건
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={pagination.offset === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!pagination.hasMore}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
