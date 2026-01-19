'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface WarehouseConfig {
  id: string
  name: string
}

interface WarehouseContextType {
  warehouses: WarehouseConfig[]
  loading: boolean
  getWarehouseName: (id: string) => string
  refresh: () => Promise<void>
}

// 기본 창고 (API 호출 전 또는 실패 시)
const DEFAULT_WAREHOUSES: WarehouseConfig[] = [
  { id: '1', name: '모터 창고' },
  { id: '2', name: '외부 창고' },
  { id: '3', name: '제품 창고' },
]

const WarehouseContext = createContext<WarehouseContextType | null>(null)

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [warehouses, setWarehouses] = useState<WarehouseConfig[]>(DEFAULT_WAREHOUSES)
  const [loading, setLoading] = useState(true)

  const fetchWarehouses = async () => {
    try {
      const res = await fetch('/api/warehouses')
      const data = await res.json()
      if (data.success && data.warehouses.length > 0) {
        setWarehouses(data.warehouses)
      }
    } catch (error) {
      console.error('Failed to fetch warehouses:', error)
      // 실패 시 기본값 유지
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWarehouses()
  }, [])

  const getWarehouseName = (id: string): string => {
    const found = warehouses.find(w => w.id === id)
    return found?.name || `창고 ${id}`
  }

  return (
    <WarehouseContext.Provider value={{ warehouses, loading, getWarehouseName, refresh: fetchWarehouses }}>
      {children}
    </WarehouseContext.Provider>
  )
}

export function useWarehouses() {
  const context = useContext(WarehouseContext)
  if (!context) {
    throw new Error('useWarehouses must be used within a WarehouseProvider')
  }
  return context
}
