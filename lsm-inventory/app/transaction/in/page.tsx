'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Warehouse, MapPin, Package, Hash, FileText, Loader2, CheckCircle2, XCircle, ChevronDown, History, AlertTriangle } from 'lucide-react'
import { useWarehouses } from '@/lib/warehouse-context'
import { useAuth } from '@/lib/auth-context'
import { expandLocation, isShortLocation } from '@/lib/location-utils'

interface AutocompleteItem {
  itemCode: string
  itemName: string
}

interface LocationSuggestion {
  location: string
  storage: string
}

interface MergeInfo {
  existingItem: {
    id: number
    currentQty: number
    itemName: string
  }
  newQty: number
  mergedQty: number
}

function TransactionInContent() {
  const searchParams = useSearchParams()
  const { warehouses } = useWarehouses()
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    storage: '',
    location: '',
    itemCode: '',
    itemName: '',
    qty: '',
    remark: '',
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [prefilledLocation, setPrefilledLocation] = useState<string | null>(null)

  // 병합 확인 모달 상태
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [mergeInfo, setMergeInfo] = useState<MergeInfo | null>(null)
  const [mergeLoading, setMergeLoading] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<{
    storage: string
    location: string
    itemCode: string
    itemName: string
    qty: number
    remark: string
    user: string
  } | null>(null)

  // 품목코드 자동완성 관련 상태
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const itemCodeRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // 위치 자동완성 관련 상태
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([])
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const [locationSelectedIndex, setLocationSelectedIndex] = useState(-1)
  const [expandedLocationHint, setExpandedLocationHint] = useState<string | null>(null)
  const locationInputRef = useRef<HTMLInputElement>(null)
  const locationSuggestionsRef = useRef<HTMLDivElement>(null)

  // 최근 입력 기록 관련 상태
  const [recentLocations, setRecentLocations] = useState<LocationSuggestion[]>([])
  const [recentItems, setRecentItems] = useState<AutocompleteItem[]>([])
  const [showRecentLocations, setShowRecentLocations] = useState(false)
  const [showRecentItems, setShowRecentItems] = useState(false)
  const recentLocationsRef = useRef<HTMLDivElement>(null)
  const recentItemsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 최근 입력 기록 로드
    const fetchRecentHistory = async () => {
      try {
        const res = await fetch('/api/transaction/recent')
        const data = await res.json()
        if (data.success) {
          setRecentLocations(data.locations)
          setRecentItems(data.items)
        }
      } catch (error) {
        console.error('Recent history error:', error)
      }
    }
    fetchRecentHistory()

    // URL 파라미터에서 위치와 창고 정보 가져오기
    const locationParam = searchParams.get('location')
    const storageParam = searchParams.get('storage')

    if (locationParam || storageParam) {
      setFormData(prev => ({
        ...prev,
        location: locationParam || '',
        storage: storageParam || '',
      }))
      if (locationParam) {
        setPrefilledLocation(locationParam)
      }
    }
  }, [searchParams])

  // 위치 자동완성 검색
  useEffect(() => {
    const fetchLocationSuggestions = async () => {
      const location = formData.location.trim()
      if (!location || location.length < 1) {
        setLocationSuggestions([])
        setExpandedLocationHint(null)
        return
      }

      // 단축 입력인 경우 확장된 위치 힌트 표시
      if (isShortLocation(location)) {
        const expanded = expandLocation(location)
        setExpandedLocationHint(expanded)
      } else {
        setExpandedLocationHint(null)
      }

      try {
        // 단축 입력을 확장해서 검색
        const searchLocation = isShortLocation(location) ? expandLocation(location) : location
        const res = await fetch(`/api/rack/autocomplete?q=${encodeURIComponent(searchLocation)}`)
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
  }, [formData.location])

  // 품목코드 자동완성 검색
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!formData.itemCode.trim() || formData.itemCode.length < 1) {
        setSuggestions([])
        return
      }

      try {
        const res = await fetch(`/api/item/autocomplete?q=${encodeURIComponent(formData.itemCode)}`)
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
  }, [formData.itemCode])

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // 품목코드 자동완성 닫기
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        itemCodeRef.current &&
        !itemCodeRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
      // 위치 자동완성 닫기
      if (
        locationSuggestionsRef.current &&
        !locationSuggestionsRef.current.contains(e.target as Node) &&
        locationInputRef.current &&
        !locationInputRef.current.contains(e.target as Node)
      ) {
        setShowLocationSuggestions(false)
      }
      // 최근 위치 드롭다운 닫기
      if (
        recentLocationsRef.current &&
        !recentLocationsRef.current.contains(e.target as Node)
      ) {
        setShowRecentLocations(false)
      }
      // 최근 품목 드롭다운 닫기
      if (
        recentItemsRef.current &&
        !recentItemsRef.current.contains(e.target as Node)
      ) {
        setShowRecentItems(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (name === 'itemCode') {
      setSelectedIndex(-1)
    }
    if (name === 'location') {
      setLocationSelectedIndex(-1)
    }
  }

  // 위치 자동완성 선택
  const handleSelectLocation = (suggestion: LocationSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      location: suggestion.location,
      storage: suggestion.storage,
    }))
    setShowLocationSuggestions(false)
    setLocationSuggestions([])
    setExpandedLocationHint(null)
  }

  // 최근 위치 선택
  const handleSelectRecentLocation = (location: LocationSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      location: location.location,
      storage: location.storage,
    }))
    setShowRecentLocations(false)
  }

  // 최근 품목 선택
  const handleSelectRecentItem = (item: AutocompleteItem) => {
    setFormData((prev) => ({
      ...prev,
      itemCode: item.itemCode,
      itemName: item.itemName,
    }))
    setShowRecentItems(false)
  }

  // 위치 입력 키보드 핸들러
  const handleLocationKeyDown = (e: React.KeyboardEvent) => {
    if (!showLocationSuggestions || locationSuggestions.length === 0) {
      // Enter 키가 눌렸고 단축 입력인 경우 확장
      if (e.key === 'Enter' && isShortLocation(formData.location)) {
        e.preventDefault()
        const expanded = expandLocation(formData.location)
        setFormData((prev) => ({ ...prev, location: expanded }))
        setExpandedLocationHint(null)
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
      if (locationSelectedIndex >= 0 && locationSelectedIndex < locationSuggestions.length) {
        e.preventDefault()
        handleSelectLocation(locationSuggestions[locationSelectedIndex])
      } else if (isShortLocation(formData.location)) {
        // 선택된 항목이 없으면 단축 입력 확장
        e.preventDefault()
        const expanded = expandLocation(formData.location)
        setFormData((prev) => ({ ...prev, location: expanded }))
        setExpandedLocationHint(null)
        setShowLocationSuggestions(false)
      }
    } else if (e.key === 'Escape') {
      setShowLocationSuggestions(false)
    }
  }

  const handleSelectSuggestion = (item: AutocompleteItem) => {
    setFormData((prev) => ({
      ...prev,
      itemCode: item.itemCode,
      itemName: item.itemName,
    }))
    setShowSuggestions(false)
    setSuggestions([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault()
        handleSelectSuggestion(suggestions[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // 단축 입력을 확장
    const finalLocation = isShortLocation(formData.location)
      ? expandLocation(formData.location)
      : formData.location

    const submitData = {
      ...formData,
      location: finalLocation,
      qty: parseInt(formData.qty),
      user: user?.name || '익명',
    }

    try {
      const res = await fetch('/api/transaction/in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      })

      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: data.message })
        setFormData({
          storage: formData.storage,
          location: '',
          itemCode: '',
          itemName: '',
          qty: '',
          remark: '',
        })
      } else if (data.canMerge) {
        // 병합 가능한 경우 모달 표시
        setMergeInfo({
          existingItem: data.existingItem,
          newQty: data.newQty,
          mergedQty: data.mergedQty,
        })
        setPendingFormData(submitData)
        setShowMergeModal(true)
      } else {
        setMessage({ type: 'error', text: data.message })
      }
    } catch {
      setMessage({ type: 'error', text: '오류가 발생했습니다.' })
    } finally {
      setLoading(false)
    }
  }

  // 병합 확인 처리
  const handleMergeConfirm = async () => {
    if (!pendingFormData) return

    setMergeLoading(true)
    try {
      const res = await fetch('/api/transaction/in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pendingFormData,
          merge: true,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: data.message })
        setFormData({
          storage: formData.storage,
          location: '',
          itemCode: '',
          itemName: '',
          qty: '',
          remark: '',
        })
      } else {
        setMessage({ type: 'error', text: data.message })
      }
    } catch {
      setMessage({ type: 'error', text: '병합 처리 중 오류가 발생했습니다.' })
    } finally {
      setMergeLoading(false)
      setShowMergeModal(false)
      setMergeInfo(null)
      setPendingFormData(null)
    }
  }

  // 병합 취소
  const handleMergeCancel = () => {
    setShowMergeModal(false)
    setMergeInfo(null)
    setPendingFormData(null)
  }

  return (
    <div className="p-4">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-foreground">입고 처리</h2>
        <p className="text-sm text-muted-foreground">새로운 품목을 입고합니다</p>
      </div>

      {/* 랙 검색에서 온 경우 위치 표시 */}
      {prefilledLocation && (
        <div className="mb-4 p-3 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-white">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">선택된 위치:</span>
            <span className="font-bold">{prefilledLocation}</span>
          </div>
        </div>
      )}

      <Card className="border-0 shadow-sm bg-card">
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 창고 선택 드롭다운 */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                창고
                <span className="text-destructive ml-0.5">*</span>
              </label>
              <div className="relative">
                <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <select
                  name="storage"
                  value={formData.storage}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-10 h-11 rounded-lg border border-input bg-background text-foreground text-base appearance-none focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
                >
                  <option value="">창고 선택</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* 위치 - 자동완성 */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                위치
                <span className="text-destructive ml-0.5">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                <Input
                  ref={locationInputRef}
                  name="location"
                  type="text"
                  value={formData.location}
                  onChange={handleChange}
                  onKeyDown={handleLocationKeyDown}
                  onFocus={() => locationSuggestions.length > 0 && setShowLocationSuggestions(true)}
                  placeholder="위치 (예: A11 또는 A-01-01)"
                  required
                  autoComplete="off"
                  className="pl-10 h-11 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />

                {/* 단축 입력 힌트 */}
                {expandedLocationHint && !showLocationSuggestions && (
                  <div className="absolute top-full left-0 right-0 mt-1 px-3 py-2 bg-accent border border-border rounded-lg text-sm text-accent-foreground">
                    → {expandedLocationHint}
                  </div>
                )}

                {/* 위치 자동완성 드롭다운 */}
                {showLocationSuggestions && locationSuggestions.length > 0 && (
                  <div
                    ref={locationSuggestionsRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-popover rounded-lg shadow-lg border border-border overflow-hidden z-50 max-h-60 overflow-y-auto"
                  >
                    {locationSuggestions.map((item, index) => (
                      <div
                        key={`${item.storage}-${item.location}`}
                        onClick={() => handleSelectLocation(item)}
                        className={`px-4 py-3 cursor-pointer border-b border-border last:border-b-0 ${
                          index === locationSelectedIndex ? 'bg-accent' : 'hover:bg-muted'
                        }`}
                      >
                        <span className="text-primary text-sm font-semibold">{item.location}</span>
                        <span className="text-muted-foreground text-xs ml-2">({item.storage})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 최근 위치 버튼 */}
              {recentLocations.length > 0 && (
                <div className="relative mt-1.5" ref={recentLocationsRef}>
                  <button
                    type="button"
                    onClick={() => setShowRecentLocations(!showRecentLocations)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                    최근 입력 위치
                    <ChevronDown className={`w-3 h-3 transition-transform ${showRecentLocations ? 'rotate-180' : ''}`} />
                  </button>

                  {showRecentLocations && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover rounded-lg shadow-lg border border-border overflow-hidden z-50 max-h-48 overflow-y-auto">
                      {recentLocations.map((loc) => (
                        <div
                          key={`${loc.storage}-${loc.location}`}
                          onClick={() => handleSelectRecentLocation(loc)}
                          className="px-3 py-2.5 cursor-pointer border-b border-border last:border-b-0 hover:bg-accent"
                        >
                          <span className="text-primary text-sm font-semibold">{loc.location}</span>
                          <span className="text-muted-foreground text-xs ml-2">({loc.storage})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 품목코드 - 자동완성 */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                품목코드
                <span className="text-destructive ml-0.5">*</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                <Input
                  ref={itemCodeRef}
                  name="itemCode"
                  type="text"
                  value={formData.itemCode}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="품목코드 또는 품목명 입력"
                  required
                  autoComplete="off"
                  className="pl-10 h-11 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />

                {/* Autocomplete Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-popover rounded-lg shadow-lg border border-border overflow-hidden z-50 max-h-60 overflow-y-auto"
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

              {/* 최근 품목 버튼 */}
              {recentItems.length > 0 && (
                <div className="relative mt-1.5" ref={recentItemsRef}>
                  <button
                    type="button"
                    onClick={() => setShowRecentItems(!showRecentItems)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                    최근 입력 품목
                    <ChevronDown className={`w-3 h-3 transition-transform ${showRecentItems ? 'rotate-180' : ''}`} />
                  </button>

                  {showRecentItems && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover rounded-lg shadow-lg border border-border overflow-hidden z-50 max-h-48 overflow-y-auto">
                      {recentItems.map((item) => (
                        <div
                          key={item.itemCode}
                          onClick={() => handleSelectRecentItem(item)}
                          className="px-3 py-2.5 cursor-pointer border-b border-border last:border-b-0 hover:bg-accent"
                        >
                          <span className="text-primary text-sm font-semibold">{item.itemCode}</span>
                          <p className="text-muted-foreground text-xs mt-0.5 truncate">{item.itemName}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 품목명 */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                품목명
                <span className="text-destructive ml-0.5">*</span>
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  name="itemName"
                  type="text"
                  value={formData.itemName}
                  onChange={handleChange}
                  placeholder="품목명"
                  required
                  className="pl-10 h-11 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 수량 */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                수량
                <span className="text-destructive ml-0.5">*</span>
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  name="qty"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.qty}
                  onChange={handleChange}
                  placeholder="입고 수량"
                  required
                  min="1"
                  className="pl-10 h-11 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 비고 */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                비고
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  name="remark"
                  type="text"
                  value={formData.remark}
                  onChange={handleChange}
                  placeholder="비고 (선택)"
                  className="pl-10 h-11 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Message */}
            {message && (
              <div
                className={`p-3 rounded-xl text-sm flex items-center gap-2 border ${
                  message.type === 'success'
                    ? 'bg-secondary text-secondary-foreground border-border'
                    : 'bg-destructive/10 text-destructive border-destructive/20'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0" />
                )}
                {message.text}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  처리 중...
                </>
              ) : (
                '입고 완료'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 병합 확인 모달 */}
      {showMergeModal && mergeInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="font-bold text-lg text-foreground">수량 병합 확인</h3>
              </div>

              <p className="text-muted-foreground text-sm mb-4">
                해당 위치에 동일한 품목이 이미 존재합니다.<br />
                수량을 병합하시겠습니까?
              </p>

              <div className="bg-muted rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">품목명</span>
                  <span className="font-medium text-foreground">{mergeInfo.existingItem.itemName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">기존 수량</span>
                  <span className="font-medium text-foreground">{mergeInfo.existingItem.currentQty}개</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">추가 수량</span>
                  <span className="font-medium text-emerald-600">+{mergeInfo.newQty}개</span>
                </div>
                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="font-medium text-foreground">병합 후 수량</span>
                    <span className="font-bold text-primary">{mergeInfo.mergedQty}개</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex border-t border-border">
              <button
                onClick={handleMergeCancel}
                disabled={mergeLoading}
                className="flex-1 py-3.5 text-muted-foreground font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleMergeConfirm}
                disabled={mergeLoading}
                className="flex-1 py-3.5 text-emerald-600 font-medium hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors border-l border-border disabled:opacity-50"
              >
                {mergeLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    처리 중...
                  </span>
                ) : (
                  '병합'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TransactionInPage() {
  return (
    <Suspense fallback={
      <div className="p-4 flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    }>
      <TransactionInContent />
    </Suspense>
  )
}
