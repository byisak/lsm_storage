'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useWarehouses } from '@/lib/warehouse-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  BarChart3,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
  Warehouse,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'

interface Analytics {
  summary: {
    totalTransactions: number
    totalIn: number
    totalOut: number
    totalMove: number
    totalInQty: number
    totalOutQty: number
    uniqueItems: number
    activeUsers: number
  }
  dailyStats: Array<{
    date: string
    inCount: number
    outCount: number
    moveCount: number
    inQty: number
    outQty: number
  }>
  topItems: Array<{
    itemCode: string
    itemName: string
    inQty: number
    outQty: number
    totalQty: number
  }>
  warehouseStats: Array<{
    warehouseId: string
    itemCount: number
    totalQty: number
    locations: number
  }>
  userActivity: Array<{
    userId: number
    userName: string
    transactionCount: number
    lastActivity: string
  }>
}

export default function AdminAnalyticsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { warehouses } = useWarehouses()

  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30')
  const [warehouseId, setWarehouseId] = useState<string>('')
  const [upgradeRequired, setUpgradeRequired] = useState(false)

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/')
    }
  }, [user, authLoading, router, isAdmin])

  useEffect(() => {
    if (isAdmin) {
      fetchAnalytics()
    }
  }, [isAdmin, period, warehouseId])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (warehouseId) {
        params.set('warehouseId', warehouseId)
      }

      const res = await fetch(`/api/analytics?${params.toString()}`)
      const data = await res.json()

      if (data.success) {
        setAnalytics(data.analytics)
        setUpgradeRequired(false)
      } else if (data.upgradeRequired) {
        setUpgradeRequired(true)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString('ko-KR')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  // 간단한 막대 그래프를 위한 최대값 계산
  const getMaxDailyCount = () => {
    if (!analytics?.dailyStats.length) return 1
    return Math.max(
      ...analytics.dailyStats.map((d) => d.inCount + d.outCount + d.moveCount),
      1
    )
  }

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
            <BarChart3 className="w-5 h-5 text-emerald-500" />
            <h1 className="text-xl font-bold text-foreground">분석 대시보드</h1>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-lg font-bold mb-2">프리미엄 기능</h2>
            <p className="text-muted-foreground mb-4">
              고급 분석 기능은 스탠다드 이상 요금제에서 사용할 수 있습니다.
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
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-500" />
            <h1 className="text-xl font-bold text-foreground">분석 대시보드</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchAnalytics}
            disabled={loading}
            className="h-8 w-8"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">입출고 및 사용량 분석</p>
      </div>

      {/* 필터 */}
      <div className="mb-4 space-y-3">
        {/* 기간 선택 */}
        <div className="flex bg-muted rounded-xl p-1">
          {(['7', '30', '90'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                period === p
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p}일
            </button>
          ))}
        </div>

        {/* 창고 필터 */}
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          className="w-full h-11 px-3 rounded-lg border border-border bg-background text-sm"
        >
          <option value="">전체 창고</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : analytics ? (
        <div className="space-y-4">
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">총 거래</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(analytics.summary.totalTransactions)}</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <ArrowDownToLine className="w-4 h-4 text-green-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">입고</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{formatNumber(analytics.summary.totalIn)}</p>
                <p className="text-xs text-muted-foreground">{formatNumber(analytics.summary.totalInQty)} 수량</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <ArrowUpFromLine className="w-4 h-4 text-red-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">출고</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{formatNumber(analytics.summary.totalOut)}</p>
                <p className="text-xs text-muted-foreground">{formatNumber(analytics.summary.totalOutQty)} 수량</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Users className="w-4 h-4 text-purple-500" />
                  </div>
                  <span className="text-sm text-muted-foreground">활성 사용자</span>
                </div>
                <p className="text-2xl font-bold">{analytics.summary.activeUsers}</p>
              </CardContent>
            </Card>
          </div>

          {/* 일별 추이 그래프 */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold mb-3">일별 거래 추이</h3>
              {analytics.dailyStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {analytics.dailyStats.slice(-14).map((day) => {
                    const maxCount = getMaxDailyCount()
                    const total = day.inCount + day.outCount + day.moveCount
                    const inWidth = (day.inCount / maxCount) * 100
                    const outWidth = (day.outCount / maxCount) * 100

                    return (
                      <div key={day.date} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-10 shrink-0">
                          {formatDate(day.date)}
                        </span>
                        <div className="flex-1 flex gap-0.5 h-5">
                          <div
                            className="bg-green-500 rounded-l"
                            style={{ width: `${inWidth}%` }}
                            title={`입고: ${day.inCount}`}
                          />
                          <div
                            className="bg-red-500 rounded-r"
                            style={{ width: `${outWidth}%` }}
                            title={`출고: ${day.outCount}`}
                          />
                        </div>
                        <span className="text-xs font-medium w-8 text-right">{total}</span>
                      </div>
                    )
                  })}
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground justify-center">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-green-500" /> 입고
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-red-500" /> 출고
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 인기 품목 */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                인기 품목 TOP 10
              </h3>
              {analytics.topItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {analytics.topItems.map((item, index) => (
                    <div key={item.itemCode} className="flex items-center gap-2 py-1">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        index < 3 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.itemName || item.itemCode}</p>
                        <p className="text-xs text-muted-foreground">{item.itemCode}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatNumber(item.totalQty)}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="text-green-500">+{item.inQty}</span>
                          {' / '}
                          <span className="text-red-500">-{item.outQty}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 창고별 현황 */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Warehouse className="w-4 h-4" />
                창고별 현황
              </h3>
              {analytics.warehouseStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {analytics.warehouseStats.map((ws) => {
                    const warehouseName = warehouses.find((w) => w.id === ws.warehouseId)?.name || ws.warehouseId
                    return (
                      <div key={ws.warehouseId} className="bg-muted/50 rounded-lg p-3">
                        <p className="font-medium text-sm mb-1">{warehouseName}</p>
                        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                          <span>품목: {ws.itemCount}</span>
                          <span>수량: {formatNumber(ws.totalQty)}</span>
                          <span>위치: {ws.locations}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 사용자 활동 */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                사용자 활동
              </h3>
              {analytics.userActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {analytics.userActivity.map((ua) => (
                    <div key={ua.userId} className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-sm font-medium">{ua.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          마지막 활동: {new Date(ua.lastActivity).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      <span className="text-sm font-bold">{formatNumber(ua.transactionCount)}건</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <TrendingDown className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">분석 데이터를 불러올 수 없습니다</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
