'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Shield
} from 'lucide-react'

interface User {
  id: number
  name: string
  email: string
  status: string
  role: string
  createdAt: string
  approvedAt: string | null
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  // 관리자 권한 확인
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/')
    }
  }, [user, authLoading, router])

  // 회원 목록 로드
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchUsers()
    }
  }, [filter, user])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users?status=${filter}`)
      const data = await res.json()
      if (data.success) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (userId: number, status: 'APPROVED' | 'REJECTED') => {
    setActionLoading(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status }),
      })
      const data = await res.json()
      if (data.success) {
        // 목록에서 제거
        setUsers(prev => prev.filter(u => u.id !== userId))
      }
    } catch (error) {
      console.error('Failed to update user:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (authLoading || !user || user.role !== 'ADMIN') {
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
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-orange-500" />
          <h1 className="text-xl font-bold text-foreground">회원 관리</h1>
        </div>
        <p className="text-sm text-muted-foreground">회원 가입 승인 및 관리</p>
      </div>

      {/* 필터 탭 */}
      <div className="flex bg-muted rounded-xl p-1 mb-4">
        <button
          onClick={() => setFilter('PENDING')}
          className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            filter === 'PENDING'
              ? 'bg-card text-orange-500 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="w-4 h-4" />
          대기
        </button>
        <button
          onClick={() => setFilter('APPROVED')}
          className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            filter === 'APPROVED'
              ? 'bg-card text-green-500 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          승인
        </button>
        <button
          onClick={() => setFilter('REJECTED')}
          className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            filter === 'REJECTED'
              ? 'bg-card text-red-500 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <XCircle className="w-4 h-4" />
          거절
        </button>
      </div>

      {/* 로딩 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">
            {filter === 'PENDING' && '승인 대기 중인 회원이 없습니다'}
            {filter === 'APPROVED' && '승인된 회원이 없습니다'}
            {filter === 'REJECTED' && '거절된 회원이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-foreground">{u.name}</h3>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      가입: {formatDate(u.createdAt)}
                    </p>
                  </div>

                  {filter === 'PENDING' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(u.id, 'REJECTED')}
                        disabled={actionLoading === u.id}
                        className="h-9 px-3 text-red-500 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/30"
                      >
                        {actionLoading === u.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <UserX className="w-4 h-4 mr-1" />
                            거절
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAction(u.id, 'APPROVED')}
                        disabled={actionLoading === u.id}
                        className="h-9 px-3 bg-green-600 hover:bg-green-700"
                      >
                        {actionLoading === u.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 mr-1" />
                            승인
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {filter === 'APPROVED' && (
                    <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-full">
                      승인됨
                    </span>
                  )}

                  {filter === 'REJECTED' && (
                    <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded-full">
                      거절됨
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
