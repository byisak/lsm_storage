-- ============================================================
-- PostgreSQL 스키마 (Oracle에서 마이그레이션)
-- 실행 순서대로 진행하세요
-- ============================================================

-- ============================================================
-- 확장 기능 활성화
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- STEP 1: 회사 테이블 생성
-- ============================================================

CREATE TABLE companies (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    business_number VARCHAR(20),
    representative VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(100),
    address VARCHAR(300),
    logo_url VARCHAR(500),
    theme_color VARCHAR(20),
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    plan_type VARCHAR(20) DEFAULT 'BASIC' NOT NULL,
    max_users INTEGER DEFAULT 10,
    max_warehouses INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_company_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED')),
    CONSTRAINT chk_company_plan CHECK (plan_type IN ('BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE'))
);

CREATE INDEX idx_company_status ON companies(status);
CREATE INDEX idx_company_name ON companies(name);

COMMENT ON TABLE companies IS '회사 (테넌트) 정보';
COMMENT ON COLUMN companies.id IS '회사 고유 ID';
COMMENT ON COLUMN companies.name IS '회사명';
COMMENT ON COLUMN companies.status IS '상태 (ACTIVE/SUSPENDED/DELETED)';
COMMENT ON COLUMN companies.plan_type IS '요금제 (BASIC/STANDARD/PREMIUM/ENTERPRISE)';

-- ============================================================
-- STEP 2: 사용자 테이블 생성
-- ============================================================

CREATE TABLE ls_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(200) NOT NULL UNIQUE,
    password VARCHAR(200) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'USER' NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    company_id VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    approved_at TIMESTAMP,
    approved_by INTEGER,
    CONSTRAINT chk_user_role CHECK (role IN ('USER', 'ADMIN', 'SUPER_ADMIN')),
    CONSTRAINT chk_user_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX idx_users_email ON ls_users(email);
CREATE INDEX idx_users_company ON ls_users(company_id);
CREATE INDEX idx_users_status ON ls_users(status);
CREATE INDEX idx_users_role ON ls_users(role);

COMMENT ON TABLE ls_users IS '사용자 정보';
COMMENT ON COLUMN ls_users.role IS '역할 (USER/ADMIN/SUPER_ADMIN)';
COMMENT ON COLUMN ls_users.status IS '상태 (PENDING/APPROVED/REJECTED)';

-- ============================================================
-- STEP 3: 창고 테이블 생성
-- ============================================================

