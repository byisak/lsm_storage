/**
 * 비밀번호 검증 유틸리티
 * - Werkzeug scrypt 해시 지원 (LSM_Warehouse_3D 호환)
 * - bcrypt 해시 지원 (lsm_storage 기본)
 */

import { scrypt, timingSafeEqual } from 'crypto'
import bcrypt from 'bcryptjs'

/**
 * Werkzeug 스타일의 scrypt 해시를 검증합니다.
 * 형식: scrypt:N:r:p$salt$hash
 * 예: scrypt:32768:8:1$Y7ehlfy1ZrCL76z3$e3cacd3c0ac1688f...
 */
async function verifyScryptHash(password: string, hash: string): Promise<boolean> {
  try {
    // scrypt:N:r:p$salt$hash 형식 파싱
    const parts = hash.split('$')
    if (parts.length !== 3) return false

    const [method, salt, storedHash] = parts
    const methodParts = method.split(':')
    if (methodParts[0] !== 'scrypt' || methodParts.length !== 4) return false

    const N = parseInt(methodParts[1], 10)  // CPU/memory cost
    const r = parseInt(methodParts[2], 10)  // block size
    const p = parseInt(methodParts[3], 10)  // parallelization

    // scrypt 파라미터로 키 도출
    const keyLength = storedHash.length / 2  // hex 문자열이므로 바이트 길이는 절반
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, keyLength, { N, r, p, maxmem: 128 * N * r * 2 }, (err, key) => {
        if (err) reject(err)
        else resolve(key)
      })
    })

    // 저장된 해시와 비교 (hex 형식)
    const storedHashBuffer = Buffer.from(storedHash, 'hex')

    return timingSafeEqual(derivedKey, storedHashBuffer)
  } catch (error) {
    console.error('Scrypt verification error:', error)
    return false
  }
}

/**
 * bcrypt 해시를 검증합니다.
 */
async function verifyBcryptHash(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

/**
 * 비밀번호를 검증합니다.
 * scrypt(Werkzeug) 또는 bcrypt 해시를 자동으로 감지하여 검증합니다.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false

  // scrypt 해시인지 확인 (Werkzeug 형식)
  if (hash.startsWith('scrypt:')) {
    return verifyScryptHash(password, hash)
  }

  // bcrypt 해시인지 확인 ($2a$, $2b$, $2y$ 등으로 시작)
  if (hash.startsWith('$2')) {
    return verifyBcryptHash(password, hash)
  }

  // 알 수 없는 해시 형식
  console.warn('Unknown password hash format')
  return false
}

/**
 * bcrypt로 비밀번호를 해시합니다.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}
