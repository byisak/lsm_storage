import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, AuthError } from '@/lib/auth'
import { importItems, importInventory } from '@/lib/data-import'

// 데이터 가져오기
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null
    const skipDuplicates = formData.get('skipDuplicates') === 'true'
    const updateExisting = formData.get('updateExisting') === 'true'

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'CSV 파일이 필요합니다.' },
        { status: 400 }
      )
    }

    if (!type || !['items', 'inventory'].includes(type)) {
      return NextResponse.json(
        { success: false, message: '유효한 가져오기 유형(items 또는 inventory)이 필요합니다.' },
        { status: 400 }
      )
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: '파일 크기는 5MB 이하여야 합니다.' },
        { status: 400 }
      )
    }

    // 파일 타입 확인
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json(
        { success: false, message: 'CSV 파일만 지원합니다.' },
        { status: 400 }
      )
    }

    // 파일 내용 읽기
    const csvContent = await file.text()

    const options = {
      skipDuplicates,
      updateExisting,
    }

    let result

    if (type === 'items') {
      result = await importItems(csvContent, options)
    } else {
      result = await importInventory(csvContent, options)
    }

    return NextResponse.json({
      success: result.success,
      message: `${result.importedRows}건이 처리되었습니다.`,
      result: {
        totalRows: result.totalRows,
        importedRows: result.importedRows,
        skippedRows: result.skippedRows,
        errors: result.errors.slice(0, 100), // 최대 100개 오류만 반환
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Import error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '데이터 가져오기 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
