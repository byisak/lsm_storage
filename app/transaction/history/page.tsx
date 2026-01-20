'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Search, ArrowDownToLine, ArrowUpFromLine, MapPin, Warehouse, User, Loader2, ClipboardX, Pencil, MoveRight, Calendar as CalendarIcon, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

const PAGE_SIZE = 20

interface AutocompleteItem {
  itemCode: string
  itemName: string
}

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
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string>('전체')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)

  // 자동완성 관련 state
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchHistory()
  }, [])

  // 자동완성 API 호출
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query || query.length < 1) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }
      try {
        const res = await fetch(`/api/item/autocomplete?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        if (data.success) {
          setSuggestions(data.items)
          setShowSuggestions(data.items.length > 0)
        }
      } catch (error) {
        console.error('Autocomplete error:', error)
      }
    }
    const debounce = setTimeout(fetchSuggestions, 150)
    return () => clearTimeout(debounce)
  }, [query])

  // 외부 클릭 시 자동완성 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchHistory = async (itemCode?: string, category?: string, from?: Date, to?: Date, reset = true) => {
    if (reset) {
      setLoading(true)
      setItems([])
      setHasMore(true)
    }
    try {
      const params = new URLSearchParams()
      if (itemCode) params.set('itemCode', itemCode)
      if (category && category !== '전체') params.set('category', category)
      if (from) params.set('dateFrom', format(from, 'yyyy-MM-dd'))
      if (to) params.set('dateTo', format(to, 'yyyy-MM-dd'))
      params.set('limit', PAGE_SIZE.toString())
      params.set('offset', '0')

      const url = `/api/transaction/history?${params.toString()}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setItems(data.items)
        setHasMore(data.hasMore)
      }
    } catch (error) {
      console.error('History error:', error)
    } finally {
      setLoading(false)
    }
  }

  // 추가 데이터 로드 (무한 스크롤)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('itemCode', query)
      if (categoryFilter && categoryFilter !== '전체') params.set('category', categoryFilter)
      if (dateFrom) params.set('dateFrom', format(dateFrom, 'yyyy-MM-dd'))
      if (dateTo) params.set('dateTo', format(dateTo, 'yyyy-MM-dd'))
      params.set('limit', PAGE_SIZE.toString())
      params.set('offset', items.length.toString())

      const url = `/api/transaction/history?${params.toString()}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setItems(prev => [...prev, ...data.items])
        setHasMore(data.hasMore)
      }
    } catch (error) {
      console.error('Load more error:', error)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, query, categoryFilter, dateFrom, dateTo, items.length])

  // 무한 스크롤 감지 (IntersectionObserver)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    if (loaderRef.current) {
      observer.observe(loaderRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, loadMore])

  const handleSearch = () => {
    setShowSuggestions(false)
    fetchHistory(query || undefined, categoryFilter, dateFrom, dateTo)
  }

  // 자동완성 항목 선택
  const handleSelectSuggestion = (item: AutocompleteItem) => {
    setQuery(item.itemCode)
    setShowSuggestions(false)
    setSuggestions([])
    // 선택 후 바로 검색
    fetchHistory(item.itemCode, categoryFilter, dateFrom, dateTo)
  }

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSearch()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex])
        } else {
          handleSearch()
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        break
    }
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

  // 서버에서 필터링하므로 items를 직접 사용

  return (
    <div className="p-4">
      {/* Search Header */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-foreground mb-3">수불 이력</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="품목코드로 검색"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(-1)
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            className="pl-10 pr-20 h-12 text-base rounded-xl border-gray-200"
          />
          <Button
            onClick={handleSearch}
            disabled={loading}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-4 rounded-lg"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '검색'}
          </Button>

          {/* 자동완성 목록 */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto"
            >
              {suggestions.map((item, index) => (
                <button
                  key={item.itemCode}
                  onClick={() => handleSelectSuggestion(item)}
                  className={`w-full px-4 py-2.5 text-left hover:bg-accent transition-colors ${
                    index === selectedIndex ? 'bg-accent' : ''
                  }`}
                >
                  <p className="font-medium text-sm text-foreground">{item.itemCode}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.itemName}</p>
                </button>
              ))}
            </div>
          )}
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
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '검색'}
          </Button>
        </div>
        {/* 결과 카운트 */}
        <div className="text-xs text-muted-foreground">
          {items.length}건
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

      {/* 무한 스크롤 로더 */}
      {hasMore && items.length > 0 && (
        <div ref={loaderRef} className="flex items-center justify-center py-6">
          {loadingMore && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
        </div>
      )}

      {/* 더 이상 데이터 없음 */}
      {!hasMore && items.length > 0 && (
        <div className="text-center py-4 text-xs text-muted-foreground">
          모든 이력을 불러왔습니다
        </div>
      )}

      {/* Empty State */}
      {items.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
            <ClipboardX className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">
            수불 이력이 없습니다
          </p>
          <p className="text-muted-foreground/70 text-sm mt-1">
            입출고 처리 후 이력이 표시됩니다
          </p>
        </div>
      )}
    </div>
  )
}