CREATE TABLE ls_warehouses (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    company_id VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_warehouses_company ON ls_warehouses(company_id);
CREATE INDEX idx_warehouses_sort ON ls_warehouses(sort_order);

COMMENT ON TABLE ls_warehouses IS '창고 정보';

-- ============================================================
-- STEP 4: 재고 마스터 테이블 생성
-- ============================================================

CREATE TABLE ls_motor_rack (
    id SERIAL PRIMARY KEY,
    storage VARCHAR(20) NOT NULL,
    location VARCHAR(50) NOT NULL,
    item_code VARCHAR(50) NOT NULL,
    item_name VARCHAR(200),
    now_qty INTEGER DEFAULT 0,
    in_day TIMESTAMP,
    remark VARCHAR(500),
    company_id VARCHAR(20)
);

CREATE INDEX idx_rack_storage ON ls_motor_rack(storage);
CREATE INDEX idx_rack_location ON ls_motor_rack(location);
CREATE INDEX idx_rack_item_code ON ls_motor_rack(item_code);
CREATE INDEX idx_rack_company ON ls_motor_rack(company_id);
CREATE INDEX idx_rack_company_storage ON ls_motor_rack(company_id, storage);
CREATE INDEX idx_rack_company_item ON ls_motor_rack(company_id, item_code);
CREATE INDEX idx_rack_company_location ON ls_motor_rack(company_id, location);
CREATE UNIQUE INDEX idx_rack_unique ON ls_motor_rack(storage, location, item_code, COALESCE(company_id, ''));

COMMENT ON TABLE ls_motor_rack IS '재고 마스터 (위치별 재고)';
COMMENT ON COLUMN ls_motor_rack.storage IS '창고 ID';
COMMENT ON COLUMN ls_motor_rack.location IS '위치 (랙 번호)';
COMMENT ON COLUMN ls_motor_rack.now_qty IS '현재 수량';

-- ============================================================
-- STEP 5: 입출고 이력 테이블 생성
-- ============================================================

CREATE TABLE ls_motor_subul (
    id SERIAL PRIMARY KEY,
    storage VARCHAR(20) NOT NULL,
    location VARCHAR(50),
    item_code VARCHAR(50) NOT NULL,
    item_name VARCHAR(200),
    qty INTEGER NOT NULL,
    subul_type VARCHAR(20) NOT NULL,
    category VARCHAR(50),
    subul_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    remark VARCHAR(500),
    user_id INTEGER,
    to_storage VARCHAR(20),
    to_location VARCHAR(50),
    company_id VARCHAR(20),
    CONSTRAINT chk_subul_type CHECK (subul_type IN ('IN', 'OUT', 'MOVE'))
);

CREATE INDEX idx_subul_storage ON ls_motor_subul(storage);
CREATE INDEX idx_subul_item_code ON ls_motor_subul(item_code);
CREATE INDEX idx_subul_time ON ls_motor_subul(subul_time DESC);
CREATE INDEX idx_subul_user ON ls_motor_subul(user_id);
CREATE INDEX idx_subul_company ON ls_motor_subul(company_id);
CREATE INDEX idx_subul_company_time ON ls_motor_subul(company_id, subul_time DESC);

COMMENT ON TABLE ls_motor_subul IS '입출고 이력';
COMMENT ON COLUMN ls_motor_subul.subul_type IS '유형 (IN/OUT/MOVE)';

-- ============================================================
-- STEP 6: 품목 마스터 테이블 생성
-- ============================================================

CREATE TABLE ls_motor_item (
    idx SERIAL PRIMARY KEY,
    storage VARCHAR(20),
    item_code VARCHAR(50) NOT NULL,
    item_name VARCHAR(200),
    spec VARCHAR(200),
    unit VARCHAR(20),
    erp_reservation INTEGER DEFAULT 0,
    erp_inventory10 INTEGER DEFAULT 0,
    erp_inventory11 INTEGER DEFAULT 0,
    shortage INTEGER DEFAULT 0,
    remark VARCHAR(500),
    company_id VARCHAR(20)
);

CREATE INDEX idx_item_code ON ls_motor_item(item_code);
CREATE INDEX idx_item_name ON ls_motor_item(item_name);
CREATE INDEX idx_item_company ON ls_motor_item(company_id);
CREATE INDEX idx_item_company_code ON ls_motor_item(company_id, item_code);

COMMENT ON TABLE ls_motor_item IS '품목 마스터';

-- ============================================================
-- STEP 7: 감사 로그 테이블 생성
-- ============================================================

CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    company_id VARCHAR(20),
    user_id INTEGER,
    user_name VARCHAR(100),
    user_email VARCHAR(200),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100),
    description VARCHAR(1000),
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_audit_action CHECK (action IN (
        'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
        'CREATE', 'UPDATE', 'DELETE',
        'APPROVE', 'REJECT',
        'IMPORT', 'EXPORT',
        'SETTINGS_CHANGE', 'ROLE_CHANGE',
        'PASSWORD_CHANGE', 'PASSWORD_RESET'
    )),
    CONSTRAINT chk_audit_resource CHECK (resource_type IN (
        'USER', 'COMPANY', 'WAREHOUSE',
        'RACK', 'ITEM', 'TRANSACTION',
        'SETTINGS', 'SYSTEM'
    ))
);

