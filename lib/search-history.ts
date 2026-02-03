const ITEM_SEARCH_HISTORY_KEY = 'lsm_item_search_history'
const RACK_SEARCH_HISTORY_KEY = 'lsm_rack_search_history'
const MAX_HISTORY_ITEMS = 10

export interface SearchHistoryItem {
  code: string
  name?: string
  time: string // ISO string
}

// 기존 string[] 형식 → 새 형식으로 마이그레이션
function migrateHistory(data: unknown): SearchHistoryItem[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((item): item is SearchHistoryItem | string => !!item)
    .map((item) => {
      if (typeof item === 'string') {
        return { code: item, time: new Date().toISOString() }
      }
      return item
    })
}

export function getItemSearchHistory(): SearchHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(ITEM_SEARCH_HISTORY_KEY)
    return data ? migrateHistory(JSON.parse(data)) : []
  } catch {
    return []
  }
}

export function addItemSearchHistory(code: string, name?: string): SearchHistoryItem[] {
  if (typeof window === 'undefined') return []
  if (!code.trim()) return getItemSearchHistory()

  try {
    let history = getItemSearchHistory()
    // 중복 제거 (대소문자 구분 없이)
    history = history.filter(item => item.code.toLowerCase() !== code.toLowerCase())
    // 맨 앞에 추가
    history.unshift({ code, name, time: new Date().toISOString() })
    // 최대 개수 제한
    history = history.slice(0, MAX_HISTORY_ITEMS)
    localStorage.setItem(ITEM_SEARCH_HISTORY_KEY, JSON.stringify(history))
    return history
  } catch {
    return []
  }
}

export function getRackSearchHistory(): SearchHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(RACK_SEARCH_HISTORY_KEY)
    return data ? migrateHistory(JSON.parse(data)) : []
  } catch {
    return []
  }
}

export function addRackSearchHistory(code: string, name?: string): SearchHistoryItem[] {
  if (typeof window === 'undefined') return []
  if (!code.trim()) return getRackSearchHistory()

  try {
    let history = getRackSearchHistory()
    // 중복 제거 (대소문자 구분 없이)
    history = history.filter(item => item.code.toLowerCase() !== code.toLowerCase())
    // 맨 앞에 추가
    history.unshift({ code, name, time: new Date().toISOString() })
    // 최대 개수 제한
    history = history.slice(0, MAX_HISTORY_ITEMS)
    localStorage.setItem(RACK_SEARCH_HISTORY_KEY, JSON.stringify(history))
    return history
  } catch {
    return []
  }
}
