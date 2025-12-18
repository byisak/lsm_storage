import oracledb from 'oracledb'

// Oracle Thin 모드 사용 (Oracle Client 설치 불필요)
// oracledb 6.x 이상에서는 thin 모드가 기본값
// initOracleClient()를 호출하지 않으면 자동으로 thin 모드 사용

interface PoolConfig {
  user: string
  password: string
  connectString: string
  poolMin: number
  poolMax: number
  poolIncrement: number
}

const poolConfig: PoolConfig = {
  user: process.env.ORACLE_USER || '',
  password: process.env.ORACLE_PASSWORD || '',
  connectString: process.env.ORACLE_CONNECTION_STRING || '',
  poolMin: 2,
  poolMax: 10,
  poolIncrement: 1,
}

let pool: oracledb.Pool | null = null

export async function getPool(): Promise<oracledb.Pool> {
  if (!pool) {
    pool = await oracledb.createPool(poolConfig)
  }
  return pool
}

export async function getConnection(): Promise<oracledb.Connection> {
  const p = await getPool()
  return p.getConnection()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeQuery<T>(
  sql: string,
  binds: Record<string, unknown> | oracledb.BindParameters = {},
  options: oracledb.ExecuteOptions = {}
): Promise<T[]> {
  const connection = await getConnection()
  try {
    const result = await connection.execute(sql, binds as oracledb.BindParameters, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      autoCommit: true,
      ...options,
    })
    return (result.rows as T[]) || []
  } finally {
    await connection.close()
  }
}

export async function executeInsert(
  sql: string,
  binds: oracledb.BindParameters = {}
): Promise<{ rowsAffected: number; lastRowid?: string }> {
  const connection = await getConnection()
  try {
    const result = await connection.execute(sql, binds, {
      autoCommit: true,
    })
    return {
      rowsAffected: result.rowsAffected || 0,
      lastRowid: result.lastRowid,
    }
  } finally {
    await connection.close()
  }
}

export async function executeUpdate(
  sql: string,
  binds: oracledb.BindParameters = {}
): Promise<number> {
  const connection = await getConnection()
  try {
    const result = await connection.execute(sql, binds, {
      autoCommit: true,
    })
    return result.rowsAffected || 0
  } finally {
    await connection.close()
  }
}

export async function executeDelete(
  sql: string,
  binds: oracledb.BindParameters = {}
): Promise<number> {
  const connection = await getConnection()
  try {
    const result = await connection.execute(sql, binds, {
      autoCommit: true,
    })
    return result.rowsAffected || 0
  } finally {
    await connection.close()
  }
}

// 트랜잭션 헬퍼
export async function withTransaction<T>(
  callback: (connection: oracledb.Connection) => Promise<T>
): Promise<T> {
  const connection = await getConnection()
  try {
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    await connection.close()
  }
}

// 연결 종료
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close(0)
    pool = null
  }
}

// ============================================================
// 타입 정의
// COMPANY_ID는 optional로 정의하여 하위 호환성 유지
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
  COMPANY_ID?: string  // 멀티테넌트용 (optional)
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
  COMPANY_ID?: string  // 멀티테넌트용 (optional)
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
  COMPANY_ID?: string  // 멀티테넌트용 (optional)
}

export interface LsUser {
  ID: number
  NAME: string
  EMAIL: string
  PASSWORD: string
  STATUS: 'PENDING' | 'APPROVED' | 'REJECTED'
  ROLE: 'USER' | 'ADMIN'
  CREATED_AT: Date
  APPROVED_AT: Date | null
  APPROVED_BY: number | null
  COMPANY_ID?: string  // 멀티테넌트용 (optional)
}

export interface LsWarehouse {
  ID: string
  NAME: string
  SORT_ORDER: number
  CREATED_AT: Date
  COMPANY_ID?: string  // 멀티테넌트용 (optional)
}

// ============================================================
// 회사 테이블 타입 (멀티테넌트)
// ============================================================

export interface Company {
  ID: string
  NAME: string
  BUSINESS_NUMBER: string | null
  REPRESENTATIVE: string | null
  PHONE: string | null
  EMAIL: string | null
  ADDRESS: string | null
  LOGO_URL: string | null
  STATUS: 'ACTIVE' | 'SUSPENDED' | 'DELETED'
  PLAN_TYPE: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE'
  MAX_USERS: number
  MAX_WAREHOUSES: number
  CREATED_AT: Date
  UPDATED_AT: Date
}