CREATE INDEX idx_audit_company ON audit_log(company_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_time ON audit_log(created_at DESC);
CREATE INDEX idx_audit_company_time ON audit_log(company_id, created_at DESC);

COMMENT ON TABLE audit_log IS '시스템 감사 로그';

-- ============================================================
-- STEP 8: API 키 테이블 생성
-- ============================================================

CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    company_id VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    key_hash VARCHAR(128) NOT NULL,
    permissions VARCHAR(500) DEFAULT 'READ',
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_api_key_status CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED'))
);

CREATE INDEX idx_api_key_company ON api_keys(company_id);
CREATE INDEX idx_api_key_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_key_status ON api_keys(status);

COMMENT ON TABLE api_keys IS 'API 인증 키';

-- ============================================================
-- STEP 9: 공지사항 테이블 생성
-- ============================================================

CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'INFO' NOT NULL,
    target VARCHAR(20) DEFAULT 'ALL' NOT NULL,
    target_company_id VARCHAR(20),
    priority INTEGER DEFAULT 0,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_ann_type CHECK (type IN ('INFO', 'WARNING', 'URGENT', 'MAINTENANCE')),
    CONSTRAINT chk_ann_target CHECK (target IN ('ALL', 'COMPANY', 'PLAN')),
    CONSTRAINT chk_ann_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
);

CREATE INDEX idx_ann_status ON announcements(status);
CREATE INDEX idx_ann_target ON announcements(target, target_company_id);
CREATE INDEX idx_ann_date ON announcements(start_date, end_date);

CREATE TABLE announcement_reads (
    user_id INTEGER NOT NULL,
    announcement_id INTEGER NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, announcement_id)
);

COMMENT ON TABLE announcements IS '시스템 공지사항';

-- ============================================================
-- STEP 10: 기본 데이터 삽입
-- ============================================================

-- 기본 회사 생성
INSERT INTO companies (id, name, status, plan_type, max_users, max_warehouses)
VALUES ('LSMECA', 'LS Mecapion', 'ACTIVE', 'ENTERPRISE', 100, 20);

-- 슈퍼 관리자 계정 생성 (비밀번호: admin123)
-- 비밀번호 해시는 bcrypt로 생성해야 함
-- INSERT INTO ls_users (email, password, name, role, status, company_id)
-- VALUES ('admin@example.com', '$2b$10$...', '관리자', 'SUPER_ADMIN', 'APPROVED', 'LSMECA');

-- ============================================================
-- STEP 11: 외래키 추가 (선택사항)
-- ============================================================

-- ALTER TABLE ls_users ADD CONSTRAINT fk_users_company
--     FOREIGN KEY (company_id) REFERENCES companies(id);

-- ALTER TABLE ls_warehouses ADD CONSTRAINT fk_warehouses_company
--     FOREIGN KEY (company_id) REFERENCES companies(id);

-- ALTER TABLE ls_motor_rack ADD CONSTRAINT fk_rack_company
--     FOREIGN KEY (company_id) REFERENCES companies(id);

-- ALTER TABLE ls_motor_subul ADD CONSTRAINT fk_subul_company
--     FOREIGN KEY (company_id) REFERENCES companies(id);

-- ALTER TABLE ls_motor_item ADD CONSTRAINT fk_item_company
--     FOREIGN KEY (company_id) REFERENCES companies(id);

-- ============================================================
-- Row Level Security (RLS) - 멀티테넌트 격리 (선택사항)
-- ============================================================

-- 테넌트 격리를 위한 RLS 정책 (PostgreSQL 전용 기능)
-- ALTER TABLE ls_users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ls_warehouses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ls_motor_rack ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ls_motor_subul ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ls_motor_item ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY tenant_isolation_users ON ls_users
--     USING (company_id = current_setting('app.company_id', true));

-- ============================================================
-- 검증 쿼리
-- ============================================================

-- 테이블 목록 확인
-- \dt

-- 회사 확인
SELECT * FROM companies;
