'use client'

import { useState } from 'react'
import { Box, Menu } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Sidebar } from '@/components/layout/Sidebar'
import { useAuth } from '@/lib/auth-context'
import Image from 'next/image'

export function MobileHeader() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { company } = useAuth()

  // 회사명 (기본값: LS Mecapion)
  const companyName = company?.name || 'LS Mecapion'

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/50 dark:bg-slate-950/50 backdrop-blur-xl backdrop-saturate-150 px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 햄버거 메뉴 버튼 */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center gap-2">
              {company?.logoUrl ? (
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/20">
                  <Image
                    src={company.logoUrl}
                    alt={companyName}
                    width={32}
                    height={32}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="bg-white/20 p-1.5 rounded-lg">
                  <Box className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-base font-bold text-white tracking-tight">
                  {companyName}
                </h1>
                <p className="text-[10px] text-white/70 -mt-0.5">재고관리 시스템</p>
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* 사이드바 */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  )
}
