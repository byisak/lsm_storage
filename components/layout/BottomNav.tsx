'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, PackagePlus, ClipboardList } from 'lucide-react'

const navItems = [
  { href: '/', label: '홈', icon: Home },
  { href: '/transaction/in', label: '입고', icon: PackagePlus },
  { href: '/transaction/history', label: '이력', icon: ClipboardList },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
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
      </div>
    </nav>
  )
}
