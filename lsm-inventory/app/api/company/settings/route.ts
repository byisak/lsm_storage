import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, Company } from '@/lib/postgres'
import { getSession } from '@/lib/auth'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'

// 회사 설정 조회
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    if (!isMultiTenantEnabled()) {
      // 단일 테넌트 모드: 기본 정보 반환
      return NextResponse.json({
        success: true,
        company: {
          id: 'LSMECA',
          name: 'LS Mecapion',
          status: 'ACTIVE',
          planType: 'ENTERPRISE',
        },
      })
    }

    const companies = await executeQuery<Company>(
      `SELECT ID, NAME, STATUS, PLAN_TYPE, LOGO_URL, THEME_COLOR, CONTACT_EMAIL, CONTACT_PHONE, ADDRESS, CREATED_AT, UPDATED_AT
       FROM COMPANIES WHERE ID = :id`,
      { id: session.companyId }
    )

    if (companies.length === 0) {
      return NextResponse.json(
        { success: false, message: '회사 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const company = companies[0]

    return NextResponse.json({
      success: true,
      company: {
        id: company.ID,
        name: company.NAME,
        status: company.STATUS,
        planType: company.PLAN_TYPE,
        logoUrl: company.LOGO_URL,
        themeColor: company.THEME_COLOR,
        contactEmail: company.CONTACT_EMAIL,
        contactPhone: company.CONTACT_PHONE,
        address: company.ADDRESS,
        createdAt: company.CREATED_AT,
        updatedAt: company.UPDATED_AT,
      },
    })
  } catch (error) {
    console.error('Company settings error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 회사 설정 업데이트
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 관리자만 회사 설정 수정 가능
    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    if (!isMultiTenantEnabled()) {
      return NextResponse.json(
        { success: false, message: '회사 설정 기능을 사용할 수 없습니다.' },
        { status: 400 }
      )
    }

    const data = await request.json()
    const { name, logoUrl, themeColor, contactEmail, contactPhone, address } = data

    // 필수 값 검증
    if (!name) {
      return NextResponse.json(
        { success: false, message: '회사명은 필수입니다.' },
        { status: 400 }
      )
    }

    const now = new Date()

    await executeQuery(
      `UPDATE COMPANIES
       SET NAME = :name,
           LOGO_URL = :logoUrl,
           THEME_COLOR = :themeColor,
           CONTACT_EMAIL = :contactEmail,
           CONTACT_PHONE = :contactPhone,
           ADDRESS = :address,
           UPDATED_AT = :updatedAt
       WHERE ID = :id`,
      {
        id: session.companyId,
        name,
        logoUrl: logoUrl || null,
        themeColor: themeColor || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        address: address || null,
        updatedAt: now,
      }
    )

    return NextResponse.json({
      success: true,
      message: '회사 설정이 업데이트되었습니다.',
    })
  } catch (error) {
    console.error('Company settings update error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
