'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Clock, Box } from 'lucide-react'

export default function PendingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl mb-4">
            <Box className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">LS Mecapion</h1>
          <p className="text-muted-foreground text-sm mt-1">재고관리 시스템</p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">승인 대기 중</h2>
            <p className="text-muted-foreground text-sm mb-6">
              관리자 승인 후 서비스 이용이 가능합니다.<br />
              승인이 완료되면 로그인해 주세요.
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
