'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  Building2,
  Users,
  Warehouse,
  Package,
  ArrowRightLeft,
  Crown,
  ChevronRight,
  Play,
  Pause,
  Trash2
} from 'lucide-react'
import Link from 'next/link'

interface DashboardMetrics {
  totalCompanies: number
  activeCompanies: number
  totalUsers: number
  totalWarehouses: number
  totalRacks: number
  totalTransactions: number
}

interface PlanStats {
  BASIC: number
  STANDARD: number
  PREMIUM: number
  ENTERPRISE: number
}

interface RecentCompany {
  id: string
  name: string
  status: string
  planType: string
  createdAt: string
}

interface Company {
  id: string
  name: string
  status: string
  planType: string
  createdAt: string
  userCount: number
  warehouseCount: number
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [planStats, setPlanStats] = useState<PlanStats | null>(null)
  const [recentCompanies, setRecentCompanies] = useState<RecentCompany[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // 슈퍼 관리자 권한 확인
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SUPER_ADMIN')) {
      router.push('/')
    }
  }, [user, authLoading, router])

  // 대시보드 데이터 로드
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      fetchDashboard()
      fetchCompanies()
    }
  }, [user])

  // 상태 필터 변경 시 회사 목록 다시 로드
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      fetchCompanies()
    }
  }, [statusFilter])

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/super-admin/dashboard')
      const data = await res.json()
      if (data.success) {
        setMetrics(data.dashboard.metrics)
        setPlanStats(data.dashboard.planStats)
        setRecentCompanies(data.dashboard.recentCompanies)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanies = async () => {
    setCompaniesLoading(true)
    try {
      const url = statusFilter === 'all'
        ? '/api/super-admin/companies'
        : `/api/super-admin/companies?status=${statusFilter}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setCompanies(data.companies)
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error)
    } finally {
      setCompaniesLoading(false)
    }
  }

  const handleStatusChange = async (companyId: string, newStatus: string) => {
    setActionLoading(companyId)
    try {
      const res = await fetch('/api/super-admin/companies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, status: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        fetchCompanies()
        fetchDashboard()
      }
    } catch (error) {
      console.error('Failed to update company status:', error)
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
    })
  }

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'ENTERPRISE': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case 'PREMIUM': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      case 'STANDARD': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'SUSPENDED': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      case 'DELETED': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

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
        <div className="flex items-center gap-2 mb-1">
          <Crown className="w-5 h-5 text-purple-500" />
          <h1 className="text-xl font-bold text-foreground">슈퍼 관리자</h1>
        </div>
        <p className="text-sm text-muted-foreground">전체 시스템 관리 대시보드</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* 주요 지표 */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-xl">
                    <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{metrics?.totalCompanies || 0}</p>
                    <p className="text-xs text-muted-foreground">전체 회사</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-xl">
                    <Building2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{metrics?.activeCompanies || 0}</p>
                    <p className="text-xs text-muted-foreground">활성 회사</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-xl">
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{metrics?.totalUsers || 0}</p>
                    <p className="text-xs text-muted-foreground">전체 사용자</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-xl">
                    <Warehouse className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{metrics?.totalWarehouses || 0}</p>
                    <p className="text-xs text-muted-foreground">전체 창고</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-xl">
                    <Package className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{metrics?.totalRacks || 0}</p>
                    <p className="text-xs text-muted-foreground">재고 항목</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-cyan-100 dark:bg-cyan-900/30 p-2 rounded-xl">
                    <ArrowRightLeft className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{metrics?.totalTransactions || 0}</p>
                    <p className="text-xs text-muted-foreground">거래 내역</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 요금제별 통계 */}
          {planStats && (
            <Card className="border-0 shadow-sm mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground mb-3">요금제별 현황</h3>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <p className="text-lg font-bold text-foreground">{planStats.BASIC}</p>
                    <p className="text-xs text-muted-foreground">Basic</p>
                  </div>
                  <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <p className="text-lg font-bold text-foreground">{planStats.STANDARD}</p>
                    <p className="text-xs text-muted-foreground">Standard</p>
                  </div>
                  <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                    <p className="text-lg font-bold text-foreground">{planStats.PREMIUM}</p>
                    <p className="text-xs text-muted-foreground">Premium</p>
                  </div>
                  <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                    <p className="text-lg font-bold text-foreground">{planStats.ENTERPRISE}</p>
                    <p className="text-xs text-muted-foreground">Enterprise</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 회사 목록 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">회사 관리</h3>
            </div>

            {/* 상태 필터 */}
            <div className="flex bg-muted rounded-xl p-1 mb-4">
              {['all', 'ACTIVE', 'SUSPENDED', 'DELETED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`flex-1 py-2 px-2 text-xs font-medium rounded-lg transition-all ${
                    statusFilter === status
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {status === 'all' ? '전체' : status === 'ACTIVE' ? '활성' : status === 'SUSPENDED' ? '정지' : '삭제'}
                </button>
              ))}
            </div>

            {companiesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">회사가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {companies.map((company) => (
                  <Card key={company.id} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-bold text-foreground">{company.name}</h4>
                          <p className="text-xs text-muted-foreground font-mono">{company.id}</p>
                        </div>
                        <div className="flex gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadgeColor(company.status)}`}>
                            {company.status === 'ACTIVE' ? '활성' : company.status === 'SUSPENDED' ? '정지' : '삭제'}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getPlanBadgeColor(company.planType)}`}>
                            {company.planType}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {company.userCount}명
                        </span>
                        <span className="flex items-center gap-1">
                          <Warehouse className="w-3 h-3" />
                          {company.warehouseCount}개
                        </span>
                        <span>가입: {formatDate(company.createdAt)}</span>
                      </div>

                      <div className="flex gap-2">
                        {company.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(company.id, 'SUSPENDED')}
                            disabled={actionLoading === company.id}
                            className="flex-1 h-8 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                          >
                            {actionLoading === company.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Pause className="w-3 h-3 mr-1" />
                                정지
                              </>
                            )}
                          </Button>
                        )}
                        {company.status === 'SUSPENDED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(company.id, 'ACTIVE')}
                            disabled={actionLoading === company.id}
                            className="flex-1 h-8 text-xs text-green-600 border-green-200 hover:bg-green-50"
                          >
                            {actionLoading === company.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Play className="w-3 h-3 mr-1" />
                                활성화
                              </>
                            )}
                          </Button>
                        )}
                        {company.status !== 'DELETED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(company.id, 'DELETED')}
                            disabled={actionLoading === company.id}
                            className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          >
                            {actionLoading === company.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
