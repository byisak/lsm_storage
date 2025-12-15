'use client'

import { Box } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

export function MobileHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/50 dark:bg-slate-950/50 backdrop-blur-xl backdrop-saturate-150 px-4 py-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-lg">
            <Box className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              LS Mecapion
            </h1>
            <p className="text-[10px] text-white/70 -mt-0.5">재고관리 시스템</p>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}
