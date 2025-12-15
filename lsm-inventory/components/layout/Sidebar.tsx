'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, User, LogIn } from 'lucide-react'
import Link from 'next/link'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* 오버레이 */}
      <div
        className="fixed inset-0 bg-black/50 z-[60] transition-opacity"
        onClick={onClose}
      />

      {/* 사이드바 */}
      <aside className="fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-background z-[70] shadow-2xl transform transition-transform duration-300 ease-out">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">메뉴</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="p-4 space-y-4">
          {/* 로그인/회원가입 카드 */}
          <Link href="/auth/login" onClick={onClose}>
            <div className="bg-zinc-800 dark:bg-zinc-900 rounded-2xl p-4 flex items-center justify-between group hover:bg-zinc-700 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="bg-zinc-700 dark:bg-zinc-800 p-2 rounded-full">
                  <User className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <h3 className="text-orange-500 font-bold text-base">로그인/회원가입</h3>
                  <p className="text-zinc-400 text-sm mt-0.5">로그인하여 실시간 서버 전송을 이용해보세요</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-orange-500 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 구분선 */}
          <div className="border-t border-border my-4" />

          {/* 추가 메뉴 항목들 */}
          <nav className="space-y-1">
            <Link
              href="/"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors"
            >
              <span className="text-foreground">재고 검색</span>
            </Link>
            <Link
              href="/transaction/in"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors"
            >
              <span className="text-foreground">입고</span>
            </Link>
            <Link
              href="/transaction/history"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors"
            >
              <span className="text-foreground">이력</span>
            </Link>
            <Link
              href="/settings"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors"
            >
              <span className="text-foreground">설정</span>
            </Link>
          </nav>
        </div>
      </aside>
    </>
  )
}
