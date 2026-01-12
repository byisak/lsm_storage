'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useWarehouses } from '@/lib/warehouse-context'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Warehouse, Plus, Trash2, Save, Loader2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface WarehouseItem {
  id: string
  name: string
  sortOrder?: number
  isNew?: boolean
}

export default function AdminWarehousesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { refresh: refreshWarehouseContext } = useWarehouses()
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set())

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  // 관리자 권한 확인
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/')
    }
  }, [user, authLoading, router, isAdmin])

  // 창고 목록 로드
  useEffect(() => {
    if (isAdmin) {
      fetchWarehouses()
    }
  }, [user, isAdmin])

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

    if (warehouse.isNew) {
      setWarehouses(warehouses.filter((_, i) => i !== index))
      return
    }

    setDeletingId(warehouse.id)
    try {
      const res = await fetch(`/api/warehouses?id=${warehouse.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        setWarehouses(warehouses.filter((_, i) => i !== index))
        setMessage({ type: 'success', text: '삭제되었습니다.' })
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
      for (let i = 0; i < warehouses.length; i++) {
        const w = warehouses[i]
        if (!w.id || !w.name) continue

        if (w.isNew) {
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
      await fetchWarehouses()
      await refreshWarehouseContext()
    } catch {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 2000)
    }
  }

  if (authLoading || loading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
        <div className="flex items-center gap-2 mb-1">
          <Warehouse className="w-5 h-5 text-purple-500" />
          <h1 className="text-xl font-bold text-foreground">창고 설정</h1>
        </div>
        <p className="text-sm text-muted-foreground">창고를 추가, 수정, 삭제합니다</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="space-y-3">
            {warehouses.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Warehouse className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">등록된 창고가 없습니다</p>
                <p className="text-sm text-muted-foreground mt-1">아래 버튼을 눌러 창고를 추가하세요</p>
              </div>
            ) : (
              warehouses.map((warehouse, index) => (
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
              ))
            )}
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
            className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-sm mt-4"
            disabled={saving || warehouses.length === 0}
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
