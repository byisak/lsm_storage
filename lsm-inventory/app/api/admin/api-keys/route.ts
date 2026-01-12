import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, AuthError } from '@/lib/auth'
import { checkFeature } from '@/lib/plan-limits'
import { isMultiTenantEnabled } from '@/lib/multi-tenant'
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  deleteApiKey,
  updateApiKeyPermissions,
  ApiKeyPermission,
} from '@/lib/api-keys'

// API 키 목록 조회
export async function GET() {
  try {
    await requireAdmin()

    // 멀티테넌트 모드에서 API 접근 기능 확인
    if (isMultiTenantEnabled()) {
      const apiAccessEnabled = await checkFeature('apiAccess')
      if (!apiAccessEnabled) {
        return NextResponse.json(
          {
            success: false,
            message: 'API 접근 기능은 프리미엄 이상 요금제에서 사용할 수 있습니다.',
            upgradeRequired: true,
          },
          { status: 403 }
        )
      }
    }

    const keys = await listApiKeys()

    return NextResponse.json({
      success: true,
      apiKeys: keys.map((key) => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        permissions: key.permissions,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        status: key.status,
        createdAt: key.createdAt,
      })),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('API keys fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'API 키 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// API 키 생성
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    // 멀티테넌트 모드에서 API 접근 기능 확인
    if (isMultiTenantEnabled()) {
      const apiAccessEnabled = await checkFeature('apiAccess')
      if (!apiAccessEnabled) {
        return NextResponse.json(
          {
            success: false,
            message: 'API 접근 기능은 프리미엄 이상 요금제에서 사용할 수 있습니다.',
            upgradeRequired: true,
          },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const { name, permissions, expiresInDays } = body

    if (!name) {
      return NextResponse.json(
        { success: false, message: 'API 키 이름은 필수입니다.' },
        { status: 400 }
      )
    }

    // 권한 검증
    const validPermissions: ApiKeyPermission[] = ['READ', 'WRITE', 'DELETE']
    const requestedPermissions = permissions || ['READ']
    for (const perm of requestedPermissions) {
      if (!validPermissions.includes(perm)) {
        return NextResponse.json(
          { success: false, message: `잘못된 권한입니다: ${perm}` },
          { status: 400 }
        )
      }
    }

    const { apiKey, keyInfo } = await createApiKey({
      name,
      permissions: requestedPermissions,
      expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : undefined,
    })

    return NextResponse.json({
      success: true,
      message: 'API 키가 생성되었습니다. 이 키는 한 번만 표시됩니다.',
      apiKey, // 전체 키 (한 번만 표시)
      keyInfo: {
        id: keyInfo.id,
        name: keyInfo.name,
        keyPrefix: keyInfo.keyPrefix,
        permissions: keyInfo.permissions,
        expiresAt: keyInfo.expiresAt,
        status: keyInfo.status,
        createdAt: keyInfo.createdAt,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('API key create error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'API 키 생성 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

// API 키 수정 (권한 변경)
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { keyId, permissions, action } = body

    if (!keyId) {
      return NextResponse.json(
        { success: false, message: 'API 키 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 비활성화 액션
    if (action === 'revoke') {
      const success = await revokeApiKey(keyId)
      if (!success) {
        return NextResponse.json(
          { success: false, message: 'API 키를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }
      return NextResponse.json({
        success: true,
        message: 'API 키가 비활성화되었습니다.',
      })
    }

    // 권한 업데이트
    if (permissions) {
      const validPermissions: ApiKeyPermission[] = ['READ', 'WRITE', 'DELETE']
      for (const perm of permissions) {
        if (!validPermissions.includes(perm)) {
          return NextResponse.json(
            { success: false, message: `잘못된 권한입니다: ${perm}` },
            { status: 400 }
          )
        }
      }

      const success = await updateApiKeyPermissions(keyId, permissions)
      if (!success) {
        return NextResponse.json(
          { success: false, message: 'API 키를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }
      return NextResponse.json({
        success: true,
        message: 'API 키 권한이 업데이트되었습니다.',
      })
    }

    return NextResponse.json(
      { success: false, message: '유효한 액션이나 권한을 지정해주세요.' },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('API key update error:', error)
    return NextResponse.json(
      { success: false, message: 'API 키 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// API 키 삭제
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('keyId')

    if (!keyId) {
      return NextResponse.json(
        { success: false, message: 'API 키 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const success = await deleteApiKey(parseInt(keyId, 10))
    if (!success) {
      return NextResponse.json(
        { success: false, message: 'API 키를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'API 키가 삭제되었습니다.',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('API key delete error:', error)
    return NextResponse.json(
      { success: false, message: 'API 키 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
