'use client'

import { useEffect } from 'react'
import { X, ChevronRight, User, LogOut, Shield, Warehouse, Undo2, UserCog } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth()

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

  const handleLogout = async () => {
    onClose()
    await logout()
  }

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
          {/* 사용자 카드 */}
          {user ? (
            // 로그인 상태
            <div className="bg-zinc-800 dark:bg-zinc-900 rounded-2xl p-4">
              <Link
                href="/settings/profile"
                onClick={onClose}
                className="flex items-center gap-3 mb-3 group"
              >
                <div className="bg-orange-500 p-2 rounded-full">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-base">{user.name}</h3>
                  <p className="text-zinc-400 text-sm">{user.email}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-1 transition-all" />
              </Link>
              <div className="flex gap-2">
                <Link
                  href="/settings/profile"
                  onClick={onClose}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-zinc-300 text-sm transition-colors"
                >
                  <UserCog className="w-4 h-4" />
                  내 정보
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-zinc-300 text-sm transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
              </div>
            </div>
          ) : (
            // 비로그인 상태
            <Link href="/auth/login" onClick={onClose}>
              <div className="bg-zinc-800 dark:bg-zinc-900 rounded-2xl p-4 flex items-center justify-between group hover:bg-zinc-700 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="bg-zinc-700 dark:bg-zinc-800 p-2 rounded-full">
                    <User className="w-5 h-5 text-zinc-400" />
                  </div>
                  <h3 className="text-orange-500 font-bold text-base">로그인/회원가입</h3>
                </div>
                <ChevronRight className="w-6 h-6 text-orange-500 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          )}

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
              href="/transaction/undo"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors"
            >
              <Undo2 className="w-4 h-4 text-red-500" />
              <span className="text-foreground">되돌리기</span>
            </Link>
            <Link
              href="/settings"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors"
            >
              <span className="text-foreground">설정</span>
            </Link>

            {/* 관리자 메뉴 */}
            {user?.role === 'ADMIN' && (
              <>
                <div className="border-t border-border my-3" />
                <p className="px-3 py-1 text-xs text-muted-foreground font-medium">관리자</p>
                <Link
                  href="/admin/users"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors"
                >
                  <Shield className="w-4 h-4 text-orange-500" />
                  <span className="text-foreground">회원 관리</span>
                </Link>
                <Link
                  href="/settings/warehouse"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors"
                >
                  <Warehouse className="w-4 h-4 text-orange-500" />
                  <span className="text-foreground">창고 설정</span>
                </Link>
              </>
            )}
          </nav>
        </div>
      </aside>
    </>
  )
}
