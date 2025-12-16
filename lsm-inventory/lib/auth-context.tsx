'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface User {
  id: number
  name: string
  email: string
  role: 'USER' | 'ADMIN'
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; message: string; status?: string }>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

// 인증이 필요 없는 경로
const publicPaths = ['/auth/login', '/auth/register', '/auth/pending']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (data.success && data.user) {
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()

    if (data.success) {
      setUser(data.user)
      router.push('/')
    }

    return data
  }

  const logout = async () => {
    await fetch('/api/auth/me', { method: 'DELETE' })
    setUser(null)
    router.push('/auth/login')
  }

  useEffect(() => {
    checkAuth()
  }, [])

  // 인증 상태에 따른 리다이렉션
  useEffect(() => {
    if (loading) return

    const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

    if (!user && !isPublicPath) {
      // 로그인 필요
      router.push('/auth/login')
    } else if (user && isPublicPath && pathname !== '/auth/pending') {
      // 이미 로그인된 상태에서 로그인/회원가입 페이지 접근
      router.push('/')
    }
  }, [user, loading, pathname, router])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
