'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, PackagePlus, ClipboardList, ScanLine } from 'lucide-react'
import { useSettings } from '@/lib/settings-context'
import { QrScanner } from '@/components/QrScanner'

const navItems = [
  { href: '/', label: '홈', icon: Home },
  { href: '/transaction/in', label: '입고', icon: PackagePlus },
  { href: '/transaction/history', label: '이력', icon: ClipboardList },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { settings } = useSettings()
  const [showScanner, setShowScanner] = useState(false)

  // 스캔 성공 시 홈페이지로 이동하면서 창고ID와 위치 전달
  const handleScanSuccess = (storageId: string, location: string) => {
    setShowScanner(false)
    // 홈페이지로 이동하면서 창고ID와 랙 검색 값 전달
    const params = new URLSearchParams()
    params.set('rackSearch', location)
    if (storageId) {
      params.set('storageId', storageId)
    }
    router.push(`/?${params.toString()}`)
  }

  return (
    <>
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-1 px-2 py-2 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-full shadow-lg border border-white/20 dark:border-zinc-700/50">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center px-5 py-2 rounded-full transition-all ${
                  isActive
                    ? 'bg-white/80 dark:bg-zinc-700/80 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[10px] mt-0.5 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* QR Scan Button - conditionally shown */}
          {settings.showQrScanButton && (
            <button
              onClick={() => setShowScanner(true)}
              className="flex flex-col items-center justify-center px-5 py-2 rounded-full transition-all text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-zinc-700/50"
            >
              <ScanLine className="w-5 h-5" strokeWidth={2} />
              <span className="text-[10px] mt-0.5 font-medium">스캔</span>
            </button>
          )}
        </div>
      </nav>

      {/* QR Scanner Modal */}
      <QrScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScanSuccess}
      />
    </>
  )
}
