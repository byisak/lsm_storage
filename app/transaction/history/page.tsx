'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Search, ArrowDownToLine, ArrowUpFromLine, MapPin, Warehouse, User, Loader2, ClipboardX, Pencil, MoveRight, Calendar as CalendarIcon, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

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
  const [categoryFilter, setCategoryFilter] = useState<string>('전체')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)

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

  // REMARK에서 JSON 메타데이터 제거하고 표시용 텍스트만 추출
  const parseDisplayRemark = (remark: string | null): string | null => {
    if (!remark) return null

    // JSON|표시텍스트 형식인 경우 표시텍스트만 반환
    const pipeIndex = remark.indexOf('|')
    if (pipeIndex !== -1 && remark.startsWith('{')) {
      const displayPart = remark.substring(pipeIndex + 1)
      return displayPart || null
    }

    // JSON만 있는 경우 (표시할 내용 없음)
    if (remark.startsWith('{') && remark.endsWith('}')) {
      return null
    }

    return remark
  }

  // 필터링된 데이터
  const filteredItems = items.filter((item) => {
    // 카테고리 필터
    if (categoryFilter !== '전체') {
      if (categoryFilter === '이동' && !item.category.includes('이동')) return false
      if (categoryFilter !== '이동' && item.category !== categoryFilter) return false
    }
    // 날짜 필터
    const itemDate = new Date(item.subulTime)
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      fromDate.setHours(0, 0, 0, 0)
      if (itemDate < fromDate) return false
    }
    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      if (itemDate > toDate) return false
    }
    return true
  })

  return (
    <div className="p-4">
      {/* Search Header */}
      <div className="mb-4">
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

      {/* 필터 영역 */}
      <div className="mb-4 space-y-2">
        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-1.5">
          {['전체', '입고', '출고', '이동', '수정'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                categoryFilter === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent text-muted-foreground hover:bg-accent/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {/* 날짜 필터 + 검색 버튼 */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs flex-1">
                <CalendarIcon className="w-3 h-3 mr-1" />
                {dateFrom ? format(dateFrom, 'yy.MM.dd') : '시작일'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                locale={ko}
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground text-xs">~</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs flex-1">
                <CalendarIcon className="w-3 h-3 mr-1" />
                {dateTo ? format(dateTo, 'yy.MM.dd') : '종료일'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
                locale={ko}
              />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => {
                setDateFrom(undefined)
                setDateTo(undefined)
              }}
            >
              <XCircle className="w-4 h-4" />
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 px-4"
            onClick={() => fetchHistory(query || undefined)}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '검색'}
          </Button>
        </div>
        {/* 결과 카운트 */}
        <div className="text-xs text-muted-foreground">
          {filteredItems.length}건
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
        {filteredItems.map((item) => {
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

                    <p className="font-bold text-primary mt-1">{item.itemCode}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.itemName}</p>

                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {item.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Warehouse className="w-3 h-3" />
                        {item.storage}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {item.user}
                      </span>
                    </div>

                    {parseDisplayRemark(item.remark) && (
                      <p className="text-xs text-muted-foreground mt-2 bg-muted px-2 py-1 rounded">
                        {parseDisplayRemark(item.remark)}
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
      {filteredItems.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
            <ClipboardX className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">
            {items.length === 0 ? '수불 이력이 없습니다' : '조건에 맞는 이력이 없습니다'}
          </p>
          <p className="text-muted-foreground/70 text-sm mt-1">
            {items.length === 0 ? '입출고 처리 후 이력이 표시됩니다' : '필터 조건을 변경해 보세요'}
          </p>
        </div>
      )}
    </div>
  )
}
