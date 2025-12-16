import oracledb from 'oracledb'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// .env.local 로드
dotenv.config({ path: '.env.local' })

interface ItemRow {
  idx: string
  storage: string
  itemCode: string
  itemName: string
  ERP_reservation: string
  ERP_Inventory10: string
  ERP_Inventory11: string
  Shortage: string
}

async function importCSV(csvFilePath: string) {
  // CSV 파일 읽기
  const csvContent = fs.readFileSync(csvFilePath, 'utf-8')
  const lines = csvContent.trim().split('\n')

  // 헤더 제거
  const header = lines[0]
  const dataLines = lines.slice(1)

  console.log(`📄 CSV 파일 로드: ${csvFilePath}`)
  console.log(`📊 총 ${dataLines.length}개 레코드`)

  // Oracle 연결
  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECTION_STRING,
  })

  console.log('✅ Oracle DB 연결 성공')

  let insertCount = 0
  let skipCount = 0

  try {
    for (const line of dataLines) {
      // CSV 파싱 (따옴표 처리)
      const values = parseCSVLine(line)

      if (values.length < 8) {
        console.log(`⚠️ 잘못된 라인 스킵: ${line}`)
        skipCount++
        continue
      }

      const [idx, storage, itemCode, itemName, erpReservation, erpInventory10, erpInventory11, shortage] = values

      // 헤더 행 스킵
      if (itemCode === '품목' || itemCode === 'itemCode') {
        skipCount++
        continue
      }

      try {
        await connection.execute(
          `INSERT INTO LS_MOTOR_ITEM (STORAGE, ITEM_CODE, ITEM_NAME, ERP_RESERVATION, ERP_INVENTORY10, ERP_INVENTORY11, SHORTAGE)
           VALUES (:storage, :itemCode, :itemName, :erpReservation, :erpInventory10, :erpInventory11, :shortage)`,
          {
            storage: storage || '모터자재창고',
            itemCode: itemCode,
            itemName: itemName,
            erpReservation: parseInt(erpReservation) || 0,
            erpInventory10: parseInt(erpInventory10) || 0,
            erpInventory11: parseInt(erpInventory11) || 0,
            shortage: parseInt(shortage) || 0,
          },
          { autoCommit: false }
        )
        insertCount++

        // 100개마다 진행상황 출력
        if (insertCount % 100 === 0) {
          console.log(`⏳ ${insertCount}개 처리 중...`)
        }
      } catch (err: any) {
        console.log(`❌ INSERT 실패 (${itemCode}): ${err.message}`)
        skipCount++
      }
    }

    // 커밋
    await connection.commit()
    console.log(`\n✅ 완료! ${insertCount}개 INSERT, ${skipCount}개 스킵`)

  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    await connection.close()
  }
}

// CSV 라인 파싱 (따옴표 처리)
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())

  return result
}

// 실행
const csvFile = process.argv[2]
if (!csvFile) {
  console.log('사용법: npx tsx scripts/import-csv.ts <csv파일경로>')
  console.log('예시: npx tsx scripts/import-csv.ts ./data/items.csv')
  process.exit(1)
}

importCSV(csvFile).catch(console.error)
