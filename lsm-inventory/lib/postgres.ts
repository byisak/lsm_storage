import { Pool, PoolClient, QueryResult } from 'pg'

// PostgreSQL 연결 풀 설정
const poolConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DATABASE || '',
  user: process.env.POSTGRES_USER || '',
  password: process.env.POSTGRES_PASSWORD || '',
  min: 2,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(poolConfig)

    // 에러 핸들링
    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err)
    })
  }
  return pool
}

export async function getConnection(): Promise<PoolClient> {
  const p = getPool()
  return p.connect()
}

/**
 * Oracle 스타일 named bind (:name) → PostgreSQL 스타일 ($1, $2, ...) 변환
 *
 * @example
 * convertBinds('SELECT * FROM users WHERE id = :id AND name = :name', { id: 1, name: 'test' })
 * // Returns: { sql: 'SELECT * FROM users WHERE id = $1 AND name = $2', values: [1, 'test'] }
 */
function convertBinds(
  sql: string,
  binds: Record<string, unknown> = {}
): { sql: string; values: unknown[] } {
  const values: unknown[] = []
  const bindMap = new Map<string, number>()
  let paramIndex = 1

  // :bindName 패턴을 찾아서 $n으로 변환
  const convertedSql = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, bindName) => {
    // 이미 매핑된 바인드면 같은 인덱스 사용
    if (bindMap.has(bindName)) {
      return `$${bindMap.get(bindName)}`
    }

    // 새 바인드 추가
    const key = bindName.toLowerCase()
    const value = binds[bindName] ?? binds[key] ?? binds[bindName.toUpperCase()]

    if (value === undefined) {
      // 바인드 값이 없으면 그대로 둠 (문자열 내 :: 캐스팅 등을 위해)
      // PostgreSQL :: 캐스팅 구문 처리
      return match
    }

    bindMap.set(bindName, paramIndex)
    values.push(value)
    return `$${paramIndex++}`
  })

  return { sql: convertedSql, values }
}

/**
 * Oracle ROWNUM → PostgreSQL LIMIT/OFFSET 변환 헬퍼
 * 주의: 복잡한 쿼리는 수동 변환 필요
 */
export function convertOracleToPostgres(sql: string): string {
  let result = sql

  // NOW() → NOW()
  result = result.replace(/\bNOW()\b/gi, 'NOW()')

  // COALESCE(a, b) → COALESCE(a, b)
  result = result.replace(/\bNVL\s*\(/gi, 'COALESCE(')

  // ROWNUM 간단 패턴 변환 (복잡한 경우 수동 처리 필요)
  // WHERE ROWNUM <= n → LIMIT n
  result = result.replace(/WHERE\s+ROWNUM\s*<=?\s*(\d+)/gi, 'LIMIT $1')

  // AND ROWNUM <= n → (마지막에 LIMIT n 추가)
  result = result.replace(/AND\s+ROWNUM\s*<=?\s*:?(\w+)/gi, '')

  // TO_CHAR(date, 'format') → TO_CHAR(date, 'format') - PostgreSQL도 지원
  // TO_DATE → PostgreSQL에서도 동일

  // || 문자열 연결은 PostgreSQL에서도 동일

  // 시퀀스: SEQ_NAME.NEXTVAL → nextval('seq_name')
  result = result.replace(/(\w+)\.NEXTVAL/gi, "nextval('$1')")

  return result
}

// ============================================================
// 쿼리 실행 함수들 (Oracle API와 호환)
// ============================================================

export async function executeQuery<T>(
  sql: string,
  binds: Record<string, unknown> = {}
): Promise<T[]> {
  const client = await getConnection()
  try {
    const { sql: convertedSql, values } = convertBinds(sql, binds)
    const result: QueryResult = await client.query(convertedSql, values)

    // 컬럼명을 대문자로 변환 (Oracle 호환성)
    return result.rows.map((row) => {
      const upperRow: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(row)) {
        upperRow[key.toUpperCase()] = value
      }
      return upperRow as T
    })
  } finally {
    client.release()
  }
}

export async function executeInsert(
  sql: string,
  binds: Record<string, unknown> = {}
): Promise<{ rowsAffected: number; lastRowid?: string }> {
  const client = await getConnection()
  try {
    const { sql: convertedSql, values } = convertBinds(sql, binds)
    const result = await client.query(convertedSql, values)
    return {
      rowsAffected: result.rowCount || 0,
      lastRowid: undefined, // PostgreSQL에서는 RETURNING 절 사용 권장
    }
  } finally {
    client.release()
  }
}

