'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useWarehouses } from '@/lib/warehouse-context'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Warehouse, Plus, Trash2, Save, Loader2, CheckCircle2, XCircle, Shield } from 'lucide-react'

interface WarehouseItem {
  id: string
  name: string
  sortOrder?: number
  isNew?: boolean
}

export default function WarehouseSettingsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { refresh: refreshWarehouseContext } = useWarehouses()
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set())

  // 관리자 권한 확인
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/')
    }
  }, [user, authLoading, router])

  // 창고 목록 로드
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchWarehouses()
    }
  }, [user])

  const fetchWarehouses = async () => {
    try {
      const res = await fetch('/api/warehouses')
      const data = await res.json()
      if (data.success) {
        setWarehouses(data.warehouses)
      }
    } catch (error) {
      console.error('Failed to fetch warehouses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (index: number, field: 'id' | 'name', value: string) => {
    const updated = [...warehouses]
    updated[index] = { ...updated[index], [field]: value }
    setWarehouses(updated)
    // ID 변경 시 중복 에러 초기화
    if (field === 'id') {
      setDuplicateIds(new Set())
      setMessage(null)
    }
  }

  const handleAdd = () => {
    setWarehouses([...warehouses, { id: '', name: '', isNew: true }])
  }

  const handleRemove = async (index: number) => {
    const warehouse = warehouses[index]

    // 새로 추가한 항목이면 바로 삭제
    if (warehouse.isNew) {
      setWarehouses(warehouses.filter((_, i) => i !== index))
      return
    }

    // DB에서 삭제
    setDeletingId(warehouse.id)
    try {
      const res = await fetch(`/api/warehouses?id=${warehouse.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        setWarehouses(warehouses.filter((_, i) => i !== index))
        setMessage({ type: 'success', text: '삭제되었습니다.' })
        // 전역 창고 컨텍스트 갱신
        await refreshWarehouseContext()
      } else {
        setMessage({ type: 'error', text: data.message })
      }
    } catch {
      setMessage({ type: 'error', text: '삭제 중 오류가 발생했습니다.' })
    } finally {
      setDeletingId(null)
      setTimeout(() => setMessage(null), 2000)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    setDuplicateIds(new Set())

    // 중복 ID 검사
    const idCounts = new Map<string, number>()
    const duplicates = new Set<string>()

    for (const w of warehouses) {
      if (!w.id) continue
      const count = (idCounts.get(w.id) || 0) + 1
      idCounts.set(w.id, count)
      if (count > 1) {
        duplicates.add(w.id)
      }
    }

    if (duplicates.size > 0) {
      setDuplicateIds(duplicates)
      setMessage({ type: 'error', text: `중복된 ID가 있습니다: ${Array.from(duplicates).join(', ')}` })
      setSaving(false)
      return
    }

    try {
      // 새 항목 추가 및 기존 항목 수정
      for (let i = 0; i < warehouses.length; i++) {
        const w = warehouses[i]
        if (!w.id || !w.name) continue

        if (w.isNew) {
          // 추가
          const res = await fetch('/api/warehouses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: w.id, name: w.name }),
          })
          const data = await res.json()
          if (!data.success) {
            setMessage({ type: 'error', text: `창고 ${w.id}: ${data.message}` })
            setSaving(false)
            return
          }
        } else {
          // 수정
          const res = await fetch('/api/warehouses', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: w.id, name: w.name, sortOrder: i + 1 }),
          })
          const data = await res.json()
          if (!data.success) {
            setMessage({ type: 'error', text: `창고 ${w.id}: ${data.message}` })
            setSaving(false)
            return
          }
        }
      }

      setMessage({ type: 'success', text: '저장되었습니다.' })
      // 새로고침하여 isNew 플래그 제거
      await fetchWarehouses()
      // 전역 창고 컨텍스트 갱신
      await refreshWarehouseContext()
    } catch {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 2000)
    }
  }

  if (authLoading || loading || !user || user.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold text-foreground">창고 설정</h2>
        </div>
        <p className="text-sm text-muted-foreground">창고 ID와 이름을 설정합니다</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="space-y-3">
            {warehouses.map((warehouse, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="relative w-24">
                  <Input
                    type="text"
                    value={warehouse.id}
                    onChange={(e) => handleChange(index, 'id', e.target.value.toUpperCase())}
                    placeholder="ID"
                    className={`h-11 text-center rounded-lg font-mono ${
                      duplicateIds.has(warehouse.id)
                        ? 'border-red-500 border-2 focus:border-red-500 focus:ring-red-500'
                        : ''
                    }`}
                    disabled={!warehouse.isNew}
                    maxLength={10}
                  />
                </div>
                <div className="flex-1 relative">
                  <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={warehouse.name}
                    onChange={(e) => handleChange(index, 'name', e.target.value)}
                    placeholder="창고명 입력"
                    className="pl-10 h-11 rounded-lg"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(index)}
                  disabled={deletingId === warehouse.id}
                  className="h-11 w-11 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  {deletingId === warehouse.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleAdd}
            className="w-full mt-4 h-11 rounded-lg border-dashed text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            창고 추가
          </Button>

          {message && (
            <div
              className={`mt-4 p-3 rounded-xl text-sm flex items-center gap-2 border ${
                message.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
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
            onClick={handleSave}
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm mt-4"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                저장
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
