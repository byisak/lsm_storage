'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, AlertCircle, Keyboard } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface QrScannerProps {
  isOpen: boolean
  onClose: () => void
  onScanSuccess?: (storageId: string, location: string) => void
}

export function QrScanner({ isOpen, onClose, onScanSuccess }: QrScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const html5QrCodeRef = useRef<any>(null)
  const lastScanRef = useRef<string>('')
  const lastScanTimeRef = useRef<number>(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualCode, setManualCode] = useState('')

  // Handle scanned QR code
  const handleScan = useCallback((data: string) => {
    // 중복 스캔 방지 (2초 내 같은 코드)
    const now = Date.now()
    if (data === lastScanRef.current && now - lastScanTimeRef.current < 2000) {
      return
    }
    lastScanRef.current = data
    lastScanTimeRef.current = now

    // Format: "03|A-03-B2" -> storageId = "03", location = "A-03-B2"
    const parts = data.split('|')
    if (parts.length >= 2) {
      const storageId = parts[0].trim()
      const locationVal = parts[1].trim()

      // 스캐너 정지 후 콜백
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().then(() => {
          onScanSuccess?.(storageId, locationVal)
          onClose()
        }).catch(() => {
          onScanSuccess?.(storageId, locationVal)
          onClose()
        })
      } else {
        onScanSuccess?.(storageId, locationVal)
        onClose()
      }
    } else {
      setError('잘못된 QR 코드 형식입니다. (예: 03|A-01-A1)')
    }
  }, [onScanSuccess, onClose])

  // Start scanner
  const startScanner = useCallback(async () => {
    if (!scannerRef.current) return

    setLoading(true)
    setCameraError(null)
    setError(null)

    try {
      const { Html5Qrcode } = await import('html5-qrcode')

      // 이전 인스턴스 정리
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop()
        } catch {
          // ignore
        }
      }

      const html5QrCode = new Html5Qrcode('qr-reader')
      html5QrCodeRef.current = html5QrCode

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        // 실험적 기능: 더 나은 인식률
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      }

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleScan(decodedText)
        },
        () => {
          // QR 코드 미검출 시 - 무시
        }
      )

      setLoading(false)
    } catch (err: unknown) {
      console.error('Scanner error:', err)
      setLoading(false)

      const error = err as { name?: string; message?: string }
      if (error.name === 'NotAllowedError' || error.message?.includes('Permission')) {
        setCameraError('카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.')
      } else if (error.name === 'NotFoundError' || error.message?.includes('not found')) {
        setCameraError('카메라를 찾을 수 없습니다.')
      } else if (error.name === 'NotReadableError' || error.message?.includes('in use')) {
        setCameraError('카메라가 다른 앱에서 사용 중입니다.')
      } else {
        setCameraError('카메라에 접근할 수 없습니다.')
      }
    }
  }, [handleScan])

  // Stop scanner
  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop()
      } catch {
        // ignore
      }
      html5QrCodeRef.current = null
    }
  }, [])

  // Handle manual code input
  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      const parts = manualCode.trim().split('|')
      if (parts.length >= 2) {
        const storageId = parts[0].trim()
        const location = parts[1].trim()
        stopScanner()
        onScanSuccess?.(storageId, location)
        onClose()
      } else {
        // 위치만 입력한 경우
        stopScanner()
        onScanSuccess?.('', manualCode.trim())
        onClose()
      }
    }
  }

  // Cleanup on unmount or close
  useEffect(() => {
    if (isOpen) {
      // 약간의 딜레이 후 스캐너 시작 (DOM 렌더링 대기)
      const timer = setTimeout(() => {
        startScanner()
      }, 100)
      return () => clearTimeout(timer)
    } else {
      stopScanner()
      setError(null)
      setShowManualInput(false)
      setManualCode('')
    }
  }, [isOpen, startScanner, stopScanner])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [stopScanner])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <h2 className="text-lg font-bold">QR 코드 스캔</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            stopScanner()
            onClose()
          }}
          className="text-white hover:bg-white/20"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Camera view */}
        <div className="relative w-full max-w-md bg-black rounded-2xl overflow-hidden">
          {cameraError || showManualInput ? (
            <div className="aspect-[3/4] flex flex-col items-center justify-center text-white p-4">
              {!showManualInput ? (
                <>
                  <AlertCircle className="w-12 h-12 mb-4 text-red-400" />
                  <p className="text-center text-sm mb-4">{cameraError}</p>
                  <div className="flex flex-col gap-2">
                    <Button onClick={startScanner} variant="secondary">
                      다시 시도
                    </Button>
                    <Button
                      onClick={() => setShowManualInput(true)}
                      variant="outline"
                      className="text-white border-white/30 hover:bg-white/10"
                    >
                      <Keyboard className="w-4 h-4 mr-2" />
                      직접 입력
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Keyboard className="w-12 h-12 mb-4 text-blue-400" />
                  <p className="text-center text-sm mb-4">QR 코드 값을 입력하세요</p>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="예: 03|A-03-B2"
                    className="w-full max-w-xs px-4 py-3 rounded-lg bg-white/10 border border-white/30 text-white placeholder-white/50 text-center text-lg"
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => {
                        setShowManualInput(false)
                        startScanner()
                      }}
                      variant="outline"
                      className="text-white border-white/30 hover:bg-white/10"
                    >
                      카메라로
                    </Button>
                    <Button
                      onClick={handleManualSubmit}
                      disabled={!manualCode.trim()}
                    >
                      확인
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {/* QR Scanner container */}
              <div
                id="qr-reader"
                ref={scannerRef}
                className="w-full"
                style={{ minHeight: '400px' }}
              />

              {loading && (
                <div className="absolute inset-0 bg-black flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm">카메라 시작 중...</p>
                  </div>
                </div>
              )}

              {/* 하단 직접입력 버튼 */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <Button
                  onClick={() => {
                    stopScanner()
                    setShowManualInput(true)
                  }}
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white"
                >
                  <Keyboard className="w-4 h-4 mr-2" />
                  직접 입력
                </Button>
              </div>
            </>
          )}
        </div>

        <p className="text-white/70 text-sm mt-4 text-center">
          랙의 QR 코드를 프레임 안에 맞춰주세요
        </p>

        {error && (
          <div className="mt-4 p-3 bg-red-500/20 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* html5-qrcode 스타일 오버라이드 */}
      <style jsx global>{`
        #qr-reader {
          border: none !important;
          width: 100% !important;
        }
        #qr-reader video {
          width: 100% !important;
          height: auto !important;
          object-fit: cover !important;
          border-radius: 16px !important;
        }
        #qr-reader__scan_region {
          min-height: 400px !important;
        }
        #qr-reader__scan_region video {
          border-radius: 16px !important;
        }
        #qr-reader__dashboard {
          display: none !important;
        }
        #qr-reader__dashboard_section {
          display: none !important;
        }
        #qr-reader__dashboard_section_swaplink {
          display: none !important;
        }
        #qr-reader__status_span {
          display: none !important;
        }
        /* QR 스캔 박스 스타일 */
        #qr-shaded-region {
          border-color: rgba(34, 197, 94, 0.8) !important;
        }
      `}</style>
    </div>
  )
}
