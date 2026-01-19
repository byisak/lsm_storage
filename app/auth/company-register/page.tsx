'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Mail,
  Lock,
  User,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Box,
  Building2,
  Check,
  X
} from 'lucide-react'

export default function CompanyRegisterPage() {
  const router = useRouter()

  // 회사 정보
  const [companyCode, setCompanyCode] = useState('')
  const [companyName, setCompanyName] = useState('')

  // 관리자 정보
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  // 상태
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [multiTenantEnabled, setMultiTenantEnabled] = useState(false)
  const [configLoading, setConfigLoading] = useState(true)

  // 회사 코드 유효성 검사
  const [codeChecking, setCodeChecking] = useState(false)
  const [codeAvailable, setCodeAvailable] = useState<boolean | null>(null)

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

  // 회사 코드 중복 확인 (디바운스)
  useEffect(() => {
    if (companyCode.length < 3) {
      setCodeAvailable(null)
      return
    }

    const timer = setTimeout(async () => {
      setCodeChecking(true)
      try {
        const res = await fetch(`/api/company/register?code=${companyCode}`)
        const data = await res.json()
        if (data.success) {
          setCodeAvailable(data.available)
        }
      } catch {
        setCodeAvailable(null)
      } finally {
        setCodeChecking(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [companyCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 유효성 검증
    if (adminPassword !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (adminPassword.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }

    if (companyCode.length < 3) {
      setError('회사 코드는 최소 3자 이상이어야 합니다.')
      return
    }

    if (codeAvailable === false) {
      setError('이미 사용 중인 회사 코드입니다.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/company/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyCode: companyCode.toUpperCase(),
          companyName,
          adminName,
          adminEmail,
          adminPassword,
        }),
      })
      const data = await res.json()

      if (data.success) {
        setSuccess(true)
      } else {
        setError(data.message)
      }
    } catch {
      setError('회사 등록 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-full max-w-sm">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">회사 등록 완료</h2>
              <p className="text-muted-foreground text-sm mb-4">
                회사 등록이 완료되었습니다.<br />
                관리자 계정으로 바로 로그인하실 수 있습니다.
              </p>
              <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left">
                <p className="text-sm text-muted-foreground mb-1">회사 코드</p>
                <p className="font-mono font-bold text-foreground">{companyCode}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  직원들이 회원가입할 때 이 코드를 사용합니다.
                </p>
              </div>
              <Button
                onClick={() => router.push('/auth/login')}
                className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600"
              >
                로그인하기
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

  // 멀티테넌트 모드가 아니면 안내 메시지
  if (!multiTenantEnabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-full max-w-sm">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">서비스 준비 중</h2>
              <p className="text-muted-foreground text-sm mb-6">
                현재 신규 회사 등록 기능을 사용할 수 없습니다.<br />
                관리자에게 문의해주세요.
              </p>
              <Button
                onClick={() => router.push('/auth/login')}
                variant="outline"
                className="w-full h-12 rounded-xl"
              >
                로그인 페이지로
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl mb-4">
            <Box className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">LS Mecapion</h1>
          <p className="text-muted-foreground text-sm mt-1">재고관리 시스템</p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-2 text-center">신규 회사 등록</h2>
            <p className="text-muted-foreground text-sm mb-6 text-center">
              새로운 회사를 등록하고 재고관리를 시작하세요
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* 회사 정보 섹션 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  회사 정보
                </h3>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    회사 코드 <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      value={companyCode}
                      onChange={(e) => setCompanyCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      placeholder="COMPANY (영문대문자+숫자)"
                      className="pl-11 pr-10 h-12 rounded-xl uppercase"
                      required
                      minLength={3}
                      maxLength={20}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {codeChecking && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
                      {!codeChecking && codeAvailable === true && <Check className="w-5 h-5 text-green-500" />}
                      {!codeChecking && codeAvailable === false && <X className="w-5 h-5 text-red-500" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    직원들이 회원가입할 때 사용할 고유 코드입니다.
                    {codeAvailable === false && (
                      <span className="text-destructive"> 이미 사용 중인 코드입니다.</span>
                    )}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    회사명 <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="회사명"
                      className="pl-11 h-12 rounded-xl"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 관리자 정보 섹션 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <User className="w-4 h-4" />
                  관리자 계정
                </h3>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    관리자 이름 <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="관리자 이름"
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
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
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
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
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
              </div>

              <Button
                type="submit"
                disabled={loading || codeAvailable === false}
                className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '회사 등록하기'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                이미 회사 코드가 있으신가요?{' '}
                <Link href="/auth/register" className="text-orange-500 font-medium hover:underline">
                  직원 회원가입
                </Link>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
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
