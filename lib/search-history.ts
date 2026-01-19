const ITEM_SEARCH_HISTORY_KEY = 'lsm_item_search_history'
const RACK_SEARCH_HISTORY_KEY = 'lsm_rack_search_history'
const MAX_HISTORY_ITEMS = 10

export function getItemSearchHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(ITEM_SEARCH_HISTORY_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function addItemSearchHistory(query: string): string[] {
  if (typeof window === 'undefined') return []
  if (!query.trim()) return getItemSearchHistory()

  try {
    let history = getItemSearchHistory()
    // 중복 제거 (대소문자 구분 없이)
    history = history.filter(item => item.toLowerCase() !== query.toLowerCase())
    // 맨 앞에 추가
    history.unshift(query)
    // 최대 개수 제한
    history = history.slice(0, MAX_HISTORY_ITEMS)
    localStorage.setItem(ITEM_SEARCH_HISTORY_KEY, JSON.stringify(history))
    return history
  } catch {
    return []
  }
}

export function getRackSearchHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(RACK_SEARCH_HISTORY_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function addRackSearchHistory(query: string): string[] {
  if (typeof window === 'undefined') return []
  if (!query.trim()) return getRackSearchHistory()

  try {
    let history = getRackSearchHistory()
    // 중복 제거 (대소문자 구분 없이)
    history = history.filter(item => item.toLowerCase() !== query.toLowerCase())
    // 맨 앞에 추가
    history.unshift(query)
    // 최대 개수 제한
    history = history.slice(0, MAX_HISTORY_ITEMS)
    localStorage.setItem(RACK_SEARCH_HISTORY_KEY, JSON.stringify(history))
    return history
  } catch {
    return []
  }
}
