'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useWarehouses } from '@/lib/warehouse-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Loader2,
  Database,
  Download,
  Upload,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Package,
  History,
  AlertTriangle,
  FileUp,
} from 'lucide-react'

type ExportType = 'inventory' | 'transactions' | 'items'
type ImportType = 'items' | 'inventory'

interface ImportResult {
  totalRows: number
  importedRows: number
  skippedRows: number
  errors: string[]
}

export default function AdminDataPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { warehouses } = useWarehouses()

  // Export state
  const [exportType, setExportType] = useState<ExportType>('inventory')
  const [exportWarehouse, setExportWarehouse] = useState<string>('')
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')
  const [exporting, setExporting] = useState(false)

  // Import state
  const [importType, setImportType] = useState<ImportType>('items')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [updateExisting, setUpdateExisting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [upgradeRequired, setUpgradeRequired] = useState(false)

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/')
    }
  }, [user, authLoading, router, isAdmin])

  // Check feature availability
  useEffect(() => {
    const checkFeature = async () => {
      try {
        // Try a simple export to check feature availability
        const res = await fetch('/api/export?type=items')
        if (res.status === 403) {
          const data = await res.json()
          if (data.upgradeRequired) {
            setUpgradeRequired(true)
          }
        }
      } catch {
        // Ignore errors
      }
    }
    if (isAdmin) {
      checkFeature()
    }
  }, [isAdmin])

  const handleExport = async () => {
    setExporting(true)
    setMessage(null)

    try {
      const params = new URLSearchParams({
        type: exportType,
        format: 'csv',
      })

      if (exportWarehouse) {
        params.set('warehouseId', exportWarehouse)
      }
      if (exportStartDate) {
        params.set('startDate', exportStartDate)
      }
      if (exportEndDate) {
        params.set('endDate', exportEndDate)
      }

      const res = await fetch(`/api/export?${params.toString()}`)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || '내보내기 실패')
      }

      // Get filename from Content-Disposition header
      const disposition = res.headers.get('Content-Disposition')
      let filename = `export_${exportType}_${new Date().toISOString().split('T')[0]}.csv`
      if (disposition) {
        const match = disposition.match(/filename="(.+)"/)
        if (match) {
          filename = decodeURIComponent(match[1])
        }
      }

      // Download file
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setMessage({ type: 'success', text: '파일이 다운로드되었습니다.' })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '내보내기 중 오류가 발생했습니다.'
      })
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setMessage({ type: 'error', text: 'CSV 파일만 지원합니다.' })
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: '파일 크기는 5MB 이하여야 합니다.' })
        return
      }
      setImportFile(file)
      setImportResult(null)
      setMessage(null)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      setMessage({ type: 'error', text: '파일을 선택해주세요.' })
      return
    }

    setImporting(true)
    setMessage(null)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', importFile)
      formData.append('type', importType)
      formData.append('skipDuplicates', String(skipDuplicates))
      formData.append('updateExisting', String(updateExisting))

      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (data.success) {
        setImportResult(data.result)
        setMessage({ type: 'success', text: data.message })
        setImportFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        if (data.result) {
          setImportResult(data.result)
        }
        setMessage({ type: 'error', text: data.message })
      }
    } catch {
      setMessage({ type: 'error', text: '가져오기 중 오류가 발생했습니다.' })
    } finally {
      setImporting(false)
    }
  }

  if (authLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // 업그레이드 필요
  if (upgradeRequired) {
    return (
      <div className="p-4 pb-8">
        <div className="mb-6">
          <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="w-4 h-4" />
            관리자 홈
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5 text-blue-500" />
            <h1 className="text-xl font-bold text-foreground">데이터 관리</h1>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-lg font-bold mb-2">프리미엄 기능</h2>
            <p className="text-muted-foreground mb-4">
              데이터 가져오기/내보내기 기능은 스탠다드 이상 요금제에서 사용할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 pb-8">
      {/* 헤더 */}
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="w-4 h-4" />
          관리자 홈
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <Database className="w-5 h-5 text-blue-500" />
          <h1 className="text-xl font-bold text-foreground">데이터 관리</h1>
        </div>
        <p className="text-sm text-muted-foreground">데이터 내보내기 및 가져오기</p>
      </div>

      {/* 메시지 */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 border ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* 내보내기 섹션 */}
      <Card className="border-0 shadow-sm mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Download className="w-5 h-5 text-green-500" />
            <h2 className="font-bold">데이터 내보내기</h2>
          </div>

          <div className="space-y-3">
            {/* 내보내기 유형 선택 */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">내보내기 유형</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setExportType('inventory')}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    exportType === 'inventory'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400'
                      : 'bg-background border-border hover:bg-muted'
                  }`}
                >
                  <FileSpreadsheet className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs font-medium">재고현황</span>
                </button>
                <button
                  onClick={() => setExportType('transactions')}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    exportType === 'transactions'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400'
                      : 'bg-background border-border hover:bg-muted'
                  }`}
                >
                  <History className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs font-medium">입출고이력</span>
                </button>
                <button
                  onClick={() => setExportType('items')}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    exportType === 'items'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400'
                      : 'bg-background border-border hover:bg-muted'
                  }`}
                >
                  <Package className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs font-medium">품목목록</span>
                </button>
              </div>
            </div>

            {/* 필터 옵션 */}
            {exportType !== 'items' && (
              <>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">창고 선택 (선택사항)</label>
                  <select
                    value={exportWarehouse}
                    onChange={(e) => setExportWarehouse(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-border bg-background"
                  >
                    <option value="">전체 창고</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                {exportType === 'transactions' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">시작일</label>
                      <Input
                        type="date"
                        value={exportStartDate}
                        onChange={(e) => setExportStartDate(e.target.value)}
                        className="h-11"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">종료일</label>
                      <Input
                        type="date"
                        value={exportEndDate}
                        onChange={(e) => setExportEndDate(e.target.value)}
                        className="h-11"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <Button
              onClick={handleExport}
              disabled={exporting}
              className="w-full h-11 bg-green-600 hover:bg-green-700"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              CSV 다운로드
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 가져오기 섹션 */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="w-5 h-5 text-purple-500" />
            <h2 className="font-bold">데이터 가져오기</h2>
          </div>

          <div className="space-y-3">
            {/* 가져오기 유형 선택 */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">가져오기 유형</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setImportType('items')}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    importType === 'items'
                      ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-400'
                      : 'bg-background border-border hover:bg-muted'
                  }`}
                >
                  <Package className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs font-medium">품목 마스터</span>
                </button>
                <button
                  onClick={() => setImportType('inventory')}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    importType === 'inventory'
                      ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-400'
                      : 'bg-background border-border hover:bg-muted'
                  }`}
                >
                  <FileSpreadsheet className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs font-medium">재고 데이터</span>
                </button>
              </div>
            </div>

            {/* 파일 선택 */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">CSV 파일 선택</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  importFile
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-border hover:border-purple-500 hover:bg-muted'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {importFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileUp className="w-5 h-5 text-purple-500" />
                    <span className="font-medium">{importFile.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({(importFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">클릭하여 파일 선택</p>
                    <p className="text-xs text-muted-foreground mt-1">CSV 파일, 최대 5MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* 옵션 */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="w-4 h-4 rounded border-border"
                />
                <span className="text-sm">중복 건너뛰기</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="w-4 h-4 rounded border-border"
                />
                <span className="text-sm">기존 데이터 업데이트</span>
              </label>
            </div>

            <Button
              onClick={handleImport}
              disabled={importing || !importFile}
              className="w-full h-11 bg-purple-600 hover:bg-purple-700"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              데이터 가져오기
            </Button>

            {/* 가져오기 결과 */}
            {importResult && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p>전체 행: <span className="font-medium">{importResult.totalRows}</span></p>
                <p>처리됨: <span className="font-medium text-green-600">{importResult.importedRows}</span></p>
                <p>건너뜀: <span className="font-medium text-amber-600">{importResult.skippedRows}</span></p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-red-500 font-medium mb-1">오류:</p>
                    <ul className="text-xs text-red-500 space-y-0.5 max-h-32 overflow-y-auto">
                      {importResult.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                      {importResult.errors.length > 10 && (
                        <li>... 외 {importResult.errors.length - 10}건</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CSV 형식 안내 */}
      <div className="mt-4 text-xs text-muted-foreground">
        <p className="font-medium mb-1">CSV 형식 안내:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>품목 마스터: 품번, 품명, 규격, 단위, 메모</li>
          <li>재고 데이터: 품번, 창고ID, 위치, 수량</li>
          <li>파일 인코딩: UTF-8 (BOM 권장)</li>
        </ul>
      </div>
    </div>
  )
}
