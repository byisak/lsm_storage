'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Search, Loader2, Package, MapPin, Warehouse, Calendar as CalendarIcon, PackageSearch, ArrowUpFromLine, Pencil, CheckCircle2, XCircle, PackageX, PackagePlus, MoveRight, ChevronDown, AlertTriangle, Clock } from 'lucide-react'
import { useWarehouses, WarehouseConfig } from '@/lib/warehouse-context'
import { useAuth } from '@/lib/auth-context'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { expandLocation, isShortLocation } from '@/lib/location-utils'
import { getItemSearchHistory, addItemSearchHistory, getRackSearchHistory, addRackSearchHistory } from '@/lib/search-history'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'

type SearchTab = 'item' | 'rack'

interface RackItem {
  id: number
  storage: string
  location: string
  itemCode: string
  itemName: string
  nowQty: number
  inDay: string | null
  remark: string | null
}

interface AutocompleteItem {
  itemCode: string
  itemName: string
}

interface LocationSuggestion {
  location: string
  storage: string
}

interface HistoryItem {
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

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<SearchTab>('item')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<RackItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [hasSearched, setHasSearched] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // 랙 검색 관련 상태
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([])
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const [locationSelectedIndex, setLocationSelectedIndex] = useState(-1)
  const [expandedHint, setExpandedHint] = useState<string | null>(null)
  const [searchedLocation, setSearchedLocation] = useState<{storage: string, location: string} | null>(null)
  const [currentSearchQuery, setCurrentSearchQuery] = useState('')
  const locationInputRef = useRef<HTMLInputElement>(null)
  const locationSuggestionsRef = useRef<HTMLDivElement>(null)

  // 검색 기록 상태
  const [itemSearchHistory, setItemSearchHistory] = useState<string[]>([])
  const [rackSearchHistory, setRackSearchHistory] = useState<string[]>([])

