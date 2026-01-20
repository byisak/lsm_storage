'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, AlertCircle, Keyboard, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface QrScannerProps {
  isOpen: boolean
  onClose: () => void
  onScanSuccess?: (storageId: string, location: string) => void
}

interface QrLocation {
  topLeftCorner: { x: number; y: number }
  topRightCorner: { x: number; y: number }
  bottomLeftCorner: { x: number; y: number }
  bottomRightCorner: { x: number; y: number }
}

export function QrScanner({ isOpen, onClose, onScanSuccess }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastScanRef = useRef<string>('')
  const lastScanTimeRef = useRef<number>(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualCode, setManualCode] = useState('')

  // Draw QR code boundary - 노란색 두꺼운 테두리
  const drawBoundary = useCallback((location: QrLocation) => {
    const overlayCanvas = overlayCanvasRef.current
    const video = videoRef.current
    if (!overlayCanvas || !video) return

    const ctx = overlayCanvas.getContext('2d')
    if (!ctx) return

    // 비디오와 캔버스 크기 동기화
    const videoRect = video.getBoundingClientRect()
    overlayCanvas.width = video.videoWidth
    overlayCanvas.height = video.videoHeight

    // 스케일 계산 (비디오 좌표 → 캔버스 좌표)
    const scaleX = video.videoWidth / videoRect.width
    const scaleY = video.videoHeight / videoRect.height

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

    // QR 코드 테두리 그리기 - 노란색 선 + 반투명 채우기
    ctx.beginPath()
    ctx.moveTo(location.topLeftCorner.x, location.topLeftCorner.y)
    ctx.lineTo(location.topRightCorner.x, location.topRightCorner.y)
    ctx.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y)
    ctx.lineTo(location.bottomLeftCorner.x, location.bottomLeftCorner.y)
    ctx.closePath()

    // 반투명 노란색 채우기
    ctx.fillStyle = 'rgba(250, 204, 21, 0.3)'
    ctx.fill()

    // 노란색 테두리
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 6
    ctx.stroke()
  }, [])

  // Clear boundary
  const clearBoundary = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current
    if (!overlayCanvas) return
    const ctx = overlayCanvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
  }, [])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

  // Handle scanned QR code
  const handleScan = useCallback((data: string, location?: QrLocation) => {
    const now = Date.now()
    if (data === lastScanRef.current && now - lastScanTimeRef.current < 2000) {
      if (location) drawBoundary(location)
      return
    }
    lastScanRef.current = data
    lastScanTimeRef.current = now

    // QR 코드 테두리 표시
    if (location) drawBoundary(location)

    const parts = data.split('|')
    if (parts.length >= 2) {
      const storageId = parts[0].trim()
      const locationVal = parts[1].trim()

      // 딜레이 후 닫기 (테두리 확인용)
      setTimeout(() => {
        stopCamera()
        onScanSuccess?.(storageId, locationVal)
        onClose()
      }, 400)
    } else {
      setError('잘못된 QR 코드 형식입니다. (예: 03|A-01-A1)')
      clearBoundary()
    }
  }, [stopCamera, onScanSuccess, onClose, drawBoundary, clearBoundary])

  // Start scanning with jsQR
  const startScanning = useCallback(() => {
    if (animationFrameRef.current) return

    import('jsqr').then(({ default: jsQR }) => {
      const scan = () => {
        if (!videoRef.current || !canvasRef.current) {
          animationFrameRef.current = requestAnimationFrame(scan)
          return
        }

        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
          animationFrameRef.current = requestAnimationFrame(scan)
          return
        }

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        let code = null

        // 1차: 중앙 70% 영역만 스캔 (십자가 근처)
        const smallCropSize = Math.min(canvas.width, canvas.height) * 0.7
        const smallCropX = (canvas.width - smallCropSize) / 2
        const smallCropY = (canvas.height - smallCropSize) / 2
        const smallData = ctx.getImageData(smallCropX, smallCropY, smallCropSize, smallCropSize)
        code = jsQR(smallData.data, smallData.width, smallData.height, {
          inversionAttempts: 'attemptBoth',
        })

        if (code && code.location) {
          // 좌표 보정
          code.location.topLeftCorner.x += smallCropX
          code.location.topLeftCorner.y += smallCropY
          code.location.topRightCorner.x += smallCropX
          code.location.topRightCorner.y += smallCropY
          code.location.bottomLeftCorner.x += smallCropX
          code.location.bottomLeftCorner.y += smallCropY
          code.location.bottomRightCorner.x += smallCropX
          code.location.bottomRightCorner.y += smallCropY
        }

        // 2차: 실패 시 중앙 90% 영역 스캔
        if (!code && canvas.width > 300 && canvas.height > 300) {
          const largeCropSize = Math.min(canvas.width, canvas.height) * 0.9
          const largeCropX = (canvas.width - largeCropSize) / 2
          const largeCropY = (canvas.height - largeCropSize) / 2
          const largeData = ctx.getImageData(largeCropX, largeCropY, largeCropSize, largeCropSize)
          code = jsQR(largeData.data, largeData.width, largeData.height, {
            inversionAttempts: 'attemptBoth',
          })

          if (code && code.location) {
            code.location.topLeftCorner.x += largeCropX
            code.location.topLeftCorner.y += largeCropY
            code.location.topRightCorner.x += largeCropX
            code.location.topRightCorner.y += largeCropY
            code.location.bottomLeftCorner.x += largeCropX
            code.location.bottomLeftCorner.y += largeCropY
            code.location.bottomRightCorner.x += largeCropX
            code.location.bottomRightCorner.y += largeCropY
          }
        }

        if (code && code.data) {
          handleScan(code.data, code.location)
        } else {
          clearBoundary()
        }

        animationFrameRef.current = requestAnimationFrame(scan)
      }

      animationFrameRef.current = requestAnimationFrame(scan)
    }).catch(err => {
      console.error('Failed to load jsQR:', err)
      setCameraError('QR 스캐너를 로드할 수 없습니다.')
    })
  }, [handleScan, clearBoundary])

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null)
      setError(null)
      setLoading(true)

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('이 브라우저는 카메라를 지원하지 않습니다.')
        setLoading(false)
        return
      }

      let stream: MediaStream | null = null

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }
        })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          })
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true
          })
        }
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setLoading(false)
        startScanning()
      }
    } catch (err: unknown) {
      console.error('Camera error:', err)
      setLoading(false)
      const error = err as { name?: string }
      if (error.name === 'NotAllowedError') {
        setCameraError('카메라 권한이 거부되었습니다.')
      } else if (error.name === 'NotFoundError') {
        setCameraError('카메라를 찾을 수 없습니다.')
      } else if (error.name === 'NotReadableError') {
        setCameraError('카메라가 다른 앱에서 사용 중입니다.')
      } else {
        setCameraError('카메라에 접근할 수 없습니다.')
      }
    }
  }, [startScanning])

  // Handle manual code input
  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      const parts = manualCode.trim().split('|')
      if (parts.length >= 2) {
        const storageId = parts[0].trim()
        const location = parts[1].trim()
        stopCamera()
        onScanSuccess?.(storageId, location)
        onClose()
      } else {
        stopCamera()
        onScanSuccess?.('', manualCode.trim())
        onClose()
      }
    }
  }

  // Cleanup
  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
      setError(null)
      setShowManualInput(false)
      setManualCode('')
      clearBoundary()
    }

    return () => {
      stopCamera()
    }
  }, [isOpen, startCamera, stopCamera, clearBoundary])

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
            stopCamera()
            onClose()
          }}
          className="text-white hover:bg-white/20"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-black rounded-2xl overflow-hidden">
          {cameraError || showManualInput ? (
            <div className="aspect-[3/4] flex flex-col items-center justify-center text-white p-4">
              {!showManualInput ? (
                <>
                  <AlertCircle className="w-12 h-12 mb-4 text-red-400" />
                  <p className="text-center text-sm mb-4">{cameraError}</p>
                  <div className="flex flex-col gap-2">
                    <Button onClick={startCamera} variant="secondary">
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
                        startCamera()
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
              <video
                ref={videoRef}
                className="w-full aspect-[3/4] object-cover rounded-2xl"
                playsInline
                muted
                autoPlay
              />
              <canvas ref={canvasRef} className="hidden" />
              {/* QR 테두리 오버레이 캔버스 */}
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ objectFit: 'cover' }}
              />

              {/* 중앙 플러스 표시 */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Plus className="w-16 h-16 text-white/50" strokeWidth={1} />
              </div>

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
                    stopCamera()
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
          랙의 QR 코드를 중앙에 맞춰주세요
        </p>

        {error && (
          <div className="mt-4 p-3 bg-red-500/20 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
