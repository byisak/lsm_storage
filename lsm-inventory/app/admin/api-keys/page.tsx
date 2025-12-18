'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Loader2,
  Key,
  Plus,
  Copy,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  AlertTriangle,
} from 'lucide-react'

interface ApiKey {
  id: number
  name: string
  keyPrefix: string
  permissions: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  status: string
  createdAt: string
}

export default function AdminApiKeysPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['READ'])
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [upgradeRequired, setUpgradeRequired] = useState(false)

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/')
    }
  }, [user, authLoading, router, isAdmin])

  useEffect(() => {
    if (isAdmin) {
      fetchApiKeys()
    }
  }, [user, isAdmin])

  const fetchApiKeys = async () => {
    try {
      const res = await fetch('/api/admin/api-keys')
      const data = await res.json()
      if (data.success) {
        setApiKeys(data.apiKeys)
        setUpgradeRequired(false)
      } else if (data.upgradeRequired) {
        setUpgradeRequired(true)
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      setMessage({ type: 'error', text: 'API 키 이름을 입력해주세요.' })
      return
    }

    setCreating(true)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName,
          permissions: newKeyPermissions,
        }),
      })
      const data = await res.json()

      if (data.success) {
        setCreatedKey(data.apiKey)
        setMessage({ type: 'success', text: '키가 생성되었습니다. 이 키는 한 번만 표시됩니다!' })
        await fetchApiKeys()
        setNewKeyName('')
        setNewKeyPermissions(['READ'])
      } else {
        setMessage({ type: 'error', text: data.message })
      }
    } catch {
      setMessage({ type: 'error', text: 'API 키 생성 중 오류가 발생했습니다.' })
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (keyId: number) => {
    setDeletingId(keyId)
    try {
      const res = await fetch(`/api/admin/api-keys?keyId=${keyId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        setApiKeys((prev) => prev.filter((k) => k.id !== keyId))
        setMessage({ type: 'success', text: '삭제되었습니다.' })
      } else {
        setMessage({ type: 'error', text: data.message })
      }
    } catch {
      setMessage({ type: 'error', text: '삭제 중 오류가 발생했습니다.' })
    } finally {
      setDeletingId(null)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleRevoke = async (keyId: number) => {
    setDeletingId(keyId)
    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId, action: 'revoke' }),
      })
      const data = await res.json()
      if (data.success) {
        setApiKeys((prev) =>
          prev.map((k) => (k.id === keyId ? { ...k, status: 'REVOKED' } : k))
        )
        setMessage({ type: 'success', text: '비활성화되었습니다.' })
      }
    } catch {
      setMessage({ type: 'error', text: '비활성화 중 오류가 발생했습니다.' })
    } finally {
      setDeletingId(null)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setMessage({ type: 'success', text: '클립보드에 복사되었습니다.' })
    setTimeout(() => setMessage(null), 2000)
  }

  const togglePermission = (perm: string) => {
    setNewKeyPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (authLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // 업그레이드 필요
  if (upgradeRequired) {
    return (
      <div className="p-4 pb-8">
        <div className="mb-6">
          <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="w-4 h-4" />
            관리자 홈
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-bold text-foreground">API 키 관리</h1>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-lg font-bold mb-2">프리미엄 기능</h2>
            <p className="text-muted-foreground mb-4">
              API 키 기능은 프리미엄 이상 요금제에서 사용할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 pb-8">
      {/* 헤더 */}
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="w-4 h-4" />
          관리자 홈
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <Key className="w-5 h-5 text-amber-500" />
          <h1 className="text-xl font-bold text-foreground">API 키 관리</h1>
        </div>
        <p className="text-sm text-muted-foreground">외부 시스템 연동을 위한 API 키 관리</p>
      </div>

      {/* 메시지 */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 border ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* 생성된 키 표시 */}
      {createdKey && (
        <Card className="border-0 shadow-sm mb-4 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
              생성된 API 키 (한 번만 표시됩니다):
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white dark:bg-black/30 p-2 rounded text-xs font-mono break-all">
                {createdKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(createdKey)}
                className="shrink-0"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreatedKey(null)}
              className="mt-2 text-muted-foreground"
            >
              닫기
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 새 키 생성 폼 */}
      {showCreateForm ? (
        <Card className="border-0 shadow-sm mb-4">
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">새 API 키 생성</h3>
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="API 키 이름 (용도 설명)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="h-11"
              />
              <div>
                <p className="text-sm text-muted-foreground mb-2">권한 선택:</p>
                <div className="flex gap-2">
                  {['READ', 'WRITE', 'DELETE'].map((perm) => (
                    <button
                      key={perm}
                      onClick={() => togglePermission(perm)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        newKeyPermissions.includes(perm)
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {perm}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  생성
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  취소
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          onClick={() => setShowCreateForm(true)}
          className="w-full mb-4 h-11 bg-amber-600 hover:bg-amber-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          새 API 키 생성
        </Button>
      )}

      {/* API 키 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : apiKeys.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">등록된 API 키가 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {apiKeys.map((key) => (
            <Card key={key.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium">{key.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">
                      {key.keyPrefix}...
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      key.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                  >
                    {key.status === 'ACTIVE' ? '활성' : '비활성'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  {key.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="text-xs px-2 py-0.5 bg-muted rounded"
                    >
                      {perm}
                    </span>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground mb-3">
                  <span>생성: {formatDate(key.createdAt)}</span>
                  {key.lastUsedAt && <span className="ml-3">마지막 사용: {formatDate(key.lastUsedAt)}</span>}
                </div>

                <div className="flex gap-2">
                  {key.status === 'ACTIVE' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevoke(key.id)}
                      disabled={deletingId === key.id}
                      className="flex-1 text-orange-500 border-orange-200 hover:bg-orange-50 dark:border-orange-900"
                    >
                      {deletingId === key.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Shield className="w-4 h-4 mr-1" />
                          비활성화
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(key.id)}
                    disabled={deletingId === key.id}
                    className="flex-1 text-red-500 border-red-200 hover:bg-red-50 dark:border-red-900"
                  >
                    {deletingId === key.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-1" />
                        삭제
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
