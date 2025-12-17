# 멀티테넌트(다중 회사) 서비스 개발 계획

## 목차
1. [개요](#1-개요)
2. [현재 시스템 분석](#2-현재-시스템-분석)
3. [멀티테넌트 아키텍처 설계](#3-멀티테넌트-아키텍처-설계)
4. [데이터베이스 스키마 변경](#4-데이터베이스-스키마-변경)
5. [백엔드 API 수정](#5-백엔드-api-수정)
6. [프론트엔드 수정](#6-프론트엔드-수정)
7. [보안 고려사항](#7-보안-고려사항)
8. [마이그레이션 전략](#8-마이그레이션-전략)
9. [개발 우선순위 및 단계](#9-개발-우선순위-및-단계)

---

## 1. 개요

### 1.1 목표
현재 LS Mecapion 단일 회사용으로 구축된 재고관리 시스템을 다양한 회사가 가입하여 독립적으로 사용할 수 있는 **SaaS(Software as a Service)** 형태의 멀티테넌트 시스템으로 확장

### 1.2 핵심 요구사항
- 회사별 고유 ID 발급 및 관리
- 회사별 데이터 완전 격리
- 회사별 사용자 관리 (관리자, 일반 사용자)
- 회사별 커스터마이징 (로고, 이름, 설정 등)
- 기존 LS Mecapion 데이터 마이그레이션

### 1.3 멀티테넌트 방식 선택

| 방식 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **단일 DB, 공유 스키마** | 모든 테이블에 company_id 컬럼 추가 | 비용 효율적, 관리 용이 | 데이터 격리 주의 필요 |
| 단일 DB, 분리 스키마 | 회사별 스키마 분리 | 데이터 격리 우수 | 관리 복잡성 증가 |
| 회사별 DB | 회사별 별도 데이터베이스 | 완전한 격리 | 높은 비용, 복잡한 관리 |

**선택: 단일 DB, 공유 스키마 방식** (비용 효율성 + 관리 용이성)

---

## 2. 현재 시스템 분석

### 2.1 하드코딩된 부분 목록

| 파일 | 위치 | 내용 | 수정 필요 |
|------|------|------|----------|
| `app/layout.tsx` | 9-10줄 | title: "LS Mecapion - 재고관리" | 동적 회사명으로 변경 |
| `app/auth/login/page.tsx` | 헤더 | "LS Mecapion" | 동적 회사명으로 변경 |
| `app/auth/register/page.tsx` | 헤더 | "LS Mecapion" | 동적 회사명으로 변경 |
| `app/auth/pending/page.tsx` | 헤더 | "LS Mecapion" | 동적 회사명으로 변경 |
| `components/layout/MobileHeader.tsx` | 헤더 | "LS Mecapion" | 동적 회사명으로 변경 |
| `lib/warehouse-context.tsx` | 18-22줄 | 기본 창고 목록 | 회사별 창고로 변경 |
| `scripts/oracle-ddl.sql` | 전체 | LS_MOTOR_*, LS_USERS 테이블 | 회사 테이블 추가 |

### 2.2 현재 데이터베이스 테이블

```
LS_MOTOR_RACK      - 재고 마스터
LS_MOTOR_SUBUL     - 수불 이력
LS_MOTOR_ITEM      - 품목 마스터
LS_USERS           - 사용자
LS_WAREHOUSES      - 창고
```

---

## 3. 멀티테넌트 아키텍처 설계

### 3.1 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        프론트엔드 (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ 회사A 사용자  │  │ 회사B 사용자  │  │ 회사C 사용자  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Layer (Next.js API Routes)               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    인증 미들웨어                              │ │
│  │         (회사ID + 사용자ID 검증, 데이터 접근 제어)              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Oracle Database                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  COMPANIES   │  │    USERS     │  │  WAREHOUSES  │          │
│  │  (회사 정보)  │  │ (회사별 사용자)│  │ (회사별 창고) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    RACKS     │  │    SUBUL     │  │    ITEMS     │          │
│  │ (회사별 재고) │  │ (회사별 이력) │  │ (회사별 품목) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 회사 식별 방식

| 방식 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **세션 기반** | 로그인 시 회사 정보를 세션에 저장 | 구현 간단, 보안 우수 | - |
| 서브도메인 | company.domain.com | 직관적 | DNS 설정 복잡 |
| URL 경로 | domain.com/company/... | 구현 간단 | URL 복잡 |

**선택: 세션 기반 방식** (기존 인증 시스템 활용)

### 3.3 데이터 흐름

```
1. 회사 가입
   회사 정보 입력 → COMPANIES 테이블 생성 → 고유 회사 ID 발급

2. 사용자 가입
   회사 선택/코드 입력 → 회사 검증 → 사용자 생성 (COMPANY_ID 포함)

3. 로그인
   이메일/비밀번호 → 사용자 검증 → 세션 생성 (USER_ID + COMPANY_ID)

4. 데이터 접근
   API 요청 → 세션에서 COMPANY_ID 추출 → 모든 쿼리에 COMPANY_ID 필터 적용
```

---

## 4. 데이터베이스 스키마 변경

### 4.1 신규 테이블: COMPANIES (회사)

```sql
CREATE TABLE COMPANIES (
    ID              VARCHAR2(20) PRIMARY KEY,           -- 회사 고유 ID (예: COMP001)
    NAME            VARCHAR2(100) NOT NULL,             -- 회사명
    BUSINESS_NUMBER VARCHAR2(20),                       -- 사업자등록번호
    REPRESENTATIVE  VARCHAR2(50),                       -- 대표자명
    PHONE           VARCHAR2(20),                       -- 연락처
    EMAIL           VARCHAR2(100),                      -- 대표 이메일
    ADDRESS         VARCHAR2(200),                      -- 주소
    LOGO_URL        VARCHAR2(500),                      -- 회사 로고 URL
    STATUS          VARCHAR2(20) DEFAULT 'ACTIVE',      -- ACTIVE, SUSPENDED, DELETED
    PLAN_TYPE       VARCHAR2(20) DEFAULT 'BASIC',       -- BASIC, STANDARD, PREMIUM
    MAX_USERS       NUMBER DEFAULT 10,                  -- 최대 사용자 수
    MAX_WAREHOUSES  NUMBER DEFAULT 5,                   -- 최대 창고 수
    SUBSCRIPTION_START DATE,                            -- 구독 시작일
    SUBSCRIPTION_END   DATE,                            -- 구독 종료일
    CREATED_AT      DATE DEFAULT SYSDATE,               -- 생성일
    UPDATED_AT      DATE DEFAULT SYSDATE                -- 수정일
);

CREATE SEQUENCE COMPANY_SEQ START WITH 1 INCREMENT BY 1;

-- 회사 코드 생성 트리거 (선택적)
CREATE OR REPLACE TRIGGER TRG_COMPANY_CODE
BEFORE INSERT ON COMPANIES
FOR EACH ROW
WHEN (NEW.ID IS NULL)
BEGIN
    :NEW.ID := 'COMP' || LPAD(COMPANY_SEQ.NEXTVAL, 6, '0');
END;
/
```

### 4.2 기존 테이블 수정

#### 4.2.1 LS_USERS → USERS

```sql
-- 기존 테이블에 COMPANY_ID 컬럼 추가
ALTER TABLE LS_USERS ADD COMPANY_ID VARCHAR2(20);

-- 외래키 설정
ALTER TABLE LS_USERS ADD CONSTRAINT FK_USERS_COMPANY
    FOREIGN KEY (COMPANY_ID) REFERENCES COMPANIES(ID);

-- 인덱스 추가
CREATE INDEX IDX_USERS_COMPANY ON LS_USERS(COMPANY_ID);

-- 복합 유니크 제약조건 (같은 회사 내 이메일 중복 방지)
ALTER TABLE LS_USERS DROP CONSTRAINT UK_USERS_EMAIL;
ALTER TABLE LS_USERS ADD CONSTRAINT UK_USERS_EMAIL_COMPANY
    UNIQUE (EMAIL, COMPANY_ID);
```

#### 4.2.2 LS_WAREHOUSES → WAREHOUSES

```sql
-- COMPANY_ID 컬럼 추가
ALTER TABLE LS_WAREHOUSES ADD COMPANY_ID VARCHAR2(20);

-- 외래키 설정
ALTER TABLE LS_WAREHOUSES ADD CONSTRAINT FK_WAREHOUSES_COMPANY
    FOREIGN KEY (COMPANY_ID) REFERENCES COMPANIES(ID);

-- 인덱스 추가
CREATE INDEX IDX_WAREHOUSES_COMPANY ON LS_WAREHOUSES(COMPANY_ID);

-- 복합 유니크 제약조건 (같은 회사 내 창고ID 중복 방지)
ALTER TABLE LS_WAREHOUSES DROP CONSTRAINT PK_WAREHOUSES;
ALTER TABLE LS_WAREHOUSES ADD CONSTRAINT PK_WAREHOUSES
    PRIMARY KEY (ID, COMPANY_ID);
```

#### 4.2.3 LS_MOTOR_RACK → INVENTORY_RACK

```sql
-- COMPANY_ID 컬럼 추가
ALTER TABLE LS_MOTOR_RACK ADD COMPANY_ID VARCHAR2(20);

-- 외래키 설정
ALTER TABLE LS_MOTOR_RACK ADD CONSTRAINT FK_RACK_COMPANY
    FOREIGN KEY (COMPANY_ID) REFERENCES COMPANIES(ID);

-- 인덱스 추가 (회사별 조회 최적화)
CREATE INDEX IDX_RACK_COMPANY ON LS_MOTOR_RACK(COMPANY_ID);
CREATE INDEX IDX_RACK_COMPANY_STORAGE ON LS_MOTOR_RACK(COMPANY_ID, STORAGE);
CREATE INDEX IDX_RACK_COMPANY_ITEM ON LS_MOTOR_RACK(COMPANY_ID, ITEM_CODE);
```

#### 4.2.4 LS_MOTOR_SUBUL → INVENTORY_SUBUL

```sql
-- COMPANY_ID 컬럼 추가
ALTER TABLE LS_MOTOR_SUBUL ADD COMPANY_ID VARCHAR2(20);

-- 외래키 설정
ALTER TABLE LS_MOTOR_SUBUL ADD CONSTRAINT FK_SUBUL_COMPANY
    FOREIGN KEY (COMPANY_ID) REFERENCES COMPANIES(ID);

-- 인덱스 추가
CREATE INDEX IDX_SUBUL_COMPANY ON LS_MOTOR_SUBUL(COMPANY_ID);
CREATE INDEX IDX_SUBUL_COMPANY_TIME ON LS_MOTOR_SUBUL(COMPANY_ID, SUBUL_TIME);
```

#### 4.2.5 LS_MOTOR_ITEM → INVENTORY_ITEM

```sql
-- COMPANY_ID 컬럼 추가
ALTER TABLE LS_MOTOR_ITEM ADD COMPANY_ID VARCHAR2(20);

-- 외래키 설정
ALTER TABLE LS_MOTOR_ITEM ADD CONSTRAINT FK_ITEM_COMPANY
    FOREIGN KEY (COMPANY_ID) REFERENCES COMPANIES(ID);

-- 인덱스 추가
CREATE INDEX IDX_ITEM_COMPANY ON LS_MOTOR_ITEM(COMPANY_ID);
```

### 4.3 전체 ERD (Entity Relationship Diagram)

```
┌─────────────────────┐
│     COMPANIES       │
├─────────────────────┤
│ ID (PK)             │◄────────────────────────────────────┐
│ NAME                │                                     │
│ BUSINESS_NUMBER     │                                     │
│ STATUS              │                                     │
│ PLAN_TYPE           │                                     │
│ ...                 │                                     │
└─────────────────────┘                                     │
          │                                                 │
          │ 1:N                                             │
          ▼                                                 │
┌─────────────────────┐     ┌─────────────────────┐        │
│       USERS         │     │     WAREHOUSES      │        │
├─────────────────────┤     ├─────────────────────┤        │
│ ID (PK)             │     │ ID (PK)             │        │
│ COMPANY_ID (FK)─────┼─────│ COMPANY_ID (FK)─────┼────────┤
│ NAME                │     │ NAME                │        │
│ EMAIL               │     │ SORT_ORDER          │        │
│ PASSWORD            │     │ ...                 │        │
│ ROLE                │     └─────────────────────┘        │
│ STATUS              │                                     │
│ ...                 │                                     │
└─────────────────────┘                                     │
                                                            │
┌─────────────────────┐     ┌─────────────────────┐        │
│   INVENTORY_RACK    │     │   INVENTORY_SUBUL   │        │
├─────────────────────┤     ├─────────────────────┤        │
│ ID (PK)             │     │ ID (PK)             │        │
│ COMPANY_ID (FK)─────┼─────│ COMPANY_ID (FK)─────┼────────┤
│ STORAGE             │     │ STORAGE             │        │
│ LOCATION            │     │ LOCATION            │        │
│ ITEM_CODE           │     │ ITEM_CODE           │        │
│ ITEM_NAME           │     │ QTY                 │        │
│ NOW_QTY             │     │ CATEGORY            │        │
│ ...                 │     │ USER_ID             │        │
└─────────────────────┘     │ ...                 │        │
                            └─────────────────────┘        │
┌─────────────────────┐                                     │
│   INVENTORY_ITEM    │                                     │
├─────────────────────┤                                     │
│ IDX (PK)            │                                     │
│ COMPANY_ID (FK)─────┼─────────────────────────────────────┘
│ STORAGE             │
│ ITEM_CODE           │
│ ITEM_NAME           │
│ ...                 │
└─────────────────────┘
```

---

## 5. 백엔드 API 수정

### 5.1 인증 미들웨어 수정

**파일: `lib/auth-middleware.ts` (신규)**

```typescript
import { cookies } from 'next/headers'
import { executeQuery } from './oracle'

export interface AuthSession {
  userId: number
  companyId: string
  email: string
  name: string
  role: 'ADMIN' | 'USER' | 'SUPER_ADMIN'
  companyName: string
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('auth-session')

  if (!sessionCookie) return null

  try {
    const session = JSON.parse(sessionCookie.value)

    // 회사 정보 포함하여 사용자 조회
    const users = await executeQuery<AuthSession>(`
      SELECT
        u.ID as "userId",
        u.COMPANY_ID as "companyId",
        u.EMAIL as "email",
        u.NAME as "name",
        u.ROLE as "role",
        c.NAME as "companyName"
      FROM LS_USERS u
      JOIN COMPANIES c ON u.COMPANY_ID = c.ID
      WHERE u.ID = :userId
        AND u.STATUS = 'APPROVED'
        AND c.STATUS = 'ACTIVE'
    `, { userId: session.userId })

    return users[0] || null
  } catch {
    return null
  }
}

export function requireAuth(session: AuthSession | null): asserts session is AuthSession {
  if (!session) {
    throw new Error('Unauthorized')
  }
}

export function requireAdmin(session: AuthSession | null): asserts session is AuthSession {
  requireAuth(session)
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    throw new Error('Forbidden: Admin access required')
  }
}
```

### 5.2 API 라우트 수정 패턴

**기존 코드:**
```typescript
// app/api/rack/search/route.ts
const results = await executeQuery(`
  SELECT * FROM LS_MOTOR_RACK
  WHERE LOCATION LIKE :location
`, { location: `%${location}%` })
```

**수정 후:**
```typescript
// app/api/rack/search/route.ts
import { getAuthSession, requireAuth } from '@/lib/auth-middleware'

export async function GET(request: Request) {
  const session = await getAuthSession()
  requireAuth(session)

  const { searchParams } = new URL(request.url)
  const location = searchParams.get('location')

  // 회사 ID 필터 추가
  const results = await executeQuery(`
    SELECT * FROM LS_MOTOR_RACK
    WHERE COMPANY_ID = :companyId
      AND LOCATION LIKE :location
  `, {
    companyId: session.companyId,  // 세션에서 회사 ID 추출
    location: `%${location}%`
  })

  return Response.json(results)
}
```

### 5.3 수정이 필요한 API 목록

| API 경로 | 수정 내용 |
|----------|----------|
| `/api/auth/register` | 회사 선택/코드 입력 로직 추가 |
| `/api/auth/login` | 세션에 회사 정보 포함 |
| `/api/auth/me` | 회사 정보 반환 |
| `/api/admin/users` | 같은 회사 사용자만 조회 |
| `/api/warehouses` | 회사별 창고 필터링 |
| `/api/rack/*` | 모든 쿼리에 COMPANY_ID 필터 |
| `/api/item/*` | 모든 쿼리에 COMPANY_ID 필터 |
| `/api/transaction/*` | 모든 쿼리에 COMPANY_ID 필터 |

### 5.4 신규 API 추가

#### 5.4.1 회사 가입 API

**파일: `app/api/company/register/route.ts`**

```typescript
export async function POST(request: Request) {
  const body = await request.json()
  const { name, businessNumber, representative, phone, email, adminEmail, adminPassword, adminName } = body

  // 1. 회사 생성
  const companyId = await executeInsert(`
    INSERT INTO COMPANIES (NAME, BUSINESS_NUMBER, REPRESENTATIVE, PHONE, EMAIL)
    VALUES (:name, :businessNumber, :representative, :phone, :email)
    RETURNING ID INTO :id
  `, { name, businessNumber, representative, phone, email })

  // 2. 기본 관리자 계정 생성
  const hashedPassword = await bcrypt.hash(adminPassword, 10)
  await executeInsert(`
    INSERT INTO LS_USERS (COMPANY_ID, NAME, EMAIL, PASSWORD, ROLE, STATUS)
    VALUES (:companyId, :name, :email, :password, 'ADMIN', 'APPROVED')
  `, { companyId, name: adminName, email: adminEmail, password: hashedPassword })

  // 3. 기본 창고 생성 (선택적)
  await executeInsert(`
    INSERT INTO LS_WAREHOUSES (ID, COMPANY_ID, NAME, SORT_ORDER)
    VALUES ('1', :companyId, '기본 창고', 1)
  `, { companyId })

  return Response.json({ success: true, companyId })
}
```

#### 5.4.2 회사 정보 조회/수정 API

**파일: `app/api/company/route.ts`**

```typescript
// GET: 현재 회사 정보 조회
export async function GET(request: Request) {
  const session = await getAuthSession()
  requireAuth(session)

  const companies = await executeQuery(`
    SELECT * FROM COMPANIES WHERE ID = :companyId
  `, { companyId: session.companyId })

  return Response.json(companies[0])
}

// PUT: 회사 정보 수정 (관리자만)
export async function PUT(request: Request) {
  const session = await getAuthSession()
  requireAdmin(session)

  const body = await request.json()
  // ... 수정 로직
}
```

---

## 6. 프론트엔드 수정

### 6.1 회사 컨텍스트 추가

**파일: `lib/company-context.tsx` (신규)**

```typescript
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface Company {
  id: string
  name: string
  logoUrl?: string
  planType: string
}

interface CompanyContextType {
  company: Company | null
  isLoading: boolean
  refreshCompany: () => Promise<void>
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshCompany = async () => {
    try {
      const res = await fetch('/api/company')
      if (res.ok) {
        setCompany(await res.json())
      }
    } catch (error) {
      console.error('Failed to load company:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshCompany()
  }, [])

  return (
    <CompanyContext.Provider value={{ company, isLoading, refreshCompany }}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const context = useContext(CompanyContext)
  if (!context) throw new Error('useCompany must be used within CompanyProvider')
  return context
}
```

### 6.2 동적 브랜딩 적용

**파일: `app/layout.tsx` 수정**

```typescript
import { CompanyProvider } from '@/lib/company-context'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <CompanyProvider>
          <AuthProvider>
            <WarehouseProvider>
              {children}
            </WarehouseProvider>
          </AuthProvider>
        </CompanyProvider>
      </body>
    </html>
  )
}
```

**파일: `components/layout/MobileHeader.tsx` 수정**

```typescript
'use client'

import { useCompany } from '@/lib/company-context'

export function MobileHeader() {
  const { company } = useCompany()

  return (
    <header>
      {company?.logoUrl && <img src={company.logoUrl} alt={company.name} />}
      <h1>{company?.name || '재고관리'}</h1>
    </header>
  )
}
```

### 6.3 회사 가입 페이지 추가

**파일: `app/company/register/page.tsx` (신규)**

회사 가입 페이지 - 회사 정보 및 관리자 계정 입력 폼

### 6.4 회원가입 페이지 수정

**파일: `app/auth/register/page.tsx` 수정**

```typescript
// 회사 코드 입력 필드 추가
<div>
  <Label htmlFor="companyCode">회사 코드</Label>
  <Input
    id="companyCode"
    placeholder="가입하려는 회사 코드를 입력하세요"
    {...register('companyCode')}
  />
  <p className="text-sm text-muted-foreground">
    회사 코드는 회사 관리자에게 문의하세요
  </p>
</div>
```

### 6.5 회사 설정 페이지 추가

**파일: `app/settings/company/page.tsx` (신규)**

- 회사 정보 조회/수정
- 로고 업로드
- 구독 정보 확인
- 사용자 수/창고 수 현황

---

## 7. 보안 고려사항

### 7.1 데이터 격리

```typescript
// 모든 데이터 쿼리에 회사 ID 필수
const results = await executeQuery(`
  SELECT * FROM LS_MOTOR_RACK
  WHERE COMPANY_ID = :companyId  -- 필수!
    AND ...
`, { companyId: session.companyId })
```

### 7.2 권한 검증

```typescript
// 요청된 리소스가 현재 회사 소유인지 검증
async function verifyResourceOwnership(resourceId: number, companyId: string) {
  const result = await executeQuery(`
    SELECT COMPANY_ID FROM LS_MOTOR_RACK WHERE ID = :id
  `, { id: resourceId })

  if (result[0]?.COMPANY_ID !== companyId) {
    throw new Error('Forbidden: Resource does not belong to your company')
  }
}
```

### 7.3 API 보안 체크리스트

- [ ] 모든 API에 인증 검증 추가
- [ ] 모든 데이터 쿼리에 COMPANY_ID 필터 적용
- [ ] 리소스 수정/삭제 시 소유권 검증
- [ ] 관리자 전용 API에 권한 검증 추가
- [ ] Rate limiting 적용 (회사별)
- [ ] 로그에 회사 ID 포함하여 감사 추적

---

## 8. 마이그레이션 전략

### 8.1 기존 데이터 마이그레이션

```sql
-- 1. 기본 회사 생성 (LS Mecapion)
INSERT INTO COMPANIES (ID, NAME, STATUS, PLAN_TYPE)
VALUES ('LSMECA', 'LS Mecapion', 'ACTIVE', 'PREMIUM');

-- 2. 기존 사용자에 회사 ID 할당
UPDATE LS_USERS SET COMPANY_ID = 'LSMECA' WHERE COMPANY_ID IS NULL;

-- 3. 기존 창고에 회사 ID 할당
UPDATE LS_WAREHOUSES SET COMPANY_ID = 'LSMECA' WHERE COMPANY_ID IS NULL;

-- 4. 기존 재고에 회사 ID 할당
UPDATE LS_MOTOR_RACK SET COMPANY_ID = 'LSMECA' WHERE COMPANY_ID IS NULL;

-- 5. 기존 이력에 회사 ID 할당
UPDATE LS_MOTOR_SUBUL SET COMPANY_ID = 'LSMECA' WHERE COMPANY_ID IS NULL;

-- 6. 기존 품목에 회사 ID 할당
UPDATE LS_MOTOR_ITEM SET COMPANY_ID = 'LSMECA' WHERE COMPANY_ID IS NULL;

-- 7. NOT NULL 제약조건 추가
ALTER TABLE LS_USERS MODIFY COMPANY_ID NOT NULL;
ALTER TABLE LS_WAREHOUSES MODIFY COMPANY_ID NOT NULL;
ALTER TABLE LS_MOTOR_RACK MODIFY COMPANY_ID NOT NULL;
ALTER TABLE LS_MOTOR_SUBUL MODIFY COMPANY_ID NOT NULL;
ALTER TABLE LS_MOTOR_ITEM MODIFY COMPANY_ID NOT NULL;
```

### 8.2 무중단 배포 전략

```
Phase 1: 준비 (서비스 영향 없음)
├── COMPANIES 테이블 생성
├── 기존 테이블에 COMPANY_ID 컬럼 추가 (NULL 허용)
└── 인덱스 생성

Phase 2: 데이터 마이그레이션 (서비스 영향 없음)
├── 기본 회사 생성
└── 기존 데이터에 COMPANY_ID 할당

Phase 3: 코드 배포 (점진적)
├── 백엔드 API 수정 배포
├── 프론트엔드 수정 배포
└── 테스트 및 검증

Phase 4: 마무리
├── NOT NULL 제약조건 추가
└── 외래키 활성화
```

---

## 9. 개발 우선순위 및 단계

### Phase 1: 기반 구축 (핵심)

1. **데이터베이스 스키마 수정**
   - COMPANIES 테이블 생성
   - 기존 테이블에 COMPANY_ID 추가
   - 인덱스 및 제약조건 설정

2. **인증 시스템 확장**
   - 세션에 회사 정보 포함
   - 인증 미들웨어 수정
   - 회사별 권한 검증

3. **기존 API 수정**
   - 모든 API에 COMPANY_ID 필터 적용
   - 리소스 소유권 검증 추가

### Phase 2: 회사 관리 기능

4. **회사 가입 기능**
   - 회사 가입 페이지
   - 회사 가입 API
   - 이메일 인증 (선택)

5. **회원가입 수정**
   - 회사 코드 입력 필드
   - 회사 검증 로직

6. **회사 설정 페이지**
   - 회사 정보 조회/수정
   - 로고 업로드

### Phase 3: 고급 기능

7. **슈퍼 관리자 기능** (선택)
   - 전체 회사 목록 조회
   - 회사 상태 관리 (활성화/정지)
   - 사용 현황 대시보드

8. **구독/과금 시스템** (선택)
   - 요금제별 기능 제한
   - 사용량 추적
   - 결제 연동

9. **고급 보안**
   - 감사 로그
   - IP 제한
   - 2FA (선택)

### Phase 4: 최적화

10. **성능 최적화**
    - 쿼리 최적화
    - 캐싱 전략
    - 인덱스 튜닝

11. **모니터링**
    - 회사별 사용량 모니터링
    - 에러 추적
    - 성능 모니터링

---

## 부록: 체크리스트

### 개발 완료 체크리스트

- [ ] COMPANIES 테이블 생성
- [ ] 기존 테이블 COMPANY_ID 컬럼 추가
- [ ] 기존 데이터 마이그레이션
- [ ] 인증 미들웨어 수정
- [ ] 회사 가입 API 구현
- [ ] 회사 가입 페이지 구현
- [ ] 회원가입 페이지 수정 (회사 코드 입력)
- [ ] 모든 API에 COMPANY_ID 필터 적용
- [ ] 회사 컨텍스트 구현
- [ ] 동적 브랜딩 적용
- [ ] 회사 설정 페이지 구현
- [ ] 보안 검토 완료
- [ ] 성능 테스트 완료
- [ ] 문서화 완료

### 테스트 체크리스트

- [ ] 회사 가입 테스트
- [ ] 사용자 가입 테스트 (회사 코드)
- [ ] 데이터 격리 테스트 (회사 A 데이터가 회사 B에 노출되지 않음)
- [ ] 권한 검증 테스트
- [ ] 기존 기능 회귀 테스트
- [ ] 성능 테스트 (다중 회사 환경)

---

## 변경 이력

| 버전 | 날짜 | 작성자 | 내용 |
|------|------|--------|------|
| 1.0 | 2025-12-17 | Claude | 초안 작성 |
