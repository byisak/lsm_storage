'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, ArrowDownToLine, ArrowUpFromLine, MapPin, Warehouse, User, Loader2, ClipboardX, Pencil, MoveRight } from 'lucide-react'
import { useWarehouses } from '@/lib/warehouse-context'

interface SubulItem {
  id: number
  storage: string
  location: string
  itemCode: string
  itemName: string
  qty: number
  category: string
  subulTime: string
  remark: string | null
  user: string
}

export default function TransactionHistoryPage() {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SubulItem[]>([])
  const [loading, setLoading] = useState(false)
  const { getWarehouseName } = useWarehouses()

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async (itemCode?: string) => {
    setLoading(true)
    try {
      const url = itemCode
        ? `/api/transaction/history?itemCode=${encodeURIComponent(itemCode)}`
        : '/api/transaction/history'
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setItems(data.items)
      }
    } catch (error) {
      console.error('History error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchHistory(query || undefined)
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // 숫자 3자리 콤마 포맷팅
  const formatNumber = (num: number) => num.toLocaleString('ko-KR')

  return (
    <div className="p-4">
      {/* Search Header */}
      <div className="mb-5">
        <h2 className="text-lg font-bold text-foreground mb-3">수불 이력</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="품목코드로 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10 pr-20 h-12 text-base rounded-xl border-gray-200"
          />
          <Button
            onClick={handleSearch}
            disabled={loading}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-4 rounded-lg"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '검색'}
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      )}

      {/* Results List */}
      <div className="space-y-3">
        {items.map((item) => {
          const isIn = item.category === '입고' || item.category === '이동(입)'
          const isEdit = item.category.includes('수정')
          const isMove = item.category.includes('이동')

          // 카테고리별 색상 설정
          const getCategoryColor = () => {
            if (isMove) return { bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-600 dark:text-teal-400', badge: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300' }
            if (isEdit) return { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-600 dark:text-purple-400', badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' }
            if (isIn) return { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' }
            return { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-600 dark:text-orange-400', badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' }
          }
          const colors = getCategoryColor()

          // 아이콘 선택
          const getIcon = () => {
            if (isMove) return <MoveRight className={`w-5 h-5 ${colors.text}`} />
            if (isEdit) return <Pencil className={`w-5 h-5 ${colors.text}`} />
            if (item.category === '입고') return <ArrowDownToLine className={`w-5 h-5 ${colors.text}`} />
            return <ArrowUpFromLine className={`w-5 h-5 ${colors.text}`} />
          }

          return (
            <Card key={item.id} className="border-0 shadow-sm overflow-hidden bg-card">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  {/* Icon */}
                  <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${colors.bg}`}>
                    {getIcon()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors.badge}`}>
                          {item.category}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(item.subulTime)}
                        </span>
                      </div>
                      <p className={`text-lg font-bold tabular-nums ${colors.text}`}>
                        {isEdit ? '' : isMove ? '↔' : (isIn ? '+' : '-')}{item.qty > 0 ? formatNumber(item.qty) : ''}
                      </p>
                    </div>

                    <p className="font-medium text-foreground mt-1 truncate">{item.itemName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{item.itemCode}</p>

                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {item.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Warehouse className="w-3 h-3" />
                        {getWarehouseName(item.storage)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {item.user}
                      </span>
                    </div>

                    {item.remark && (
                      <p className="text-xs text-muted-foreground mt-2 bg-muted px-2 py-1 rounded">
                        {item.remark}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Empty State */}
      {items.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
            <ClipboardX className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">수불 이력이 없습니다</p>
          <p className="text-muted-foreground/70 text-sm mt-1">입출고 처리 후 이력이 표시됩니다</p>
        </div>
      )}
    </div>
  )
}