  // 출고 모달 상태
  const [outboundItem, setOutboundItem] = useState<RackItem | null>(null)
  const [outboundQty, setOutboundQty] = useState('')
  const [outboundLoading, setOutboundLoading] = useState(false)
  const [outboundMessage, setOutboundMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 수정 모달 상태
  const [editItem, setEditItem] = useState<RackItem | null>(null)
  const [editForm, setEditForm] = useState({
    itemCode: '',
    itemName: '',
    nowQty: '',
    inDay: '',
    remark: '',
  })
  const [editLoading, setEditLoading] = useState(false)
  const [editMessage, setEditMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 수정 모달 품목코드 자동완성 상태
  const [editSuggestions, setEditSuggestions] = useState<AutocompleteItem[]>([])
  const [showEditSuggestions, setShowEditSuggestions] = useState(false)
  const [editSelectedIndex, setEditSelectedIndex] = useState(-1)
  const [editItemCodeChanged, setEditItemCodeChanged] = useState(false) // 사용자가 직접 입력했는지 여부
  const editItemCodeRef = useRef<HTMLInputElement>(null)
  const editSuggestionsRef = useRef<HTMLDivElement>(null)

  // 이동 모달 상태
  const [moveItem, setMoveItem] = useState<RackItem | null>(null)
  const [moveForm, setMoveForm] = useState({
    toStorage: '',
    toLocation: '',
    qty: '',
  })
  const [moveLoading, setMoveLoading] = useState(false)
  const [moveMessage, setMoveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 이동 병합 확인 모달 상태
  const [showMoveMergeModal, setShowMoveMergeModal] = useState(false)
  const [moveMergeInfo, setMoveMergeInfo] = useState<{
    existingItem: { id: number; currentQty: number; itemName: string }
    moveQty: number
    mergedQty: number
  } | null>(null)
  const [moveMergeLoading, setMoveMergeLoading] = useState(false)
  const [pendingMoveData, setPendingMoveData] = useState<{
    rackId: number
    toStorage: string
    toLocation: string
    qty: number
    user: string
  } | null>(null)

  // 이동 모달 위치 자동완성 상태
  const [moveLocationSuggestions, setMoveLocationSuggestions] = useState<LocationSuggestion[]>([])
  const [showMoveLocationSuggestions, setShowMoveLocationSuggestions] = useState(false)
  const [moveLocationSelectedIndex, setMoveLocationSelectedIndex] = useState(-1)
  const [moveExpandedHint, setMoveExpandedHint] = useState<string | null>(null)
  const moveLocationInputRef = useRef<HTMLInputElement>(null)
  const moveLocationSuggestionsRef = useRef<HTMLDivElement>(null)

  // 수불 내역 모달 상태
  const [historyItem, setHistoryItem] = useState<{ itemCode: string; itemName: string } | null>(null)
  const [historyData, setHistoryData] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<string>('전체')
  const [historyDateFrom, setHistoryDateFrom] = useState<Date | undefined>(undefined)
  const [historyDateTo, setHistoryDateTo] = useState<Date | undefined>(undefined)

  // 창고 컨텍스트에서 창고 목록 및 이름 조회 함수 가져오기
  const { warehouses, loading: warehousesLoading, getWarehouseName } = useWarehouses()

  // 로그인 사용자 정보
  const { user } = useAuth()

  // URL 파라미터로 QR 스캔 자동 검색
  useEffect(() => {
    // 창고 목록 로드 완료 후에만 스캔 실행
    if (warehousesLoading) return

    const scanParam = searchParams.get('scan')
    const qParam = searchParams.get('q') // QR 전체 값 (예: 03|A-03-B2)
    const rackSearchParam = searchParams.get('rackSearch')
    const storageIdParam = searchParams.get('storageId')

    // q 파라미터 처리 (QR 전체 값: 03|A-03-B2)
    if (qParam && qParam.includes('|')) {
      const [storageId, locationPart] = qParam.split('|')
      setActiveTab('rack')
      setQuery(locationPart)

      const doQSearch = async () => {
        setHasSearched(true)
        setShowLocationSuggestions(false)
        setLocationSuggestions([])
        setLoading(true)
        setSearched(true)

        try {
          const location = expandLocation(locationPart)
          setCurrentSearchQuery(location)
          addRackSearchHistory(locationPart)
          setRackSearchHistory(getRackSearchHistory())

          // 창고ID 포함해서 검색
          const url = `/api/rack/search?location=${encodeURIComponent(location)}&storage=${encodeURIComponent(storageId)}`
          const res = await fetch(url)
          const data = await res.json()
          if (data.success) {
            setItems(data.items)
            if (data.storage) {
              setSearchedLocation({ storage: data.storage, location: location })
            }
          }
        } catch (error) {
          console.error('Q param search error:', error)
        } finally {
          setLoading(false)
        }
      }

      doQSearch()
      router.replace('/', { scroll: false })
      return
    }

    // rackSearch 파라미터 처리 (QR 스캔 후 위치 검색)
    if (rackSearchParam) {
      setActiveTab('rack')
      setQuery(rackSearchParam)

      const doRackSearch = async () => {
        setHasSearched(true)
        setShowLocationSuggestions(false)
        setLocationSuggestions([])
        setLoading(true)
        setSearched(true)

        try {
          const q = expandLocation(rackSearchParam)
          setCurrentSearchQuery(q)
          addRackSearchHistory(rackSearchParam)
          setRackSearchHistory(getRackSearchHistory())

          // 창고ID가 있으면 필터링 추가
          let url = `/api/rack/search?location=${encodeURIComponent(q)}`
          if (storageIdParam) {
            url += `&storage=${encodeURIComponent(storageIdParam)}`
          }

          const res = await fetch(url)
          const data = await res.json()
          if (data.success) {
            setItems(data.items)
            // 창고명 표시
            if (data.storage) {
              setSearchedLocation({ storage: data.storage, location: q })
            } else {
              setSearchedLocation(null)
            }
          }
        } catch (error) {
          console.error('Rack search error:', error)
        } finally {
          setLoading(false)
        }
      }

      doRackSearch()
      router.replace('/', { scroll: false })
      return
    }

    if (scanParam) {
      // 랙 검색 탭으로 전환하고 자동 검색
      setActiveTab('rack')

      // QR 형식: "1|A-01-A2"에서 위치값만 인풋에 표시
      const locationOnly = scanParam.includes('|')
        ? scanParam.split('|')[1]
        : scanParam
      setQuery(locationOnly)

      // 검색 실행
      const doSearch = async () => {
        setHasSearched(true)
        setShowLocationSuggestions(false)
        setLocationSuggestions([])
        setLoading(true)
        setSearched(true)

        try {
          if (scanParam.includes('|')) {
            // QR 형식: "1|A-01-A2" → 창고ID|위치
            const [storageId, locationPart] = scanParam.split('|')
            const storageName = getWarehouseName(storageId) // 창고 ID를 이름으로 변환
            const location = expandLocation(locationPart)

            setCurrentSearchQuery(location)

            // DB에는 창고명으로 저장되어 있으므로 이름으로 검색
            const res = await fetch(`/api/rack/scan?storage=${encodeURIComponent(storageName)}&location=${encodeURIComponent(location)}`)
            const data = await res.json()
            if (data.success) {
              setItems(data.items)
              setSearchedLocation({ storage: storageName, location: location })
            }
          } else {
            const q = expandLocation(scanParam)
            setCurrentSearchQuery(q)
            const res = await fetch(`/api/rack/search?location=${encodeURIComponent(q)}`)
            const data = await res.json()
            if (data.success) {
              setItems(data.items)
              setSearchedLocation(null)
            }
          }
        } catch (error) {
          console.error('Rack search error:', error)
        } finally {
          setLoading(false)
        }
      }

      doSearch()

      // URL에서 scan 파라미터 제거 (히스토리 유지)
      router.replace('/', { scroll: false })
    }
  }, [searchParams, router, warehousesLoading, getWarehouseName])

  // 검색 기록 로드 (컴포넌트 마운트 시)
  useEffect(() => {
    setItemSearchHistory(getItemSearchHistory())
    setRackSearchHistory(getRackSearchHistory())
  }, [])

  // 품목코드 자동완성 검색
  useEffect(() => {
    if (activeTab !== 'item' || hasSearched) {
      return
    }

    const fetchSuggestions = async () => {
      if (!query.trim() || query.length < 1) {
        setSuggestions([])
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
  }, [query, hasSearched, activeTab])

  // 랙 위치 자동완성 검색
  useEffect(() => {
    if (activeTab !== 'rack' || hasSearched) {
      return
    }

    const fetchLocationSuggestions = async () => {
      if (!query.trim()) {
        setLocationSuggestions([])
        setExpandedHint(null)
        return
      }

      // 단축 입력 힌트 표시
      if (isShortLocation(query)) {
        setExpandedHint(expandLocation(query))
      } else {
        setExpandedHint(null)
      }

      try {
        const res = await fetch(`/api/rack/autocomplete?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        if (data.success) {
          setLocationSuggestions(data.locations)
          setShowLocationSuggestions(data.locations.length > 0)
        }
      } catch (error) {
        console.error('Location autocomplete error:', error)
      }
    }

    const debounce = setTimeout(fetchLocationSuggestions, 150)
    return () => clearTimeout(debounce)
  }, [query, hasSearched, activeTab])

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // 품목코드 자동완성 닫기
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
      // 랙 위치 자동완성 닫기
      if (
        locationSuggestionsRef.current &&
        !locationSuggestionsRef.current.contains(e.target as Node) &&
        locationInputRef.current &&
        !locationInputRef.current.contains(e.target as Node)
      ) {
        setShowLocationSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 수정 모달 품목코드 자동완성 검색
  useEffect(() => {
    if (!editItem) {
      setEditSuggestions([])
      setShowEditSuggestions(false)
      return
    }

    // 사용자가 직접 입력하지 않았으면 자동완성 표시 안 함
    if (!editItemCodeChanged) {
      return
    }

    const fetchEditSuggestions = async () => {
      if (!editForm.itemCode.trim() || editForm.itemCode.length < 1) {
        setEditSuggestions([])
        return
      }

      try {
        const res = await fetch(`/api/item/autocomplete?q=${encodeURIComponent(editForm.itemCode)}`)
        const data = await res.json()
        if (data.success) {
          setEditSuggestions(data.items)
          setShowEditSuggestions(data.items.length > 0)
        }
      } catch (error) {
        console.error('Edit autocomplete error:', error)
      }
    }

    const debounce = setTimeout(fetchEditSuggestions, 150)
    return () => clearTimeout(debounce)
  }, [editForm.itemCode, editItem, editItemCodeChanged])

  // 수정 모달 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutsideEdit = (e: MouseEvent) => {
      if (
        editSuggestionsRef.current &&
        !editSuggestionsRef.current.contains(e.target as Node) &&
        editItemCodeRef.current &&
        !editItemCodeRef.current.contains(e.target as Node)
      ) {
        setShowEditSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutsideEdit)
    return () => document.removeEventListener('mousedown', handleClickOutsideEdit)
  }, [])

  // 이동 모달 위치 자동완성 검색
  useEffect(() => {
    if (!moveItem) {
      setMoveLocationSuggestions([])
      setShowMoveLocationSuggestions(false)
      return
    }

    const fetchMoveLocationSuggestions = async () => {
      const location = moveForm.toLocation.trim()
      if (!location) {
        setMoveLocationSuggestions([])
        setMoveExpandedHint(null)
        return
      }

      // 단축 입력 힌트 표시
      if (isShortLocation(location)) {
        setMoveExpandedHint(expandLocation(location))
      } else {
        setMoveExpandedHint(null)
      }

      try {
        const searchLocation = isShortLocation(location) ? expandLocation(location) : location
        const res = await fetch(`/api/rack/autocomplete?q=${encodeURIComponent(searchLocation)}`)
        const data = await res.json()
        if (data.success) {
          setMoveLocationSuggestions(data.locations)
          setShowMoveLocationSuggestions(data.locations.length > 0)
        }
      } catch (error) {
        console.error('Move location autocomplete error:', error)
      }
    }

    const debounce = setTimeout(fetchMoveLocationSuggestions, 150)
    return () => clearTimeout(debounce)
  }, [moveForm.toLocation, moveItem])

  // 이동 모달 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutsideMove = (e: MouseEvent) => {
      if (
        moveLocationSuggestionsRef.current &&
        !moveLocationSuggestionsRef.current.contains(e.target as Node) &&
        moveLocationInputRef.current &&
        !moveLocationInputRef.current.contains(e.target as Node)
      ) {
        setShowMoveLocationSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutsideMove)
    return () => document.removeEventListener('mousedown', handleClickOutsideMove)
  }, [])

  // 탭 변경 시 상태 초기화
  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab)
    setQuery('')
    setItems([])
    setSearched(false)
    setHasSearched(false)
    setSuggestions([])
    setShowSuggestions(false)
    setLocationSuggestions([])
    setShowLocationSuggestions(false)
    setExpandedHint(null)
    setSearchedLocation(null)
    setCurrentSearchQuery('')
  }

  // 품목코드 검색
  const handleItemSearch = async (searchQuery?: string) => {
    const q = searchQuery || query
    if (!q.trim()) return

    setHasSearched(true)
    setShowSuggestions(false)
    setSuggestions([])
    setLoading(true)
    setSearched(true)

    // 검색 기록 저장
    const updatedHistory = addItemSearchHistory(q)
    setItemSearchHistory(updatedHistory)

    try {
      const res = await fetch(`/api/item/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.success) {
        setItems(data.items)
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  // 랙 검색
  const handleRackSearch = async (searchQuery?: string) => {
    let q = searchQuery || query
    if (!q.trim()) return

    // 단축 입력 변환
    q = expandLocation(q)

    setHasSearched(true)
    setShowLocationSuggestions(false)
    setLocationSuggestions([])
    setLoading(true)
    setSearched(true)
    setCurrentSearchQuery(q)

    // 검색 기록 저장
    const updatedHistory = addRackSearchHistory(q)
    setRackSearchHistory(updatedHistory)

    try {
      if (q.includes('|')) {
        const res = await fetch(`/api/rack/scan?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        if (data.success) {
          setItems(data.items)
          setSearchedLocation({ storage: data.storage, location: data.location })
        }
      } else {
        const res = await fetch(`/api/rack/search?location=${encodeURIComponent(q)}`)
        const data = await res.json()
        if (data.success) {
          setItems(data.items)
          setSearchedLocation(null)
        }
      }
    } catch (error) {
      console.error('Rack search error:', error)
    } finally {
      setLoading(false)
    }
  }

  // 통합 검색 핸들러
  const handleSearch = async (searchQuery?: string) => {
    if (activeTab === 'item') {
      await handleItemSearch(searchQuery)
    } else {
      await handleRackSearch(searchQuery)
    }
  }

  // 품목코드 자동완성 선택
  const handleSelectSuggestion = (item: AutocompleteItem) => {
    setHasSearched(true)
    setQuery(item.itemCode)
    setShowSuggestions(false)
    setSuggestions([])
    handleItemSearch(item.itemCode)
  }

  // 랙 위치 자동완성 선택
  const handleSelectLocationSuggestion = (suggestion: LocationSuggestion) => {
    setHasSearched(true)
    setQuery(suggestion.location)
    setShowLocationSuggestions(false)
    setLocationSuggestions([])
    handleRackSearch(suggestion.location)
  }

  // 품목코드 검색 키보드 핸들러
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSearch()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[selectedIndex])
      } else {
        handleSearch()
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  // 랙 검색 키보드 핸들러
  const handleRackKeyDown = (e: React.KeyboardEvent) => {
    if (!showLocationSuggestions || locationSuggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSearch()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setLocationSelectedIndex(prev => (prev < locationSuggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setLocationSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (locationSelectedIndex >= 0 && locationSelectedIndex < locationSuggestions.length) {
        handleSelectLocationSuggestion(locationSuggestions[locationSelectedIndex])
      } else {
        handleSearch()
      }
    } else if (e.key === 'Escape') {
      setShowLocationSuggestions(false)
    }
  }

  // 이 위치에 자재 입고 버튼 핸들러
  const handleGoToInbound = () => {
    const location = searchedLocation?.location || currentSearchQuery
    const storage = searchedLocation?.storage || ''
    const params = new URLSearchParams()
    if (location) params.set('location', location)
    if (storage) params.set('storage', storage)
    router.push(`/transaction/in?${params.toString()}`)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const totalQty = items.reduce((sum, item) => sum + item.nowQty, 0)

  // 숫자 3자리 콤마 포맷팅
  const formatNumber = (num: number) => num.toLocaleString('ko-KR')

  // 출고 모달 열기
  const openOutboundModal = (item: RackItem) => {
    setOutboundItem(item)
    setOutboundQty('')
    setOutboundMessage(null)
  }

  // 출고 처리
  const handleOutbound = async () => {
    if (!outboundItem || !outboundQty) return

    const qty = parseInt(outboundQty)
    if (qty <= 0 || qty > outboundItem.nowQty) {
      setOutboundMessage({ type: 'error', text: '유효한 수량을 입력하세요' })
      return
    }

    setOutboundLoading(true)
    try {
      const res = await fetch('/api/transaction/out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rackId: outboundItem.id,
          qty,
          user: user?.name || '익명',
        }),
      })
      const data = await res.json()
      if (data.success) {
        setOutboundMessage({ type: 'success', text: data.message })
        // 목록 업데이트
        setItems(prev => prev.map(item =>
          item.id === outboundItem.id
            ? { ...item, nowQty: item.nowQty - qty }
            : item
        ).filter(item => item.nowQty > 0))
        setTimeout(() => setOutboundItem(null), 1500)
      } else {
        setOutboundMessage({ type: 'error', text: data.message })
      }
    } catch {
      setOutboundMessage({ type: 'error', text: '출고 처리 중 오류가 발생했습니다' })
    } finally {
      setOutboundLoading(false)
    }
  }

  // 수정 모달 품목 선택 핸들러
  const handleEditSelectSuggestion = (suggestion: AutocompleteItem) => {
    setEditForm(prev => ({
      ...prev,
      itemCode: suggestion.itemCode,
      itemName: suggestion.itemName,
    }))
    setShowEditSuggestions(false)
    setEditSuggestions([])
    setEditItemCodeChanged(false) // 선택 후 자동완성 다시 안 뜨게
  }

  // 수정 모달 품목코드 키보드 핸들러
  const handleEditItemCodeKeyDown = (e: React.KeyboardEvent) => {
    if (!showEditSuggestions || editSuggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setEditSelectedIndex(prev => (prev < editSuggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setEditSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (editSelectedIndex >= 0 && editSelectedIndex < editSuggestions.length) {
        handleEditSelectSuggestion(editSuggestions[editSelectedIndex])
      }
    } else if (e.key === 'Escape') {
      setShowEditSuggestions(false)
    }
  }

  // 수정 모달 열기
  const openEditModal = (item: RackItem) => {
    setEditItem(item)
    setEditForm({
      itemCode: item.itemCode,
      itemName: item.itemName,
      nowQty: item.nowQty.toString(),
      inDay: item.inDay ? new Date(item.inDay).toISOString().split('T')[0] : '',
      remark: item.remark || '',
    })
    setEditMessage(null)
    setEditSuggestions([])
    setShowEditSuggestions(false)
    setEditSelectedIndex(-1)
    setEditItemCodeChanged(false) // 모달 열 때 초기화
  }

  // 이동 모달 열기
  const openMoveModal = (item: RackItem) => {
    setMoveItem(item)
    setMoveForm({
      toStorage: item.storage,
      toLocation: '',
      qty: item.nowQty.toString(),
    })
    setMoveMessage(null)
    setMoveLocationSuggestions([])
    setShowMoveLocationSuggestions(false)
    setMoveLocationSelectedIndex(-1)
    setMoveExpandedHint(null)
  }

  // 수불 내역 모달 열기
  const openHistoryModal = async (itemCode: string, itemName: string) => {
    setHistoryItem({ itemCode, itemName })
    setHistoryData([])
    setHistoryLoading(true)
    setHistoryFilter('전체')
    setHistoryDateFrom(undefined)
    setHistoryDateTo(undefined)

    try {
      const res = await fetch(`/api/transaction/history?itemCode=${encodeURIComponent(itemCode)}&limit=100`)
      const data = await res.json()
      if (data.success) {
        setHistoryData(data.items)
      }
    } catch (error) {
      console.error('History fetch error:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  // 수불 내역 필터링
  const filteredHistoryData = historyData.filter((h) => {
    // 카테고리 필터
    if (historyFilter !== '전체') {
      if (historyFilter === '이동' && !h.category.includes('이동')) return false
      if (historyFilter !== '이동' && h.category !== historyFilter) return false
    }
    // 날짜 필터
    const itemDate = new Date(h.subulTime)
    if (historyDateFrom) {
      const fromDate = new Date(historyDateFrom)
      fromDate.setHours(0, 0, 0, 0)
      if (itemDate < fromDate) return false
    }
    if (historyDateTo) {
      const toDate = new Date(historyDateTo)
      toDate.setHours(23, 59, 59, 999)
      if (itemDate > toDate) return false
    }
    return true
  })

  // 이동 모달 위치 선택 핸들러
  const handleMoveSelectLocation = (suggestion: LocationSuggestion) => {
    setMoveForm(prev => ({
      ...prev,
      toStorage: suggestion.storage,
      toLocation: suggestion.location,
    }))
    setShowMoveLocationSuggestions(false)
    setMoveLocationSuggestions([])
    setMoveExpandedHint(null)
  }

  // 이동 모달 위치 키보드 핸들러
  const handleMoveLocationKeyDown = (e: React.KeyboardEvent) => {
    if (!showMoveLocationSuggestions || moveLocationSuggestions.length === 0) {
      if (e.key === 'Enter' && isShortLocation(moveForm.toLocation)) {
        e.preventDefault()
        const expanded = expandLocation(moveForm.toLocation)
        setMoveForm(prev => ({ ...prev, toLocation: expanded }))
        setMoveExpandedHint(null)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMoveLocationSelectedIndex(prev => (prev < moveLocationSuggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMoveLocationSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (moveLocationSelectedIndex >= 0 && moveLocationSelectedIndex < moveLocationSuggestions.length) {
        handleMoveSelectLocation(moveLocationSuggestions[moveLocationSelectedIndex])
      } else if (isShortLocation(moveForm.toLocation)) {
        const expanded = expandLocation(moveForm.toLocation)
        setMoveForm(prev => ({ ...prev, toLocation: expanded }))
        setMoveExpandedHint(null)
        setShowMoveLocationSuggestions(false)
      }
    } else if (e.key === 'Escape') {
      setShowMoveLocationSuggestions(false)
    }
  }

  // 이동 처리
  const handleMove = async () => {
    if (!moveItem || !moveForm.toLocation || !moveForm.qty) return

    const qty = parseInt(moveForm.qty)
    if (qty <= 0 || qty > moveItem.nowQty) {
      setMoveMessage({ type: 'error', text: '유효한 수량을 입력하세요' })
      return
    }

    // 단축 입력 확장
    const finalLocation = isShortLocation(moveForm.toLocation)
      ? expandLocation(moveForm.toLocation)
      : moveForm.toLocation

    const moveData = {
      rackId: moveItem.id,
      toStorage: moveForm.toStorage,
      toLocation: finalLocation,
      qty,
      user: user?.name || '익명',
    }

    setMoveLoading(true)
    try {
      const res = await fetch('/api/transaction/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moveData),
      })
      const data = await res.json()
      if (data.success) {
        setMoveMessage({ type: 'success', text: data.message })
        // 목록 업데이트
        setItems(prev => prev.map(item =>
          item.id === moveItem.id
            ? { ...item, nowQty: item.nowQty - qty }
            : item
        ).filter(item => item.nowQty > 0))
        setTimeout(() => setMoveItem(null), 1500)
      } else if (data.canMerge) {
        // 병합 가능한 경우 모달 표시 (Dialog를 먼저 닫음)
        setMoveItem(null)
        setMoveMergeInfo({
          existingItem: data.existingItem,
          moveQty: data.moveQty,
          mergedQty: data.mergedQty,
        })
        setPendingMoveData(moveData)
        setShowMoveMergeModal(true)
      } else {
        setMoveMessage({ type: 'error', text: data.message })
      }
    } catch {
      setMoveMessage({ type: 'error', text: '이동 처리 중 오류가 발생했습니다' })
    } finally {
      setMoveLoading(false)
    }
  }

  // 이동 병합 확인 처리
  const handleMoveMergeConfirm = async () => {
    if (!pendingMoveData) return

    setMoveMergeLoading(true)
    try {
      const res = await fetch('/api/transaction/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pendingMoveData,
          merge: true,
        }),
      })
      const data = await res.json()
      if (data.success) {
        // 목록 업데이트
        setItems(prev => prev.map(item =>
          item.id === pendingMoveData.rackId
            ? { ...item, nowQty: item.nowQty - pendingMoveData.qty }
            : item
        ).filter(item => item.nowQty > 0))
        // 성공 메시지 표시 (토스트 형태로)
        setToastMessage({ type: 'success', text: data.message })
        setTimeout(() => setToastMessage(null), 3000)
      } else {
        setToastMessage({ type: 'error', text: data.message })
        setTimeout(() => setToastMessage(null), 3000)
      }
    } catch {
      setToastMessage({ type: 'error', text: '병합 처리 중 오류가 발생했습니다' })
      setTimeout(() => setToastMessage(null), 3000)
    } finally {
      setMoveMergeLoading(false)
      setShowMoveMergeModal(false)
      setMoveMergeInfo(null)
      setPendingMoveData(null)
    }
  }

  // 이동 병합 취소
  const handleMoveMergeCancel = () => {
    setShowMoveMergeModal(false)
    setMoveMergeInfo(null)
    setPendingMoveData(null)
  }

  // 수정 처리
  const handleEdit = async () => {
    if (!editItem) return

    setEditLoading(true)
    try {
      const res = await fetch('/api/rack/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editItem.id,
          itemCode: editForm.itemCode,
          itemName: editForm.itemName,
          nowQty: parseInt(editForm.nowQty),
          inDay: editForm.inDay || null,
          remark: editForm.remark || null,
          user: user?.name || '익명',
        }),
      })
      const data = await res.json()
      if (data.success) {
        setEditMessage({ type: 'success', text: data.message })
        // 목록 업데이트
        setItems(prev => prev.map(item =>
          item.id === editItem.id
            ? {
                ...item,
                itemCode: editForm.itemCode,
                itemName: editForm.itemName,
                nowQty: parseInt(editForm.nowQty),
                inDay: editForm.inDay || null,
                remark: editForm.remark || null,
              }
            : item
        ))
        setTimeout(() => setEditItem(null), 1500)
      } else {
        setEditMessage({ type: 'error', text: data.message })
      }
    } catch {
      setEditMessage({ type: 'error', text: '수정 중 오류가 발생했습니다' })
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <div className="p-4 pb-8">
      {/* 토스트 메시지 */}
      {toastMessage && (
        <div
          className={`fixed top-4 left-4 right-4 z-[300] p-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 shrink-0" />
          )}
          <span className="text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}

      {/* Search Section */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground mb-1">재고 검색</h2>

        {/* 탭바 */}
        <div className="flex bg-muted rounded-xl p-1 mb-4">
          <button
            onClick={() => handleTabChange('item')}
            className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'item'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            품목 검색
          </button>
          <button
            onClick={() => handleTabChange('rack')}
            className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'rack'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            랙 검색
          </button>
        </div>

        {/* 품목 검색 입력 */}
        {activeTab === 'item' && (
          <div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="품목코드 또는 품목명 입력"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedIndex(-1)
                  setHasSearched(false)
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className="pl-12 pr-24 h-14 text-base rounded-2xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <Button
                onClick={() => handleSearch()}
                disabled={loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 z-10"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '검색'}
              </Button>

              {/* 품목 자동완성 드롭다운 */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-popover rounded-xl shadow-lg border border-border overflow-hidden z-50"
                >
                  {suggestions.map((item, index) => (
                    <div
                      key={item.itemCode}
                      onClick={() => handleSelectSuggestion(item)}
                      className={`px-4 py-3 cursor-pointer border-b border-border last:border-b-0 ${
                        index === selectedIndex ? 'bg-accent' : 'hover:bg-muted'
                      }`}
                    >
                      <span className="text-primary text-sm font-semibold">{item.itemCode}</span>
                      <p className="text-foreground text-sm mt-0.5">{item.itemName}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 품목 최근 검색 기록 */}
            {!showSuggestions && !hasSearched && itemSearchHistory.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  최근 검색
                </p>
                <div className="flex flex-wrap gap-2">
                  {itemSearchHistory.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setQuery(item)
                        handleItemSearch(item)
                      }}
                      className="px-3 py-1.5 text-sm bg-muted hover:bg-accent rounded-lg text-foreground transition-colors"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 랙 검색 입력 */}
        {activeTab === 'rack' && (
          <div>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
              <Input
                ref={locationInputRef}
                type="text"
                placeholder="A11 또는 A-01-01"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setLocationSelectedIndex(-1)
                  setHasSearched(false)
                }}
                onKeyDown={handleRackKeyDown}
                onFocus={() => locationSuggestions.length > 0 && setShowLocationSuggestions(true)}
                className="pl-12 pr-24 h-14 text-base rounded-2xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <Button
                onClick={() => handleSearch()}
                disabled={loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 z-10"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '검색'}
              </Button>

              {/* 단축 입력 힌트 */}
              {expandedHint && !showLocationSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 px-3 py-2 bg-accent text-accent-foreground text-sm rounded-lg border border-border">
                  → {expandedHint} 로 검색됩니다
                </div>
              )}

              {/* 랙 위치 자동완성 드롭다운 */}
              {showLocationSuggestions && locationSuggestions.length > 0 && (
                <div
                  ref={locationSuggestionsRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-popover rounded-xl shadow-lg border border-border overflow-hidden z-50"
                >
                  {locationSuggestions.map((suggestion, index) => (
                    <div
                      key={`${suggestion.storage}-${suggestion.location}`}
                      onClick={() => handleSelectLocationSuggestion(suggestion)}
                      className={`px-4 py-3 cursor-pointer border-b border-border last:border-b-0 flex items-center justify-between ${
                        index === locationSelectedIndex ? 'bg-accent' : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="font-medium text-foreground">{suggestion.location}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Warehouse className="w-3 h-3" />
                        <span>{suggestion.storage}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 랙 최근 검색 기록 */}
            {!showLocationSuggestions && !expandedHint && !hasSearched && rackSearchHistory.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  최근 검색
                </p>
                <div className="flex flex-wrap gap-2">
                  {rackSearchHistory.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setQuery(item)
                        handleRackSearch(item)
                      }}
                      className="px-3 py-1.5 text-sm bg-muted hover:bg-accent rounded-lg text-foreground transition-colors"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 랙 검색 안내 */}
        {activeTab === 'rack' && !searched && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            단축입력: A11 → A-01-01 | QR 스캔 앱에서 자동으로 열립니다
          </p>
        )}
      </div>

      {/* Search Results */}
      {searched && (
        <>
          {/* Summary */}
          {items.length > 0 && (
            <div className="mb-4 p-3 bg-gradient-to-r from-violet-500 to-violet-600 rounded-xl shadow-sm">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  <span className="text-sm">검색 결과</span>
                </div>
                <div className="text-right">
                  <span className="text-sm text-violet-200">{items.length}개 위치</span>
                  <span className="mx-2 text-violet-300">|</span>
                  <span className="font-bold">총 {formatNumber(totalQty)}개</span>
                </div>
              </div>
            </div>
          )}

          {/* Location Badge for Rack Search */}
          {activeTab === 'rack' && searchedLocation && (
            <div className="mb-4 p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 text-white">
                <MapPin className="w-4 h-4" />
                <span className="font-medium">{searchedLocation.location}</span>
                <span className="text-blue-200 text-sm">{searchedLocation.storage}</span>
              </div>
            </div>
          )}

          {/* Empty State */}
          {items.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                {activeTab === 'item' ? (
                  <PackageSearch className="w-8 h-8 text-muted-foreground" />
                ) : (
                  <PackageX className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <p className="text-muted-foreground font-medium">검색 결과가 없습니다</p>
              <p className="text-muted-foreground/70 text-sm mt-1">
                {activeTab === 'item'
                  ? '다른 품목코드나 품목명을 검색해 보세요'
                  : '다른 위치를 검색해 보세요'}
              </p>
            </div>
          )}

          {/* Results List */}
          <div className="space-y-2">
            {items.map((item) => (
              <Card key={item.id} className="border-0 shadow-sm overflow-hidden bg-card">
                <CardContent className="p-0">
                  <div className="px-3 py-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-bold text-primary text-base cursor-pointer hover:underline"
                          onClick={() => openHistoryModal(item.itemCode, item.itemName)}
                        >
                          {item.itemCode}
                        </p>
                        <p className="text-muted-foreground text-xs truncate">{item.itemName}</p>

                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {item.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Warehouse className="w-3 h-3" />
                            {item.storage}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            {formatDate(item.inDay)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right ml-3 shrink-0">
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <Package className="w-4 h-4 text-primary" />
                          <span className="text-lg font-bold text-primary">{formatNumber(item.nowQty)}</span>
                          <span className="text-xs text-muted-foreground">개</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Action Buttons */}
                  <div className="flex border-t border-border">
                    <button
                      onClick={() => openOutboundModal(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-accent transition-colors"
                    >
                      <ArrowUpFromLine className="w-4 h-4" />
                      출고
                    </button>
                    <div className="w-px bg-border" />
                    <button
                      onClick={() => openMoveModal(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:bg-accent transition-colors"
                    >
                      <MoveRight className="w-4 h-4" />
                      이동
                    </button>
                    <div className="w-px bg-border" />
                    <button
                      onClick={() => openEditModal(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      수정
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 이 위치에 자재 입고 버튼 (랙 검색) */}
          {activeTab === 'rack' && (searchedLocation || currentSearchQuery) && (
            <div className="mt-4">
              <Button
                onClick={handleGoToInbound}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
              >
                <PackagePlus className="w-5 h-5 mr-2" />
                이 위치에 자재 입고
              </Button>
            </div>
          )}
        </>
      )}

      {/* Initial State - Show hint */}
      {!searched && activeTab === 'item' && (
        <div className="text-center py-8">
          <div className="bg-accent w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-10 h-10 text-accent-foreground" />
          </div>
          <p className="text-foreground font-medium">품목을 검색해 보세요</p>
          <p className="text-muted-foreground text-sm mt-1">품목코드 또는 품목명 일부를 입력하세요</p>
        </div>
      )}

      {/* 출고 모달 */}
      <Dialog open={!!outboundItem} onOpenChange={(open) => !open && setOutboundItem(null)}>
        <DialogContent className="rounded-2xl max-w-sm bg-popover">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">출고</DialogTitle>
          </DialogHeader>
          {outboundItem && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-3">
                <p className="text-sm text-muted-foreground">품목</p>
                <p className="font-medium text-foreground">{outboundItem.itemName}</p>
                <p className="text-xs text-muted-foreground mt-1">{outboundItem.itemCode} · {outboundItem.location}</p>
              </div>
              <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/30 rounded-xl p-3">
                <span className="text-sm text-orange-700 dark:text-orange-300">현재 재고</span>
                <span className="font-bold text-orange-600 dark:text-orange-400">{formatNumber(outboundItem.nowQty)}개</span>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">출고 수량</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={outboundQty}
                  onChange={(e) => setOutboundQty(e.target.value)}
                  placeholder="출고할 수량 입력"
                  min="1"
                  max={outboundItem.nowQty}
                  className="h-12 text-lg text-center rounded-xl"
                  autoFocus
                />
              </div>
              {outboundMessage && (
                <div
                  className={`p-3 rounded-xl text-sm flex items-center gap-2 border ${
                    outboundMessage.type === 'success'
                      ? 'bg-secondary text-secondary-foreground border-border'
                      : 'bg-destructive/10 text-destructive border-destructive/20'
                  }`}
                >
                  {outboundMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0" />
                  )}
                  {outboundMessage.text}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setOutboundItem(null)}
              className="flex-1 h-12 rounded-xl"
            >
              취소
            </Button>
            <Button
              onClick={handleOutbound}
              disabled={outboundLoading || !outboundQty}
              className="flex-1 h-12 rounded-xl bg-orange-600 hover:bg-orange-700"
            >
              {outboundLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  처리 중...
                </>
              ) : '출고 처리'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 수정 모달 */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="rounded-2xl max-w-sm max-h-[90vh] overflow-y-auto bg-popover">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">재고 수정</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-3">
                <p className="text-sm text-muted-foreground">위치</p>
                <p className="font-medium text-foreground">{editItem.location}</p>
                <p className="text-xs text-muted-foreground mt-1">{editItem.storage}</p>
              </div>
              <div className="relative">
                <label className="text-sm font-medium text-foreground mb-1.5 block">품목코드</label>
                <Input
                  ref={editItemCodeRef}
                  value={editForm.itemCode}
                  onChange={(e) => {
                    setEditForm(prev => ({ ...prev, itemCode: e.target.value }))
                    setEditSelectedIndex(-1)
                    setEditItemCodeChanged(true) // 사용자가 직접 입력함
                  }}
                  onKeyDown={handleEditItemCodeKeyDown}
                  onFocus={() => editItemCodeChanged && editSuggestions.length > 0 && setShowEditSuggestions(true)}
                  className="h-11 rounded-lg"
                />
                {/* 수정 모달 품목코드 자동완성 */}
                {showEditSuggestions && editSuggestions.length > 0 && (
                  <div
                    ref={editSuggestionsRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-popover rounded-xl shadow-lg border border-border overflow-hidden z-[100] max-h-48 overflow-y-auto"
                  >
                    {editSuggestions.map((item, index) => (
                      <div
                        key={item.itemCode}
                        onClick={() => handleEditSelectSuggestion(item)}
                        className={`px-3 py-2 cursor-pointer border-b border-border last:border-b-0 ${
                          index === editSelectedIndex ? 'bg-accent' : 'hover:bg-muted'
                        }`}
                      >
                        <span className="text-primary text-sm font-semibold">{item.itemCode}</span>
                        <p className="text-foreground text-xs mt-0.5 truncate">{item.itemName}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">품목명</label>
                <Input
                  value={editForm.itemName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, itemName: e.target.value }))}
                  className="h-11 rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">수량</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={editForm.nowQty}
                  onChange={(e) => setEditForm(prev => ({ ...prev, nowQty: e.target.value }))}
                  min="0"
                  className="h-11 rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">입고일</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-11 rounded-lg justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editForm.inDay ? (
                        format(new Date(editForm.inDay), 'yyyy년 M월 d일', { locale: ko })
                      ) : (
                        <span className="text-muted-foreground">날짜 선택</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editForm.inDay ? new Date(editForm.inDay) : undefined}
                      onSelect={(date) => {
                        setEditForm(prev => ({
                          ...prev,
                          inDay: date ? format(date, 'yyyy-MM-dd') : ''
                        }))
                      }}
                      locale={ko}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">비고</label>
                <Input
                  value={editForm.remark}
                  onChange={(e) => setEditForm(prev => ({ ...prev, remark: e.target.value }))}
                  placeholder="비고 (선택)"
                  className="h-11 rounded-lg"
                />
              </div>
              {editMessage && (
                <div
                  className={`p-3 rounded-xl text-sm flex items-center gap-2 border ${
                    editMessage.type === 'success'
                      ? 'bg-secondary text-secondary-foreground border-border'
                      : 'bg-destructive/10 text-destructive border-destructive/20'
                  }`}
                >
                  {editMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0" />
                  )}
                  {editMessage.text}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setEditItem(null)}
              className="flex-1 h-12 rounded-xl"
            >
              취소
            </Button>
            <Button
              onClick={handleEdit}
              disabled={editLoading}
              className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700"
            >
              {editLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  처리 중...
                </>
              ) : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 이동 모달 */}
      <Dialog open={!!moveItem} onOpenChange={(open) => !open && setMoveItem(null)}>
        <DialogContent className="rounded-2xl max-w-sm max-h-[90vh] overflow-y-auto bg-popover">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">재고 이동</DialogTitle>
          </DialogHeader>
          {moveItem && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-3">
                <p className="text-sm text-muted-foreground">품목</p>
                <p className="font-medium text-foreground">{moveItem.itemName}</p>
                <p className="text-xs text-muted-foreground mt-1">{moveItem.itemCode}</p>
              </div>
              <div className="bg-teal-50 dark:bg-teal-900/30 rounded-xl p-3">
                <p className="text-sm text-teal-700 dark:text-teal-300">현재 위치</p>
                <p className="font-bold text-teal-600 dark:text-teal-400">{moveItem.location}</p>
                <p className="text-xs text-teal-500 dark:text-teal-400 mt-0.5">{moveItem.storage} · {formatNumber(moveItem.nowQty)}개</p>
              </div>

              {/* 목적지 창고 */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">목적지 창고</label>
                <div className="relative">
                  <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <select
                    value={moveForm.toStorage}
                    onChange={(e) => setMoveForm(prev => ({ ...prev, toStorage: e.target.value }))}
                    className="w-full pl-10 pr-10 h-11 rounded-lg border border-input bg-background text-foreground text-base appearance-none focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.name}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* 목적지 위치 */}
              <div className="relative">
                <label className="text-sm font-medium text-foreground mb-1.5 block">목적지 위치</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                  <Input
                    ref={moveLocationInputRef}
                    value={moveForm.toLocation}
                    onChange={(e) => {
                      setMoveForm(prev => ({ ...prev, toLocation: e.target.value }))
                      setMoveLocationSelectedIndex(-1)
                    }}
                    onKeyDown={handleMoveLocationKeyDown}
                    onFocus={() => moveLocationSuggestions.length > 0 && setShowMoveLocationSuggestions(true)}
                    placeholder="위치 (예: A11 또는 A-01-01)"
                    className="pl-10 h-11 rounded-lg"
                    autoFocus
                  />
                </div>

                {/* 단축 입력 힌트 */}
                {moveExpandedHint && !showMoveLocationSuggestions && (
                  <div className="absolute top-full left-0 right-0 mt-1 px-3 py-2 bg-accent text-accent-foreground border border-border rounded-lg text-sm z-50">
                    → {moveExpandedHint}
                  </div>
                )}

                {/* 위치 자동완성 드롭다운 */}
                {showMoveLocationSuggestions && moveLocationSuggestions.length > 0 && (
                  <div
                    ref={moveLocationSuggestionsRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-popover rounded-lg shadow-lg border border-border overflow-hidden z-[100] max-h-48 overflow-y-auto"
                  >
                    {moveLocationSuggestions.map((suggestion, index) => (
                      <div
                        key={`${suggestion.storage}-${suggestion.location}`}
                        onClick={() => handleMoveSelectLocation(suggestion)}
                        className={`px-3 py-2 cursor-pointer border-b border-border last:border-b-0 ${
                          index === moveLocationSelectedIndex ? 'bg-accent' : 'hover:bg-muted'
                        }`}
                      >
                        <span className="text-primary text-sm font-semibold">{suggestion.location}</span>
                        <span className="text-muted-foreground text-xs ml-2">({suggestion.storage})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 이동 수량 */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">이동 수량</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={moveForm.qty}
                  onChange={(e) => setMoveForm(prev => ({ ...prev, qty: e.target.value }))}
                  placeholder="이동할 수량"
                  min="1"
                  max={moveItem.nowQty}
                  className="h-11 text-center rounded-lg"
                />
              </div>

              {moveMessage && (
                <div
                  className={`p-3 rounded-xl text-sm flex items-center gap-2 border ${
                    moveMessage.type === 'success'
                      ? 'bg-secondary text-secondary-foreground border-border'
                      : 'bg-destructive/10 text-destructive border-destructive/20'
                  }`}
                >
                  {moveMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0" />
                  )}
                  {moveMessage.text}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setMoveItem(null)}
              className="flex-1 h-12 rounded-xl"
            >
              취소
            </Button>
            <Button
              onClick={handleMove}
              disabled={moveLoading || !moveForm.toLocation || !moveForm.qty}
              className="flex-1 h-12 rounded-xl bg-teal-600 hover:bg-teal-700"
            >
              {moveLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  처리 중...
                </>
              ) : '이동 처리'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 이동 병합 확인 모달 */}
      <AlertDialog open={showMoveMergeModal} onOpenChange={(open) => !open && handleMoveMergeCancel()}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <AlertDialogTitle className="text-lg font-bold">수량 병합 확인</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left pt-2">
              이동 위치에 동일한 품목이 이미 존재합니다.<br />
              수량을 병합하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {moveMergeInfo && (
            <div className="bg-muted rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">품목명</span>
                <span className="font-medium text-foreground">{moveMergeInfo.existingItem.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">기존 수량</span>
                <span className="font-medium text-foreground">{moveMergeInfo.existingItem.currentQty}개</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">이동 수량</span>
                <span className="font-medium text-teal-600">+{moveMergeInfo.moveQty}개</span>
              </div>
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-medium text-foreground">병합 후 수량</span>
                  <span className="font-bold text-primary">{moveMergeInfo.mergedQty}개</span>
                </div>
              </div>
            </div>
          )}

          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel
              onClick={handleMoveMergeCancel}
              disabled={moveMergeLoading}
              className="flex-1 h-11 rounded-xl"
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMoveMergeConfirm}
              disabled={moveMergeLoading}
              className="flex-1 h-11 rounded-xl bg-teal-600 hover:bg-teal-700"
            >
              {moveMergeLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  처리 중...
                </span>
              ) : (
                '병합'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 수불 내역 모달 */}
      <Dialog open={!!historyItem} onOpenChange={(open) => !open && setHistoryItem(null)}>
        <DialogContent className="rounded-2xl max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">수불 내역</DialogTitle>
            {historyItem && (
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-primary">{historyItem.itemCode}</span>
                <span className="ml-2 truncate">{historyItem.itemName}</span>
              </div>
            )}
          </DialogHeader>

          {/* 필터 영역 */}
          <div className="space-y-2 pb-2 border-b border-border">
            {/* 카테고리 필터 */}
            <div className="flex flex-wrap gap-1">
              {['전체', '입고', '출고', '이동', '수정'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setHistoryFilter(cat)}
                  className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                    historyFilter === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-accent text-muted-foreground hover:bg-accent/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {/* 날짜 필터 */}
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs flex-1">
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    {historyDateFrom ? format(historyDateFrom, 'yy.MM.dd') : '시작일'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={historyDateFrom}
                    onSelect={setHistoryDateFrom}
                    locale={ko}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-xs">~</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs flex-1">
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    {historyDateTo ? format(historyDateTo, 'yy.MM.dd') : '종료일'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={historyDateTo}
                    onSelect={setHistoryDateTo}
                    locale={ko}
                  />
                </PopoverContent>
              </Popover>
              {(historyDateFrom || historyDateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => {
                    setHistoryDateFrom(undefined)
                    setHistoryDateTo(undefined)
                  }}
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredHistoryData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {historyData.length === 0 ? '수불 내역이 없습니다.' : '조건에 맞는 내역이 없습니다.'}
              </div>
            ) : (
              <div className="space-y-2 py-2">
                <div className="text-xs text-muted-foreground mb-2">
                  {filteredHistoryData.length}건
                </div>
                {filteredHistoryData.map((h) => (
                  <div key={h.id} className="p-3 bg-accent/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${
                        h.category === '입고' ? 'text-green-600' :
                        h.category === '출고' ? 'text-red-600' :
                        h.category.includes('이동') ? 'text-blue-600' :
                        h.category === '수정' ? 'text-orange-600' :
                        'text-foreground'
                      }`}>
                        {h.category}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.subulTime).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">
                        {h.storage} · {h.location}
                      </span>
                      <span className="text-sm font-bold">
                        {h.category === '출고' ? '-' : h.category === '입고' ? '+' : ''}{h.qty}개
                      </span>
                    </div>
                    {h.user && (
                      <div className="text-xs text-muted-foreground mt-1">
                        작업자: {h.user}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHistoryItem(null)}
              className="w-full"
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Suspense로 감싸서 useSearchParams 사용 가능하게
export default function Home() {
  return (
    <Suspense fallback={<div className="p-4 text-center">로딩 중...</div>}>
      <HomeContent />
    </Suspense>
  )
}
