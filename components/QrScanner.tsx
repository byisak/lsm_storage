'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Camera, Loader2, Package, MapPin, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface RackItem {
  id: number
  storage: string
  location: string
  itemCode: string
  itemName: string
  nowQty: number
  inDay: string | null
  remark: string | null
}

interface ScanResult {
  success: boolean
  storage?: string
  location?: string
  items?: RackItem[]
  count?: number
  message?: string
}

interface QrScannerProps {
  isOpen: boolean
  onClose: () => void
  onItemSelect?: (item: RackItem) => void
}

export function QrScanner({ isOpen, onClose, onItemSelect }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Start camera
  const startCamera = async () => {
    try {
      setCameraError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setScanning(true)
        startScanning()
      }
    } catch (err) {
      console.error('Camera error:', err)
      setCameraError('카메라에 접근할 수 없습니다. 카메라 권한을 확인해주세요.')
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    setScanning(false)
  }

  // Start scanning for QR codes
  const startScanning = () => {
    if (scanIntervalRef.current) return

    // Dynamically import jsQR
    import('jsqr').then(({ default: jsQR }) => {
      scanIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return

        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')

        if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)

        if (code) {
          handleScan(code.data)
        }
      }, 200)
    }).catch(err => {
      console.error('Failed to load jsQR:', err)
      setCameraError('QR 스캐너를 로드할 수 없습니다.')
    })
  }

  // Handle scanned QR code
  const handleScan = async (data: string) => {
    // Stop scanning while processing
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }

    setLoading(true)
    setError(null)

    try {
      // Format: "1|A-01-A1"
      const res = await fetch(`/api/rack/scan?q=${encodeURIComponent(data)}`)
      const json: ScanResult = await res.json()

      if (json.success) {
        setResult(json)
        stopCamera()
      } else {
        setError(json.message || '스캔 결과를 처리할 수 없습니다.')
        // Resume scanning
        startScanning()
      }
    } catch (err) {
      setError('서버 오류가 발생했습니다.')
      // Resume scanning
      startScanning()
    } finally {
      setLoading(false)
    }
  }

  // Reset and scan again
  const resetScan = () => {
    setResult(null)
    setError(null)
    startCamera()
  }

  // Cleanup on unmount or close
  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
      setResult(null)
      setError(null)
    }

    return () => {
      stopCamera()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
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
        {!result ? (
          <>
            {/* Camera view */}
            <div className="relative w-full max-w-sm aspect-square bg-black rounded-2xl overflow-hidden">
              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
                  <AlertCircle className="w-12 h-12 mb-4 text-red-400" />
                  <p className="text-center text-sm">{cameraError}</p>
                  <Button
                    onClick={startCamera}
                    className="mt-4"
                    variant="secondary"
                  >
                    다시 시도
                  </Button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Scan frame overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-white/50 rounded-lg">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
                    </div>
                  </div>

                  {loading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                </>
              )}
            </div>

            <p className="text-white/70 text-sm mt-4 text-center">
              랙의 QR 코드를 스캔해주세요
            </p>

            {error && (
              <div className="mt-4 p-3 bg-red-500/20 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}
          </>
        ) : (
          /* Scan result */
          <div className="w-full max-w-md">
            <Card className="border-0 shadow-xl">
              <CardContent className="p-4">
                {/* Location info */}
                <div className="flex items-center gap-2 mb-4 pb-4 border-b">
                  <MapPin className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">위치</p>
                    <p className="font-bold">{result.storage} / {result.location}</p>
                  </div>
                </div>

                {/* Items list */}
                {result.items && result.items.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {result.count}개의 자재가 있습니다
                    </p>
                    {result.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => onItemSelect?.(item)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.itemName}</p>
                            <p className="text-xs text-muted-foreground">{item.itemCode}</p>
                            <p className="text-sm font-bold text-primary mt-1">
                              {item.nowQty}개
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-muted-foreground">이 위치에 자재가 없습니다</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={resetScan}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    다시 스캔
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={onClose}
                  >
                    닫기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
