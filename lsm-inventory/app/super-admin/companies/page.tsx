'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  Building2,
  Users,
  Warehouse,
  Package,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Play,
  Crown,
  Search,
} from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Company {
  id: string
  name: string
  status: string
  planType: string
  userCount: number
  warehouseCount: number
  rackCount: number
  createdAt: string
}

export default function SuperAdminCompaniesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL')

  // 슈퍼 관리자 권한 확인
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'SUPER_ADMIN')) {
      router.push('/')
    }
  }, [user, authLoading, router])

  // 회사 목록 로드
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      fetchCompanies()
    }
  }, [user])

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/super-admin/companies')
      const data = await res.json()
      if (data.success) {
        setCompanies(data.companies)
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (companyId: string, newStatus: 'ACTIVE' | 'SUSPENDED') => {
    setActionLoading(companyId)
    try {
      const res = await fetch('/api/super-admin/companies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, status: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        setCompanies((prev) =>
          prev.map((c) => (c.id === companyId ? { ...c, status: newStatus } : c))
        )
      }
    } catch (error) {
      console.error('Failed to update company:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handlePlanChange = async (companyId: string, newPlan: string) => {
    setActionLoading(companyId)
    try {
      const res = await fetch('/api/super-admin/companies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, planType: newPlan }),
      })
      const data = await res.json()
      if (data.success) {
        setCompanies((prev) =>
          prev.map((c) => (c.id === companyId ? { ...c, planType: newPlan } : c))
        )
      }
    } catch (error) {
      console.error('Failed to update company plan:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'ENTERPRISE':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case 'PREMIUM':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      case 'STANDARD':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getPlanName = (plan: string) => {
    const names: Record<string, string> = {
      BASIC: '베이직',
      STANDARD: '스탠다드',
      PREMIUM: '프리미엄',
      ENTERPRISE: '엔터프라이즈',
    }
    return names[plan] || plan
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'SUSPENDED':
        return <PauseCircle className="w-4 h-4 text-red-500" />
      default:
        return <XCircle className="w-4 h-4 text-gray-500" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // 필터링된 회사 목록
  const filteredCompanies = companies.filter((company) => {
    const matchesSearch =
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'ALL' || company.status === statusFilter
    return matchesSearch && matchesStatus
  })

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
          <Building2 className="w-5 h-5 text-purple-500" />
          <h1 className="text-xl font-bold text-foreground">회사 관리</h1>
        </div>
        <p className="text-sm text-muted-foreground">등록된 회사 목록 및 관리</p>
      </div>

      {/* 검색 및 필터 */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="회사명 또는 ID 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 rounded-lg"
          />
        </div>
        <div className="flex bg-muted rounded-xl p-1">
          {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                statusFilter === status
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {status === 'ALL' ? '전체' : status === 'ACTIVE' ? '활성' : '정지'}
            </button>
          ))}
        </div>
      </div>

      {/* 회사 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">회사가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCompanies.map((company) => (
            <Card key={company.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(company.status)}
                    <div>
                      <h3 className="font-bold text-foreground">{company.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{company.id}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPlanBadgeColor(company.planType)}`}>
                    {getPlanName(company.planType)}
                  </span>
                </div>

                {/* 통계 */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <Users className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                    <p className="text-sm font-bold">{company.userCount}</p>
                    <p className="text-xs text-muted-foreground">사용자</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <Warehouse className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                    <p className="text-sm font-bold">{company.warehouseCount}</p>
                    <p className="text-xs text-muted-foreground">창고</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <Package className="w-4 h-4 text-green-500 mx-auto mb-1" />
                    <p className="text-sm font-bold">{company.rackCount}</p>
                    <p className="text-xs text-muted-foreground">재고</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-3">등록일: {formatDate(company.createdAt)}</p>

                {/* 액션 버튼 */}
                <div className="flex gap-2">
                  {company.status === 'ACTIVE' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(company.id, 'SUSPENDED')}
                      disabled={actionLoading === company.id}
                      className="flex-1 h-9 text-red-500 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/30"
                    >
                      {actionLoading === company.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <PauseCircle className="w-4 h-4 mr-1" />
                          정지
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(company.id, 'ACTIVE')}
                      disabled={actionLoading === company.id}
                      className="flex-1 h-9 text-green-500 border-green-200 hover:bg-green-50 dark:border-green-900 dark:hover:bg-green-900/30"
                    >
                      {actionLoading === company.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-1" />
                          활성화
                        </>
                      )}
                    </Button>
                  )}

                  {/* 요금제 변경 드롭다운 */}
                  <select
                    value={company.planType}
                    onChange={(e) => handlePlanChange(company.id, e.target.value)}
                    disabled={actionLoading === company.id}
                    className="flex-1 h-9 px-3 text-sm rounded-lg border border-border bg-background"
                  >
                    <option value="BASIC">베이직</option>
                    <option value="STANDARD">스탠다드</option>
                    <option value="PREMIUM">프리미엄</option>
                    <option value="ENTERPRISE">엔터프라이즈</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
