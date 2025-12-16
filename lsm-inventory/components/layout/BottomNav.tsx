'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, PackagePlus, ClipboardList, Undo2 } from 'lucide-react'

const navItems = [
  { href: '/', label: '홈', icon: Home },
  { href: '/transaction/in', label: '입고', icon: PackagePlus },
  { href: '/transaction/undo', label: '되돌리기', icon: Undo2 },
  { href: '/transaction/history', label: '이력', icon: ClipboardList },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${
                isActive ? 'bg-accent' : ''
              }`}>
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              </div>
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
