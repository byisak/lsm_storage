'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Warehouse, Plus, Trash2, Save, Loader2, CheckCircle2 } from 'lucide-react'
import { getWarehouses, saveWarehouses, WarehouseConfig } from '@/lib/warehouse-config'

export default function WarehouseSettingsPage() {
  const [warehouses, setWarehouses] = useState<WarehouseConfig[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setWarehouses(getWarehouses())
  }, [])

  const handleChange = (index: number, field: 'id' | 'name', value: string) => {
    const updated = [...warehouses]
    updated[index] = { ...updated[index], [field]: value }
    setWarehouses(updated)
  }

  const handleAdd = () => {
    const nextId = String(Math.max(...warehouses.map(w => parseInt(w.id) || 0), 0) + 1)
    setWarehouses([...warehouses, { id: nextId, name: '' }])
  }

  const handleRemove = (index: number) => {
    setWarehouses(warehouses.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    setSaving(true)
    saveWarehouses(warehouses)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 300)
  }

  return (
    <div className="p-4">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">창고 설정</h2>
        <p className="text-sm text-gray-500">창고 번호별 이름을 설정합니다</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="space-y-3">
            {warehouses.map((warehouse, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="relative w-20">
                  <Input
                    type="text"
                    value={warehouse.id}
                    onChange={(e) => handleChange(index, 'id', e.target.value)}
                    placeholder="번호"
                    className="h-11 text-center font-mono rounded-lg border-gray-200"
                  />
                </div>
                <div className="flex-1 relative">
                  <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    value={warehouse.name}
                    onChange={(e) => handleChange(index, 'name', e.target.value)}
                    placeholder="창고명 입력"
                    className="pl-10 h-11 rounded-lg border-gray-200"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(index)}
                  className="h-11 w-11 text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleAdd}
            className="w-full mt-4 h-11 rounded-lg border-dashed border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400"
          >
            <Plus className="w-4 h-4 mr-2" />
            창고 추가
          </Button>

          {saved && (
            <div className="mt-4 p-3 rounded-xl text-sm flex items-center gap-2 bg-green-50 text-green-700 border border-green-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              저장되었습니다
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
