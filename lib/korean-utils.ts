// 한글 초성 추출 유틸리티

const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
]

// 한글 문자에서 초성 추출
export function getChosung(str: string): string {
  let result = ''
  for (const char of str) {
    const code = char.charCodeAt(0)
    // 한글 유니코드 범위: 0xAC00 ~ 0xD7A3
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const chosungIndex = Math.floor((code - 0xAC00) / 588)
      result += CHOSUNG[chosungIndex]
    } else {
      result += char
    }
  }
  return result
}

// 초성으로만 이루어진 문자열인지 확인
export function isChosungOnly(str: string): boolean {
  return /^[ㄱ-ㅎ]+$/.test(str)
}

// 문자열이 초성 패턴과 매칭되는지 확인
export function matchChosung(text: string, pattern: string): boolean {
  if (!pattern) return true

  // 패턴이 초성만으로 이루어진 경우
  if (isChosungOnly(pattern)) {
    const textChosung = getChosung(text)
    return textChosung.toLowerCase().includes(pattern.toLowerCase())
  }

  // 일반 텍스트 검색
  return text.toLowerCase().includes(pattern.toLowerCase())
}
