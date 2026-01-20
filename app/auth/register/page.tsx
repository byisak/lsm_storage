'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Mail, Lock, User, Loader2, AlertCircle, CheckCircle2, Building2 } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [companyCode, setCompanyCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [multiTenantEnabled, setMultiTenantEnabled] = useState(false)
  const [configLoading, setConfigLoading] = useState(true)

  // 멀티테넌트 모드 확인
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const res = await fetch('/api/config')
        const data = await res.json()
        if (data.success) {
          setMultiTenantEnabled(data.config.multiTenantEnabled)
        }
      } catch {
        // 설정 로드 실패시 기본값 사용
      } finally {
        setConfigLoading(false)
      }
    }
    checkConfig()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 비밀번호 확인
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }

    // 멀티테넌트 모드에서 회사 코드 필수
    if (multiTenantEnabled && !companyCode.trim()) {
      setError('회사 코드를 입력해주세요.')
      return
    }

    setLoading(true)

    try {
      const body: Record<string, string> = { name, email, password }
      if (multiTenantEnabled && companyCode.trim()) {
        body.companyCode = companyCode.trim().toUpperCase()
      }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.success) {
        setSuccess(true)
      } else {
        setError(data.message)
      }
    } catch {
      setError('회원가입 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-full max-w-sm">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">회원가입 완료</h2>
              <p className="text-muted-foreground text-sm mb-6">
                관리자 승인 후 로그인이 가능합니다.<br />
                승인 완료 시 이메일로 알려드립니다.
              </p>
              <Button
                onClick={() => router.push('/auth/login')}
                className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600"
              >
                로그인 페이지로
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (configLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 bg-background">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-foreground">LS Mecapion</h1>
          <p className="text-muted-foreground text-sm mt-1">재고관리 시스템</p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <h2 className="text-xl font-bold text-foreground mb-6 text-center">회원가입</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* 멀티테넌트 모드에서만 회사 코드 표시 */}
              {multiTenantEnabled && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    회사 코드 <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      value={companyCode}
                      onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                      placeholder="회사 코드 (예: LSMECA)"
                      className="pl-11 h-12 rounded-xl uppercase"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    회사 관리자에게 받은 코드를 입력하세요.{' '}
                    <Link href="/auth/company-register" className="text-orange-500 hover:underline">
                      신규 회사 등록
                    </Link>
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  이름 <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="이름"
                    className="pl-11 h-12 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  이메일 <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="이메일 주소"
                    className="pl-11 h-12 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  비밀번호 <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 (6자 이상)"
                    className="pl-11 h-12 rounded-xl"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  비밀번호 확인 <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="비밀번호 확인"
                    className="pl-11 h-12 rounded-xl"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium mt-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '회원가입'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                이미 계정이 있으신가요?{' '}
                <Link href="/auth/login" className="text-orange-500 font-medium hover:underline">
                  로그인
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
