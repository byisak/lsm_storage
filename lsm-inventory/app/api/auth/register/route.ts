import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { executeQuery, executeInsert, LsUser } from '@/lib/postgres'
import { isMultiTenantEnabled, DEFAULT_COMPANY_ID } from '@/lib/multi-tenant'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, companyCode } = body

    // 필수 필드 검증
    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, message: '이름, 이메일, 비밀번호는 필수입니다.' },
        { status: 400 }
      )
    }

    // 멀티테넌트 모드에서 회사 코드 필수
    if (isMultiTenantEnabled() && !companyCode) {
      return NextResponse.json(
        { success: false, message: '회사 코드를 입력해주세요.' },
        { status: 400 }
      )
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      )
    }

    // 비밀번호 최소 길이 검증
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: '비밀번호는 최소 6자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // 회사 ID 결정
    let companyId = DEFAULT_COMPANY_ID

    if (isMultiTenantEnabled()) {
      // 회사 코드 유효성 검증
      const companies = await executeQuery<{ ID: string; STATUS: string }>(
        `SELECT ID, STATUS FROM COMPANIES WHERE ID = :companyCode`,
        { companyCode: companyCode.toUpperCase() }
      )

      if (companies.length === 0) {
        return NextResponse.json(
          { success: false, message: '유효하지 않은 회사 코드입니다.' },
          { status: 400 }
        )
      }

      if (companies[0].STATUS !== 'ACTIVE') {
        return NextResponse.json(
          { success: false, message: '비활성화된 회사입니다.' },
          { status: 400 }
        )
      }

      companyId = companies[0].ID
    }

    // 이메일 중복 확인 (같은 회사 내에서)
    let existingUsers: LsUser[]

    if (isMultiTenantEnabled()) {
      existingUsers = await executeQuery<LsUser>(
        `SELECT ID FROM LS_USERS WHERE EMAIL = :email AND COMPANY_ID = :companyId`,
        { email: email.toLowerCase(), companyId }
      )
    } else {
      existingUsers = await executeQuery<LsUser>(
        `SELECT ID FROM LS_USERS WHERE EMAIL = :email`,
        { email: email.toLowerCase() }
      )
    }

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { success: false, message: '이미 등록된 이메일입니다.' },
        { status: 400 }
      )
    }

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10)

    // 회원 등록 (COMPANY_ID 포함)
    if (isMultiTenantEnabled()) {
      await executeInsert(
        `INSERT INTO LS_USERS (NAME, EMAIL, PASSWORD, STATUS, ROLE, COMPANY_ID)
         VALUES (:name, :email, :password, 'PENDING', 'USER', :companyId)`,
        {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          companyId,
        }
      )
    } else {
      await executeInsert(
        `INSERT INTO LS_USERS (NAME, EMAIL, PASSWORD, STATUS, ROLE)
         VALUES (:name, :email, :password, 'PENDING', 'USER')`,
        {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: hashedPassword,
        }
      )
    }

    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.',
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { success: false, message: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
