// 위치 단축 입력 변환 유틸리티

/**
 * 단축 입력을 정식 위치 포맷으로 변환
 * 예: "A11" → "A-01-01", "B23" → "B-02-03", "a1b2" → "A-1B-02"
 */
export function expandLocation(input: string): string {
  if (!input) return input

  // 이미 하이픈이 포함되어 있으면 그대로 반환
  if (input.includes('-')) return input.toUpperCase()

  const trimmed = input.trim().toUpperCase()

  // 패턴: 문자 + 숫자 + 숫자 (예: A11, B23)
  const match3 = trimmed.match(/^([A-Z])(\d)(\d)$/)
  if (match3) {
    const [, letter, row, col] = match3
    return `${letter}-0${row}-0${col}`
  }

  // 패턴: 문자 + 숫자숫자 + 숫자숫자 (예: A0101, B0203)
  const match5 = trimmed.match(/^([A-Z])(\d{2})(\d{2})$/)
  if (match5) {
    const [, letter, row, col] = match5
    return `${letter}-${row}-${col}`
  }

  // 패턴: 문자 + 숫자 + 문자 + 숫자 (예: A1B1 → A-1B-01)
  const match4 = trimmed.match(/^([A-Z])(\d)([A-Z])(\d)$/)
  if (match4) {
    const [, letter1, num1, letter2, num2] = match4
    return `${letter1}-${num1}${letter2}-0${num2}`
  }

  // 변환 불가능한 경우 대문자로만 반환
  return trimmed
}

/**
 * 입력이 단축 입력인지 확인
 */
export function isShortLocation(input: string): boolean {
  if (!input || input.includes('-')) return false
  const trimmed = input.trim().toUpperCase()
  return /^[A-Z]\d{2,4}$/.test(trimmed) || /^[A-Z]\d[A-Z]\d$/.test(trimmed)
}
