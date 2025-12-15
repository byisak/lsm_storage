// 창고 설정을 localStorage에 저장/불러오기
export interface WarehouseConfig {
  id: string
  name: string
}

const STORAGE_KEY = 'warehouse-config'

// 기본 창고 설정
const DEFAULT_WAREHOUSES: WarehouseConfig[] = [
  { id: '1', name: '모터자재창고' },
  { id: '2', name: '외부창고' },
  { id: '3', name: '제품창고' },
]

export function getWarehouses(): WarehouseConfig[] {
  if (typeof window === 'undefined') return DEFAULT_WAREHOUSES

  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return DEFAULT_WAREHOUSES

  try {
    return JSON.parse(stored)
  } catch {
    return DEFAULT_WAREHOUSES
  }
}

export function saveWarehouses(warehouses: WarehouseConfig[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(warehouses))
}

export function getWarehouseName(id: string): string {
  const warehouses = getWarehouses()
  const found = warehouses.find(w => w.id === id)
  return found?.name || `창고 ${id}`
}
