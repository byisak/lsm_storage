'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, AlertCircle, Keyboard } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface QrScannerProps {
  isOpen: boolean
  onClose: () => void
  onScanSuccess?: (storageId: string, location: string) => void  // 창고ID와 위치 전달
}

export function QrScanner({ isOpen, onClose, onScanSuccess }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastScanRef = useRef<string>('')
  const lastScanTimeRef = useRef<number>(0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualCode, setManualCode] = useState('')

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

  // Draw QR code boundary
  const drawBoundary = useCallback((location: { topLeftCorner: {x: number, y: number}, topRightCorner: {x: number, y: number}, bottomRightCorner: {x: number, y: number}, bottomLeftCorner: {x: number, y: number} }) => {
    const overlayCanvas = overlayCanvasRef.current
    if (!overlayCanvas) return

    const ctx = overlayCanvas.getContext('2d')
    if (!ctx) return

    // Clear previous drawing
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

    // Draw boundary
    ctx.beginPath()
    ctx.moveTo(location.topLeftCorner.x, location.topLeftCorner.y)
    ctx.lineTo(location.topRightCorner.x, location.topRightCorner.y)
    ctx.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y)
    ctx.lineTo(location.bottomLeftCorner.x, location.bottomLeftCorner.y)
    ctx.closePath()

    ctx.strokeStyle = '#22c55e'
    ctx.lineWidth = 4
    ctx.stroke()

    // Draw corner dots
    const corners = [location.topLeftCorner, location.topRightCorner, location.bottomRightCorner, location.bottomLeftCorner]
    corners.forEach(corner => {
      ctx.beginPath()
      ctx.arc(corner.x, corner.y, 8, 0, 2 * Math.PI)
      ctx.fillStyle = '#22c55e'
      ctx.fill()
    })
  }, [])

  // Clear boundary
  const clearBoundary = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current
    if (!overlayCanvas) return
    const ctx = overlayCanvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
  }, [])

  // Handle scanned QR code
  const handleScan = useCallback((data: string, location?: { topLeftCorner: {x: number, y: number}, topRightCorner: {x: number, y: number}, bottomRightCorner: {x: number, y: number}, bottomLeftCorner: {x: number, y: number} }) => {
    // 중복 스캔 방지 (1초 내 같은 코드)
    const now = Date.now()
    if (data === lastScanRef.current && now - lastScanTimeRef.current < 1000) {
      // 이미 스캔된 코드면 boundary만 그리기
      if (location) drawBoundary(location)
      return
    }
    lastScanRef.current = data
    lastScanTimeRef.current = now

    // Draw boundary on successful scan
    if (location) drawBoundary(location)

    // Format: "03|A-03-B2" -> storageId = "03", location = "A-03-B2"
    const parts = data.split('|')
    if (parts.length >= 2) {
      const storageId = parts[0].trim()
      const locationVal = parts[1].trim()

      // 약간의 딜레이 후 닫기 (boundary 표시 확인용)
      setTimeout(() => {
        stopCamera()
        onScanSuccess?.(storageId, locationVal)
        onClose()
      }, 300)
    } else {
      setError('잘못된 QR 코드 형식입니다. (예: 03|A-01-A1)')
      clearBoundary()
    }
  }, [stopCamera, onScanSuccess, onClose, drawBoundary, clearBoundary])

  // Start scanning with requestAnimationFrame
  const startScanning = useCallback(() => {
    if (animationFrameRef.current) return

    import('jsqr').then(({ default: jsQR }) => {
      const scan = () => {
        if (!videoRef.current || !canvasRef.current || !overlayCanvasRef.current) {
          animationFrameRef.current = requestAnimationFrame(scan)
          return
        }

        const video = videoRef.current
        const canvas = canvasRef.current
        const overlayCanvas = overlayCanvasRef.current
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
          animationFrameRef.current = requestAnimationFrame(scan)
          return
        }

        // 캔버스 크기를 비디오에 맞춤
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        overlayCanvas.width = video.videoWidth
        overlayCanvas.height = video.videoHeight

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })

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

  // Start camera with higher resolution
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null)
      setError(null)

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('이 브라우저는 카메라를 지원하지 않습니다.')
        return
      }

      let stream: MediaStream | null = null

      // 고해상도 후면 카메라 시도
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
        startScanning()
      }
    } catch (err: unknown) {
      console.error('Camera error:', err)
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
      setLoading(true)
      const parts = manualCode.trim().split('|')
      if (parts.length >= 2) {
        const storageId = parts[0].trim()
        const location = parts[1].trim()
        stopCamera()
        onScanSuccess?.(storageId, location)
        onClose()
      } else {
        // 위치만 입력한 경우
        stopCamera()
        onScanSuccess?.('', manualCode.trim())
        onClose()
      }
      setLoading(false)
    }
  }

  // Cleanup on unmount or close
  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
      setError(null)
      setShowManualInput(false)
      setManualCode('')
    }

    return () => {
      stopCamera()
    }
  }, [isOpen, startCamera, stopCamera])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <h2 className="text-lg font-bold">QR 코드 스캔</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Camera view */}
        <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-2xl overflow-hidden">
          {cameraError || showManualInput ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
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
                      disabled={!manualCode.trim() || loading}
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
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />
              <canvas ref={canvasRef} className="hidden" />
              {/* Overlay canvas for QR boundary */}
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />

              {/* Scan frame overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-64 h-64">
                  {/* 스캔 영역 표시 */}
                  <div className="absolute inset-0 border-2 border-white/30 rounded-lg" />
                  {/* 모서리 강조 */}
                  <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-white rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-white rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-white rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-white rounded-br-lg" />
                </div>
              </div>

              {/* 하단 직접입력 버튼 */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <Button
                  onClick={() => setShowManualInput(true)}
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
    </div>
  )
}
