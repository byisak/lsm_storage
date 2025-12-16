'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { ArrowLeft, Undo2, Clock, Package, MapPin, Warehouse, Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

interface UndoItem {
  id: number
  storage: string
  location: string
  itemCode: string
  itemName: string
  qty: number
  category: string
  subulTime: string
  displayRemark: string
  userId: string
  canUndo: boolean
  undoMeta: Record<string, unknown> | null
}

export default function UndoPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [items, setItems] = useState<UndoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [undoLoading, setUndoLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<UndoItem | null>(null)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 작업 목록 조회
  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/transaction/undo/list')
      const data = await res.json()
      if (data.success) {
        setItems(data.items)
      }
    } catch (error) {
      console.error('Fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  // 시간 포맷팅
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // 카테고리 라벨
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case '출고':
        return { label: '출고', color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' }
      case '이동(출)':
        return { label: '이동', color: 'text-teal-600 bg-teal-100 dark:bg-teal-900/30' }
      case '이동(병합)':
        return { label: '이동(병합)', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' }
      default:
        return { label: category, color: 'text-gray-600 bg-gray-100 dark:bg-gray-800' }
    }
  }

  // 실행취소 확인
  const handleUndoConfirm = async () => {
    if (!selectedItem) return

    setUndoLoading(true)
    try {
      const res = await fetch('/api/transaction/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subulId: selectedItem.id,
          user: user?.name || '익명',
        }),
      })
      const data = await res.json()

      if (data.success) {
        setToastMessage({ type: 'success', text: '작업이 취소되었습니다.' })
        // 목록 새로고침
        fetchItems()
      } else {
        setToastMessage({ type: 'error', text: data.message || '취소 처리 중 오류가 발생했습니다.' })
      }
    } catch (error) {
      setToastMessage({ type: 'error', text: '서버 오류가 발생했습니다.' })
    } finally {
      setUndoLoading(false)
      setSelectedItem(null)
      setTimeout(() => setToastMessage(null), 3000)
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

      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="rounded-xl"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">작업 취소</h1>
          <p className="text-sm text-muted-foreground">최근 24시간 내 작업을 되돌릴 수 있습니다</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchItems}
          disabled={loading}
          className="rounded-xl"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground mt-2">불러오는 중...</p>
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && items.length === 0 && (
        <div className="text-center py-12">
          <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">취소 가능한 작업이 없습니다</p>
          <p className="text-muted-foreground/70 text-sm mt-1">
            최근 24시간 내 출고/이동 작업이 표시됩니다
          </p>
        </div>
      )}

      {/* 작업 목록 */}
      <div className="space-y-3">
        {items.map((item) => {
          const { label, color } = getCategoryLabel(item.category)

          return (
            <Card key={item.id} className="border-0 shadow-sm overflow-hidden bg-card">
              <CardContent className="p-0">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${color}`}>
                        {label}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(item.subulTime)}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-primary">
                      {item.qty.toLocaleString()}개
                    </span>
                  </div>

                  <p className="font-semibold text-foreground">{item.itemCode}</p>
                  <p className="text-sm text-muted-foreground truncate">{item.itemName}</p>

                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {item.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Warehouse className="w-3 h-3" />
                      {item.storage}
                    </span>
                  </div>

                  {item.displayRemark && (
                    <p className="text-xs text-muted-foreground mt-2 bg-muted px-2 py-1 rounded">
                      {item.displayRemark}
                    </p>
                  )}
                </div>

                {/* 취소 버튼 */}
                {item.canUndo && (
                  <div className="border-t border-border">
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-accent transition-colors"
                    >
                      <Undo2 className="w-4 h-4" />
                      이 작업 취소
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 취소 확인 모달 */}
      <AlertDialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <AlertDialogTitle className="text-lg font-bold">작업 취소 확인</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left pt-2">
              이 작업을 취소하시겠습니까?<br />
              재고가 이전 상태로 복원됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedItem && (
            <div className="bg-muted rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">작업</span>
                <span className="font-medium text-foreground">{getCategoryLabel(selectedItem.category).label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">품목</span>
                <span className="font-medium text-foreground">{selectedItem.itemCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">수량</span>
                <span className="font-medium text-foreground">{selectedItem.qty}개</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">위치</span>
                <span className="font-medium text-foreground">{selectedItem.location}</span>
              </div>
            </div>
          )}

          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel
              disabled={undoLoading}
              className="flex-1 h-11 rounded-xl"
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUndoConfirm}
              disabled={undoLoading}
              className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700"
            >
              {undoLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  처리 중...
                </span>
              ) : (
                '작업 취소'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