export async function executeUpdate(
  sql: string,
  binds: Record<string, unknown> = {}
): Promise<number> {
  const client = await getConnection()
  try {
    const { sql: convertedSql, values } = convertBinds(sql, binds)
    const result = await client.query(convertedSql, values)
    return result.rowCount || 0
  } finally {
    client.release()
  }
}

export async function executeDelete(
  sql: string,
  binds: Record<string, unknown> = {}
): Promise<number> {
  const client = await getConnection()
  try {
    const { sql: convertedSql, values } = convertBinds(sql, binds)
    const result = await client.query(convertedSql, values)
    return result.rowCount || 0
  } finally {
    client.release()
  }
}

// Oracle 호환 트랜잭션 클라이언트 래퍼
export interface TransactionClient {
  execute: (sql: string, binds?: Record<string, unknown>, options?: { autoCommit?: boolean }) => Promise<void>
  query: <T>(sql: string, binds?: Record<string, unknown>) => Promise<T[]>
}

function wrapClientForTransaction(client: PoolClient): TransactionClient {
  return {
    async execute(sql: string, binds: Record<string, unknown> = {}) {
      const { sql: convertedSql, values } = convertBinds(sql, binds)
      await client.query(convertedSql, values)
    },
    async query<T>(sql: string, binds: Record<string, unknown> = {}): Promise<T[]> {
      const { sql: convertedSql, values } = convertBinds(sql, binds)
      const result = await client.query(convertedSql, values)
      return result.rows.map((row) => {
        const upperRow: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(row)) {
          upperRow[key.toUpperCase()] = value
        }
        return upperRow as T
      })
    }
  }
}

// 트랜잭션 헬퍼
export async function withTransaction<T>(
  callback: (client: TransactionClient) => Promise<T>
): Promise<T> {
  const client = await getConnection()
  try {
    await client.query('BEGIN')
    const wrappedClient = wrapClientForTransaction(client)
    const result = await callback(wrappedClient)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// 연결 종료
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

// ============================================================
// 타입 정의 (Oracle과 동일)
// ============================================================

export interface LsMotorRack {
  ID: number
  STORAGE: string
  LOCATION: string
  ITEM_CODE: string
  ITEM_NAME: string
  NOW_QTY: number
  IN_DAY: Date | null
  REMARK: string | null
  COMPANY_ID?: string
}

export interface LsMotorSubul {
  ID: number
  STORAGE: string
  LOCATION: string
  ITEM_CODE: string
  ITEM_NAME: string
  QTY: number
  CATEGORY: string
  SUBUL_TIME: Date
  REMARK: string | null
  USER_ID: string
  COMPANY_ID?: string
}

export interface LsMotorItem {
  IDX: number
  STORAGE: string
  ITEM_CODE: string
  ITEM_NAME: string
  ERP_RESERVATION: number
  ERP_INVENTORY10: number
  ERP_INVENTORY11: number
  SHORTAGE: number
  COMPANY_ID?: string
}

export interface LsUser {
  ID: number
  NAME: string
  EMAIL: string
  PASSWORD: string
  STATUS: 'PENDING' | 'APPROVED' | 'REJECTED'
  ROLE: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
  CREATED_AT: Date
  APPROVED_AT: Date | null
  APPROVED_BY: number | null
  COMPANY_ID?: string
}

export interface LsWarehouse {
  ID: string
  NAME: string
  SORT_ORDER: number
  CREATED_AT: Date
  COMPANY_ID?: string
}

export interface Company {
  ID: string
  NAME: string
  BUSINESS_NUMBER?: string | null
  REPRESENTATIVE?: string | null
  PHONE?: string | null
  EMAIL?: string | null
  ADDRESS?: string | null
  LOGO_URL?: string | null
  THEME_COLOR?: string | null
  CONTACT_EMAIL?: string | null
  CONTACT_PHONE?: string | null
  STATUS: 'ACTIVE' | 'SUSPENDED' | 'DELETED'
  PLAN_TYPE: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE'
  MAX_USERS?: number
  MAX_WAREHOUSES?: number
  CREATED_AT?: Date
  UPDATED_AT?: Date
}
