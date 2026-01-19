'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, MapPin, Package, FileText, Loader2, CheckCircle2, XCircle, ChevronLeft, Minus, Warehouse } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

interface RackItem {
  id: number
  storage: string
  location: string
  itemCode: string
  itemName: string
  nowQty: number
}

export default function TransactionOutPage() {
  const { user } = useAuth()
  const [location, setLocation] = useState('')
  const [items, setItems] = useState<RackItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<RackItem | null>(null)
  const [outQty, setOutQty] = useState('')
  const [remark, setRemark] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSearch = async () => {
    if (!location.trim()) return

    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/rack/search?location=${encodeURIComponent(location)}`)
      const data = await res.json()
      if (data.success) {
        setItems(data.items)
        if (data.items.length === 0) {
          setMessage({ type: 'error', text: '해당 위치에 재고가 없습니다.' })
        }
      }
    } catch {
      setMessage({ type: 'error', text: '검색 중 오류가 발생했습니다.' })
    } finally {
      setLoading(false)
    }
  }

  const handleOut = async () => {
    if (!selectedItem || !outQty) return

    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/transaction/out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rackId: selectedItem.id,
          qty: parseInt(outQty),
          remark,
          user: user?.name || '익명',
        }),
      })

      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: data.message })
        setSelectedItem(null)
        setOutQty('')
        setRemark('')
        handleSearch()
      } else {
        setMessage({ type: 'error', text: data.message })
      }
    } catch {
      setMessage({ type: 'error', text: '오류가 발생했습니다.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">출고 처리</h2>
        <p className="text-sm text-gray-500">위치를 검색하여 출고할 품목을 선택하세요</p>
      </div>

      {/* Search */}
      {!selectedItem && (
        <div className="mb-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="위치 입력 (예: A-01-01)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
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
      )}

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
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

      {/* Selected Item Form */}
      {selectedItem ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            {/* Back Button */}
            <button
              onClick={() => setSelectedItem(null)}
              className="flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-gray-700"
            >
              <ChevronLeft className="w-4 h-4" />
              목록으로
            </button>

            {/* Selected Item Info */}
            <div className="p-4 bg-gradient-to-r from-orange-50 to-orange-100/50 rounded-xl mb-4">
              <p className="text-xs text-orange-600 font-medium">선택된 품목</p>
              <p className="font-semibold text-gray-900 mt-1">{selectedItem.itemName}</p>
              <p className="text-sm text-gray-500">{selectedItem.itemCode}</p>
              <div className="flex items-center gap-2 mt-2">
                <Package className="w-4 h-4 text-orange-500" />
                <span className="text-sm">
                  현재고: <strong className="text-orange-600">{selectedItem.nowQty}</strong> 개
                </span>
              </div>
            </div>

            {/* Quantity Input */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  출고 수량 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Minus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={outQty}
                    onChange={(e) => setOutQty(e.target.value)}
                    placeholder="출고할 수량"
                    min="1"
                    max={selectedItem.nowQty}
                    className="pl-10 h-11 rounded-lg border-gray-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">비고</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="비고 (선택)"
                    className="pl-10 h-11 rounded-lg border-gray-200"
                  />
                </div>
              </div>

              <Button
                onClick={handleOut}
                disabled={loading || !outQty}
                className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  '출고 완료'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Item List */
        <div className="space-y-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className="border-0 shadow-sm cursor-pointer hover:shadow-md active:scale-[0.98] transition-all"
              onClick={() => setSelectedItem(item)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded">
                      {item.itemCode}
                    </span>
                    <p className="font-medium text-gray-900 mt-1.5">{item.itemName}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {item.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Warehouse className="w-3 h-3" />
                        {item.storage}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm">
                      <Package className="w-4 h-4 text-blue-500" />
                      <span className="font-bold text-blue-600">{item.nowQty}</span>
                      <span className="text-gray-400">개</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {items.length === 0 && !loading && location && !selectedItem && (
        <div className="text-center py-12">
          <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
            <Package className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">해당 위치에 재고가 없습니다</p>
        </div>
      )}
    </div>
  )
}
