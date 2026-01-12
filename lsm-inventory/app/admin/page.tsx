'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import {
  Loader2,
  LayoutDashboard,
  Users,
  Warehouse,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowRightCircle,
  TrendingUp,
  Clock,
  Settings,
  Key,
  FileText,
  BarChart3,
  Shield,
  ChevronRight,
} from 'lucide-react'

interface DashboardData {
  plan: {
    type: string
    limits: {
      maxUsers: number
      maxWarehouses: number
      maxRacks: number
    }
  }
  usage: {
    users: { current: number; limit: number; pending: number }
    warehouses: { current: number; limit: number }
    racks: { current: number; limit: number }
  }
  stats: {
    totalUsers: number
    approvedUsers: number
    pendingUsers: number
    warehouses: number
    uniqueItems: number
    totalQuantity: number
    todayTransactions: number
    monthTransactions: number
  }
  recentActivity: Array<{
    time: string
    type: string
    itemName: string
    qty: number
    userName: string
  }>
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  // 관리자 권한 확인
  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN'))) {
      router.push('/')
    }
  }, [user, authLoading, router])

  // 대시보드 데이터 로드
  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
      fetchDashboard()
    }
  }, [user])

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/admin/dashboard')
      const result = await res.json()
      if (result.success) {
        setData(result.dashboard)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPlanName = (type: string) => {
    const names: Record<string, string> = {
      BASIC: '베이직',
      STANDARD: '스탠다드',
      PREMIUM: '프리미엄',
      ENTERPRISE: '엔터프라이즈',
    }
    return names[type] || type
  }

  const getUsagePercent = (current: number, limit: number) => {
    if (limit === -1) return 0
    return Math.min(Math.round((current / limit) * 100), 100)
  }

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500'
    if (percent >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'IN':
        return <ArrowDownCircle className="w-4 h-4 text-green-500" />
      case 'OUT':
        return <ArrowUpCircle className="w-4 h-4 text-red-500" />
      case 'MOVE':
        return <ArrowRightCircle className="w-4 h-4 text-blue-500" />
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getActivityTypeName = (type: string) => {
    const names: Record<string, string> = { IN: '입고', OUT: '출고', MOVE: '이동', ADJ: '조정' }
    return names[type] || type
  }

  const formatTime = (timeString: string) => {
    const date = new Date(timeString)
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (authLoading || !user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
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
          <LayoutDashboard className="w-5 h-5 text-orange-500" />
          <h1 className="text-xl font-bold text-foreground">관리자 대시보드</h1>
        </div>
        <p className="text-sm text-muted-foreground">회사 현황 및 관리</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* 요금제 정보 */}
          <Card className="border-0 shadow-sm bg-gradient-to-r from-orange-500 to-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-white">
                <div>
                  <p className="text-sm opacity-90">현재 요금제</p>
                  <p className="text-2xl font-bold">{getPlanName(data.plan.type)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">이번 달 거래</p>
                  <p className="text-2xl font-bold">{data.stats.monthTransactions.toLocaleString()}건</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 사용량 현황 */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">사용량 현황</h2>
            <div className="grid grid-cols-3 gap-3">
              {/* 사용자 */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">사용자</span>
                  </div>
                  <p className="text-lg font-bold">
                    {data.usage.users.current}
                    {data.usage.users.limit > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        /{data.usage.users.limit}
                      </span>
                    )}
                  </p>
                  {data.usage.users.limit > 0 && (
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getUsageColor(getUsagePercent(data.usage.users.current, data.usage.users.limit))} transition-all`}
                        style={{ width: `${getUsagePercent(data.usage.users.current, data.usage.users.limit)}%` }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 창고 */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Warehouse className="w-4 h-4 text-purple-500" />
                    <span className="text-xs text-muted-foreground">창고</span>
                  </div>
                  <p className="text-lg font-bold">
                    {data.usage.warehouses.current}
                    {data.usage.warehouses.limit > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        /{data.usage.warehouses.limit}
                      </span>
                    )}
                  </p>
                  {data.usage.warehouses.limit > 0 && (
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getUsageColor(getUsagePercent(data.usage.warehouses.current, data.usage.warehouses.limit))} transition-all`}
                        style={{ width: `${getUsagePercent(data.usage.warehouses.current, data.usage.warehouses.limit)}%` }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 재고 */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">재고</span>
                  </div>
                  <p className="text-lg font-bold">
                    {data.usage.racks.current}
                    {data.usage.racks.limit > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        /{data.usage.racks.limit}
                      </span>
                    )}
                  </p>
                  {data.usage.racks.limit > 0 && (
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getUsageColor(getUsagePercent(data.usage.racks.current, data.usage.racks.limit))} transition-all`}
                        style={{ width: `${getUsagePercent(data.usage.racks.current, data.usage.racks.limit)}%` }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 주요 통계 */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">주요 통계</h2>
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">품목 종류</p>
                      <p className="text-xl font-bold">{data.stats.uniqueItems.toLocaleString()}</p>
                    </div>
                    <Package className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">총 재고 수량</p>
                      <p className="text-xl font-bold">{data.stats.totalQuantity.toLocaleString()}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">오늘 거래</p>
                      <p className="text-xl font-bold">{data.stats.todayTransactions}</p>
                    </div>
                    <Clock className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">승인 대기</p>
                      <p className="text-xl font-bold text-orange-500">{data.stats.pendingUsers}</p>
                    </div>
                    <Users className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 빠른 메뉴 */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">관리 메뉴</h2>
            <div className="space-y-2">
              <Link href="/admin/users">
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium">사용자 관리</p>
                        <p className="text-xs text-muted-foreground">가입 승인, 역할 관리</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/admin/warehouses">
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Warehouse className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="font-medium">창고 설정</p>
                        <p className="text-xs text-muted-foreground">창고 추가, 수정, 삭제</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/admin/company">
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                        <Settings className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-medium">회사 설정</p>
                        <p className="text-xs text-muted-foreground">회사 정보, 브랜딩</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/admin/data">
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium">데이터 관리</p>
                        <p className="text-xs text-muted-foreground">가져오기, 내보내기</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/admin/analytics">
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-cyan-500" />
                      </div>
                      <div>
                        <p className="font-medium">분석 리포트</p>
                        <p className="text-xs text-muted-foreground">거래 통계, 품목 분석</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/admin/api-keys">
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Key className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="font-medium">API 키 관리</p>
                        <p className="text-xs text-muted-foreground">외부 연동 API 키</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/admin/audit-log">
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900/30 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-medium">감사 로그</p>
                        <p className="text-xs text-muted-foreground">활동 이력 조회</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>

          {/* 최근 활동 */}
          {data.recentActivity.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">최근 활동</h2>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {data.recentActivity.map((activity, index) => (
                      <div key={index} className="p-3 flex items-center gap-3">
                        {getActivityIcon(activity.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{activity.itemName}</p>
                          <p className="text-xs text-muted-foreground">
                            {getActivityTypeName(activity.type)} {activity.qty}개 · {activity.userName}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTime(activity.time)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">데이터를 불러올 수 없습니다.</p>
        </div>
      )}
    </div>
  )
}
