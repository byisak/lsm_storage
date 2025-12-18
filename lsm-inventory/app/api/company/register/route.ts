import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, withTransaction, Company } from '@/lib/oracle'
import { hash } from 'bcryptjs'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

// 회사 등록 (신규 회사 가입)
export async function POST(request: NextRequest) {
  try {
    // 멀티테넌트 모드가 아니면 회사 등록 불가
    if (!isMultiTenantEnabled()) {
      return NextResponse.json(
        { success: false, message: '회사 등록 기능을 사용할 수 없습니다.' },
        { status: 400 }
      )
    }

    const data = await request.json()
    const { companyCode, companyName, adminName, adminEmail, adminPassword } = data

    // 필수 값 검증
    if (!companyCode || !companyName || !adminName || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { success: false, message: '필수 입력값이 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 회사 코드 형식 검증 (영문 대문자 + 숫자, 3-20자)
    const codeRegex = /^[A-Z0-9]{3,20}$/
    if (!codeRegex.test(companyCode)) {
      return NextResponse.json(
        { success: false, message: '회사 코드는 영문 대문자와 숫자로 3-20자여야 합니다.' },
        { status: 400 }
      )
    }

    // 비밀번호 길이 검증
    if (adminPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: '비밀번호는 최소 6자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(adminEmail)) {
      return NextResponse.json(
        { success: false, message: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      )
    }

    // 회사 코드 중복 확인
    const existingCompany = await executeQuery<Company>(
      `SELECT ID FROM COMPANIES WHERE ID = :id`,
      { id: companyCode }
    )

    if (existingCompany.length > 0) {
      return NextResponse.json(
        { success: false, message: '이미 사용 중인 회사 코드입니다.' },
        { status: 400 }
      )
    }

    // 이메일 중복 확인 (전체 시스템에서)
    const existingUser = await executeQuery(
      `SELECT ID FROM LS_USERS WHERE EMAIL = :email`,
      { email: adminEmail }
    )

    if (existingUser.length > 0) {
      return NextResponse.json(
        { success: false, message: '이미 등록된 이메일입니다.' },
        { status: 400 }
      )
    }

    // 비밀번호 해시
    const hashedPassword = await hash(adminPassword, 10)
    const now = new Date()

    // 트랜잭션으로 회사 + 관리자 동시 생성
    await withTransaction(async (connection) => {
      // 회사 생성
      await connection.execute(
        `INSERT INTO COMPANIES (ID, NAME, STATUS, PLAN_TYPE, CREATED_AT, UPDATED_AT)
         VALUES (:id, :name, :status, :planType, :createdAt, :updatedAt)`,
        {
          id: companyCode,
          name: companyName,
          status: 'ACTIVE',
          planType: 'BASIC',
          createdAt: now,
          updatedAt: now,
        },
        { autoCommit: false }
      )

      // 관리자 사용자 생성 (바로 승인 상태)
      await connection.execute(
        `INSERT INTO LS_USERS (NAME, EMAIL, PASSWORD, ROLE, STATUS, COMPANY_ID, CREATED_AT, APPROVED_AT)
         VALUES (:name, :email, :password, :role, :status, :companyId, :createdAt, :approvedAt)`,
        {
          name: adminName,
          email: adminEmail,
          password: hashedPassword,
          role: 'ADMIN',
          status: 'APPROVED',
          companyId: companyCode,
          createdAt: now,
          approvedAt: now,
        },
        { autoCommit: false }
      )

      // 기본 창고 생성
      await connection.execute(
        `INSERT INTO LS_WAREHOUSES (ID, NAME, SORT_ORDER, COMPANY_ID, CREATED_AT)
         VALUES (:id, :name, :sortOrder, :companyId, :createdAt)`,
        {
          id: `${companyCode}_WH1`,
          name: '기본 창고',
          sortOrder: 1,
          companyId: companyCode,
          createdAt: now,
        },
        { autoCommit: false }
      )
    })

    return NextResponse.json({
      success: true,
      message: '회사 등록이 완료되었습니다. 관리자 계정으로 바로 로그인하실 수 있습니다.',
      data: {
        companyCode,
        companyName,
        adminEmail,
      },
    })
  } catch (error) {
    console.error('Company register error:', error)
    return NextResponse.json(
      { success: false, message: '회사 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 회사 코드 중복 확인
export async function GET(request: NextRequest) {
  try {
    if (!isMultiTenantEnabled()) {
      return NextResponse.json(
        { success: false, message: '회사 등록 기능을 사용할 수 없습니다.' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.json(
        { success: false, message: '회사 코드를 입력해주세요.' },
        { status: 400 }
      )
    }

    const existing = await executeQuery<Company>(
      `SELECT ID FROM COMPANIES WHERE ID = :id`,
      { id: code.toUpperCase() }
    )

    return NextResponse.json({
      success: true,
      available: existing.length === 0,
    })
  } catch (error) {
    console.error('Company code check error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
