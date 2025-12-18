'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Loader2,
  Building2,
  Save,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  MapPin,
  Palette,
  Image as ImageIcon
} from 'lucide-react'

interface CompanySettings {
  id: string
  name: string
  status: string
  planType: string
  logoUrl?: string
  themeColor?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  createdAt?: string
}

export default function CompanySettingsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [company, setCompany] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // 폼 상태
  const [name, setName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [themeColor, setThemeColor] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')

  // 관리자 권한 확인
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/')
    }
  }, [user, authLoading, router])

  // 회사 정보 로드
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchCompanySettings()
    }
  }, [user])

  const fetchCompanySettings = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/company/settings')
      const data = await res.json()
      if (data.success) {
        setCompany(data.company)
        setName(data.company.name || '')
        setLogoUrl(data.company.logoUrl || '')
        setThemeColor(data.company.themeColor || '#f97316')
        setContactEmail(data.company.contactEmail || '')
        setContactPhone(data.company.contactPhone || '')
        setAddress(data.company.address || '')
      }
    } catch (error) {
      console.error('Failed to fetch company settings:', error)
      setError('회사 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setSaving(true)

    try {
      const res = await fetch('/api/company/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          logoUrl,
          themeColor,
          contactEmail,
          contactPhone,
          address,
        }),
      })
      const data = await res.json()

      if (data.success) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(data.message)
      }
    } catch {
      setError('설정 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getPlanLabel = (plan?: string) => {
    switch (plan) {
      case 'BASIC': return '기본'
      case 'STANDARD': return '스탠다드'
      case 'PREMIUM': return '프리미엄'
      case 'ENTERPRISE': return '엔터프라이즈'
      default: return plan || '-'
    }
  }

  if (authLoading || !user || user.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 pb-8">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-5 h-5 text-orange-500" />
          <h1 className="text-xl font-bold text-foreground">회사 설정</h1>
        </div>
        <p className="text-sm text-muted-foreground">회사 정보 및 브랜딩 설정</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* 회사 기본 정보 카드 */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                회사 정보
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">회사 코드</span>
                  <span className="font-mono font-semibold text-foreground">{company?.id}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">상태</span>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                    company?.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                  }`}>
                    {company?.status === 'ACTIVE' ? '활성' : company?.status}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">요금제</span>
                  <span className="text-sm font-medium text-foreground">{getPlanLabel(company?.planType)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">등록일</span>
                  <span className="text-sm text-foreground">{formatDate(company?.createdAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 설정 폼 */}
          <form onSubmit={handleSave}>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  브랜딩 설정
                </h2>

                {error && (
                  <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 p-3 mb-4 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-400 text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    설정이 저장되었습니다.
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      회사명 <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="회사명"
                        className="pl-11 h-12 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">로고 URL</label>
                    <div className="relative">
                      <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="url"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className="pl-11 h-12 rounded-xl"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      로고 이미지 URL을 입력하세요 (권장 크기: 200x200px)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">테마 색상</label>
                    <div className="flex gap-3">
                      <input
                        type="color"
                        value={themeColor}
                        onChange={(e) => setThemeColor(e.target.value)}
                        className="w-12 h-12 rounded-xl border border-border cursor-pointer"
                      />
                      <div className="flex-1 relative">
                        <Palette className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          type="text"
                          value={themeColor}
                          onChange={(e) => setThemeColor(e.target.value)}
                          placeholder="#f97316"
                          className="pl-11 h-12 rounded-xl font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm mt-4">
              <CardContent className="p-4">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  연락처 정보
                </h2>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">대표 이메일</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="contact@company.com"
                        className="pl-11 h-12 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">대표 전화번호</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="02-1234-5678"
                        className="pl-11 h-12 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">주소</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="서울시 강남구 ..."
                        className="pl-11 h-12 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              disabled={saving}
              className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium mt-4"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  설정 저장
                </>
              )}
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
