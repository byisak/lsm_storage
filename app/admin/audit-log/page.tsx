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
  ScrollText,
  ArrowLeft,
  Search,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  LogIn,
  LogOut,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Settings,
  UserCog,
  Key,
} from 'lucide-react'

type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'IMPORT'
  | 'EXPORT'
  | 'SETTINGS_CHANGE'
  | 'ROLE_CHANGE'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET'

type ResourceType = 'USER' | 'COMPANY' | 'WAREHOUSE' | 'RACK' | 'ITEM' | 'TRANSACTION' | 'SETTINGS' | 'SYSTEM'

interface AuditLog {
  id: number
  userId: number
  userName: string
  userEmail: string
  action: AuditAction
  resourceType: ResourceType
  resourceId: string
  description: string
  ipAddress: string
  createdAt: string
}

interface Pagination {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

const actionLabels: Record<AuditAction, string> = {
  LOGIN: '로그인',
  LOGOUT: '로그아웃',
  LOGIN_FAILED: '로그인 실패',
  CREATE: '생성',
  UPDATE: '수정',
  DELETE: '삭제',
  APPROVE: '승인',
  REJECT: '거부',
  IMPORT: '가져오기',
  EXPORT: '내보내기',
  SETTINGS_CHANGE: '설정 변경',
  ROLE_CHANGE: '역할 변경',
  PASSWORD_CHANGE: '비밀번호 변경',
  PASSWORD_RESET: '비밀번호 재설정',
}

const resourceLabels: Record<ResourceType, string> = {
  USER: '사용자',
  COMPANY: '회사',
  WAREHOUSE: '창고',
  RACK: '재고',
  ITEM: '품목',
  TRANSACTION: '거래',
  SETTINGS: '설정',
  SYSTEM: '시스템',
}

const getActionIcon = (action: AuditAction) => {
  switch (action) {
    case 'LOGIN':
      return <LogIn className="w-4 h-4 text-green-500" />
    case 'LOGOUT':
      return <LogOut className="w-4 h-4 text-gray-500" />
    case 'LOGIN_FAILED':
      return <LogIn className="w-4 h-4 text-red-500" />
    case 'CREATE':
      return <Plus className="w-4 h-4 text-blue-500" />
    case 'UPDATE':
      return <Edit className="w-4 h-4 text-amber-500" />
    case 'DELETE':
      return <Trash2 className="w-4 h-4 text-red-500" />
    case 'IMPORT':
      return <Upload className="w-4 h-4 text-purple-500" />
    case 'EXPORT':
      return <Download className="w-4 h-4 text-green-500" />
    case 'SETTINGS_CHANGE':
      return <Settings className="w-4 h-4 text-gray-500" />
    case 'ROLE_CHANGE':
      return <UserCog className="w-4 h-4 text-blue-500" />
    case 'PASSWORD_CHANGE':
    case 'PASSWORD_RESET':
      return <Key className="w-4 h-4 text-amber-500" />
    default:
      return <ScrollText className="w-4 h-4 text-gray-500" />
  }
}

export default function AdminAuditLogPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  })
  const [loading, setLoading] = useState(true)
  const [upgradeRequired, setUpgradeRequired] = useState(false)

  // Filters
  const [showFilters, setShowFilters] = useState(false)
  const [actionFilter, setActionFilter] = useState<AuditAction | ''>('')
  const [resourceFilter, setResourceFilter] = useState<ResourceType | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/')
    }
  }, [user, authLoading, router, isAdmin])

  useEffect(() => {
    if (isAdmin) {
      fetchLogs(0)
    }
  }, [isAdmin, actionFilter, resourceFilter, startDate, endDate])

  const fetchLogs = async (offset: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '50',
        offset: String(offset),
      })

      if (actionFilter) params.set('action', actionFilter)
      if (resourceFilter) params.set('resourceType', resourceFilter)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await fetch(`/api/admin/audit-log?${params.toString()}`)
      const data = await res.json()

      if (data.success) {
        setLogs(data.logs)
        setPagination(data.pagination)
        setUpgradeRequired(false)
      } else if (data.upgradeRequired) {
        setUpgradeRequired(true)
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handlePrevPage = () => {
    if (pagination.offset > 0) {
      fetchLogs(Math.max(0, pagination.offset - pagination.limit))
    }
  }

  const handleNextPage = () => {
    if (pagination.hasMore) {
      fetchLogs(pagination.offset + pagination.limit)
    }
  }

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(pagination.total / pagination.limit)

  if (authLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // 업그레이드 필요
  if (upgradeRequired) {
    return (
      <div className="p-4 pb-8">
        <div className="mb-6">
          <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="w-4 h-4" />
            관리자 홈
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <ScrollText className="w-5 h-5 text-indigo-500" />
            <h1 className="text-xl font-bold text-foreground">감사 로그</h1>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-lg font-bold mb-2">프리미엄 기능</h2>
            <p className="text-muted-foreground mb-4">
              감사 로그 기능은 스탠다드 이상 요금제에서 사용할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 pb-8">
      {/* 헤더 */}
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="w-4 h-4" />
          관리자 홈
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <ScrollText className="w-5 h-5 text-indigo-500" />
          <h1 className="text-xl font-bold text-foreground">감사 로그</h1>
        </div>
        <p className="text-sm text-muted-foreground">시스템 활동 기록</p>
      </div>

      {/* 필터 토글 */}
      <Button
        variant="outline"
        onClick={() => setShowFilters(!showFilters)}
        className="w-full mb-3 justify-between"
      >
        <span className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          필터
          {(actionFilter || resourceFilter || startDate || endDate) && (
            <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-full">
              적용됨
            </span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
      </Button>

      {/* 필터 패널 */}
      {showFilters && (
        <Card className="border-0 shadow-sm mb-4">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">액션</label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value as AuditAction | '')}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="">전체</option>
                  {Object.entries(actionLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">리소스</label>
                <select
                  value={resourceFilter}
                  onChange={(e) => setResourceFilter(e.target.value as ResourceType | '')}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="">전체</option>
                  {Object.entries(resourceLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">시작일</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">종료일</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActionFilter('')
                setResourceFilter('')
                setStartDate('')
                setEndDate('')
              }}
              className="w-full text-muted-foreground"
            >
              필터 초기화
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 로그 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <ScrollText className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">기록된 로그가 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {logs.map((log) => (
              <Card key={log.id} className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-muted font-medium">
                          {actionLabels[log.action]}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {resourceLabels[log.resourceType]}
                        </span>
                      </div>
                      <p className="text-sm mb-1 line-clamp-2">{log.description || '-'}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{log.userName}</span>
                        <span>•</span>
                        <span>{formatDateTime(log.createdAt)}</span>
                        {log.ipAddress && (
                          <>
                            <span>•</span>
                            <span>{log.ipAddress}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 페이징 */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between mt-4 px-2">
              <span className="text-sm text-muted-foreground">
                총 {pagination.total.toLocaleString()}건
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
