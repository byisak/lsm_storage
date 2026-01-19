'use client'

import { usePathname } from 'next/navigation'
import { MobileHeader } from './MobileHeader'
import { BottomNav } from './BottomNav'

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = pathname.startsWith('/auth')

  if (isAuthPage) {
    return <>{children}</>
  }

  return (
    <>
      <MobileHeader />
      <main className="pt-14 pb-24 min-h-screen">
        {children}
      </main>
      <BottomNav />
    </>
  )
}
