import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import {
  exportInventory,
  exportTransactions,
  exportItems,
  ExportFormat,
} from '@/lib/data-export'

// 데이터 내보내기
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'inventory'
    const format = (searchParams.get('format') || 'csv') as ExportFormat
    const warehouseId = searchParams.get('warehouseId') || undefined
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const options = {
      format,
      warehouseId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    }

    let result: { data: string; filename: string; contentType: string }

    switch (type) {
      case 'inventory':
        result = await exportInventory(options)
        break
      case 'transactions':
        result = await exportTransactions(options)
        break
      case 'items':
        result = await exportItems(options)
        break
      default:
        return NextResponse.json(
          { success: false, message: '지원하지 않는 내보내기 유형입니다.' },
          { status: 400 }
        )
    }

    // 파일 다운로드 응답
    const response = new NextResponse(result.data)
    response.headers.set('Content-Type', result.contentType)
    response.headers.set(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(result.filename)}"`
    )
    return response
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Export error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '데이터 내보내기 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
