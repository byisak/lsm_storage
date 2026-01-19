import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise'

// MySQL 연결 풀 설정
const poolConfig = {
  host: process.env.MYSQL_HOST || '192.168.0.2',
  port: parseInt(process.env.MYSQL_PORT || '10004', 10),
  database: process.env.MYSQL_DATABASE || 'lsm',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '!Wlsl10040',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
}

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool(poolConfig)
  }
  return pool
}

export async function getConnection(): Promise<PoolConnection> {
  const p = getPool()
  return p.getConnection()
}

/**
 * Oracle 스타일 named bind (:name) → MySQL 스타일 (?) 변환
 *
 * @example
 * convertBinds('SELECT * FROM users WHERE id = :id AND name = :name', { id: 1, name: 'test' })
 * // Returns: { sql: 'SELECT * FROM users WHERE id = ? AND name = ?', values: [1, 'test'] }
 */
function convertBinds(
  sql: string,
  binds: Record<string, unknown> = {}
): { sql: string; values: unknown[] } {
  const values: unknown[] = []
  const bindOrder: string[] = []

  // :bindName 패턴을 찾아서 순서대로 기록
  const convertedSql = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, bindName) => {
    const key = bindName.toLowerCase()
    const value = binds[bindName] ?? binds[key] ?? binds[bindName.toUpperCase()]

    if (value === undefined) {
      // 바인드 값이 없으면 그대로 둠
      return match
    }

    bindOrder.push(bindName)
    values.push(value)
    return '?'
  })

  return { sql: convertedSql, values }
}

// ============================================================
// 쿼리 실행 함수들 (기존 API와 호환)
// ============================================================

export async function executeQuery<T>(
  sql: string,
  binds: Record<string, unknown> = {}
): Promise<T[]> {
  const conn = await getConnection()
  try {
    const { sql: convertedSql, values } = convertBinds(sql, binds)
    const [rows] = await conn.query<RowDataPacket[]>(convertedSql, values)

    // 원본 컬럼명 유지 (LSM_Warehouse_3D 호환)
    return rows as T[]
  } finally {
    conn.release()
  }
}

export async function executeInsert(
  sql: string,
  binds: Record<string, unknown> = {}
): Promise<{ rowsAffected: number; insertId?: number }> {
  const conn = await getConnection()
  try {
    const { sql: convertedSql, values } = convertBinds(sql, binds)
    const [result] = await conn.query<ResultSetHeader>(convertedSql, values)
    return {
      rowsAffected: result.affectedRows || 0,
      insertId: result.insertId,
    }
  } finally {
    conn.release()
  }
}

export async function executeUpdate(
  sql: string,
  binds: Record<string, unknown> = {}
): Promise<number> {
  const conn = await getConnection()
  try {
    const { sql: convertedSql, values } = convertBinds(sql, binds)
    const [result] = await conn.query<ResultSetHeader>(convertedSql, values)
    return result.affectedRows || 0
  } finally {
    conn.release()
  }
}

export async function executeDelete(
  sql: string,
  binds: Record<string, unknown> = {}
): Promise<number> {
  const conn = await getConnection()
  try {
    const { sql: convertedSql, values } = convertBinds(sql, binds)
    const [result] = await conn.query<ResultSetHeader>(convertedSql, values)
    return result.affectedRows || 0
  } finally {
    conn.release()
  }
}

// 트랜잭션 클라이언트 래퍼
export interface TransactionClient {
  execute: (sql: string, binds?: Record<string, unknown>, options?: { autoCommit?: boolean }) => Promise<void>
  query: <T>(sql: string, binds?: Record<string, unknown>) => Promise<T[]>
}

function wrapClientForTransaction(conn: PoolConnection): TransactionClient {
  return {
    async execute(sql: string, binds: Record<string, unknown> = {}) {
      const { sql: convertedSql, values } = convertBinds(sql, binds)
      await conn.query(convertedSql, values)
    },
    async query<T>(sql: string, binds: Record<string, unknown> = {}): Promise<T[]> {
      const { sql: convertedSql, values } = convertBinds(sql, binds)
      const [rows] = await conn.query<RowDataPacket[]>(convertedSql, values)
      return rows.map((row) => {
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
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const wrappedClient = wrapClientForTransaction(conn)
    const result = await callback(wrappedClient)
    await conn.commit()
    return result
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
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
// 타입 정의 (기존 코드 호환)
// ============================================================

export interface LsMotorRack {
  ID: number
  storage: string
  Location: string
  itemCode: string
  itemName: string
  Now_Qty: number
  In_day: Date | null
  remark: string | null
}

export interface LsMotorSubul {
  ID: number
  storage: string
  Location: string
  itemCode: string
  itemName: string
  Qty: number
  Category: string
  Subul_Time: Date
  remark: string | null
  user: string
}

export interface LsMotorItem {
  IDX: number
  storage: string
  itemCode: string
  itemName: string
  ERP_RESERVATION: number
  ERP_INVENTORY10: number
  ERP_INVENTORY11: number
  SHORTAGE: number
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
}

export interface LsWarehouse {
  ID: string
  NAME: string
  SORT_ORDER: number
  CREATED_AT: Date
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
