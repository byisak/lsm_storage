import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // 기존 데이터 삭제
  await prisma.lsMotorRack.deleteMany()
  await prisma.lsMotorSubul.deleteMany()
  await prisma.lsMotorItem.deleteMany()

  // 품목 마스터 데이터 (ls_motor_item)
  const items = [
    { storage: '1', itemCode: '000000001(O)', itemName: 'CONNECTOR 172163-1(CAP)' },
    { storage: '1', itemCode: '000000001(R)', itemName: 'CONNECTOR 172163-1(CAP)' },
    { storage: '1', itemCode: '000000002(O)', itemName: 'SOCKET 170361-1' },
    { storage: '1', itemCode: '000000003(O)', itemName: 'TERMINAL 170358-1' },
    { storage: '1', itemCode: 'APM-SA01ACN', itemName: 'AC서보드라이버 L7SA' },
    { storage: '1', itemCode: 'APM-SC02ADK', itemName: 'AC서보드라이버 L7SC' },
    { storage: '1', itemCode: 'APM-SE05ADK', itemName: 'AC서보드라이버 CDHD' },
    { storage: '2', itemCode: 'MOTOR-001', itemName: '서보모터 100W' },
    { storage: '2', itemCode: 'MOTOR-002', itemName: '서보모터 200W' },
    { storage: '2', itemCode: 'MOTOR-003', itemName: '서보모터 400W' },
    { storage: '3', itemCode: 'PROD-001', itemName: '완제품 A타입' },
    { storage: '3', itemCode: 'PROD-002', itemName: '완제품 B타입' },
  ]

  for (const item of items) {
    await prisma.lsMotorItem.create({
      data: item
    })
  }
  console.log(`Created ${items.length} items`)

  // 랙 재고 데이터 (ls_motor_rack)
  const racks = [
    { storage: '1', location: 'A-01-01', itemCode: '000000001(O)', itemName: 'CONNECTOR 172163-1(CAP)', nowQty: 150, inDay: new Date('2024-12-01') },
    { storage: '1', location: 'A-01-02', itemCode: '000000001(R)', itemName: 'CONNECTOR 172163-1(CAP)', nowQty: 80, inDay: new Date('2024-12-03') },
    { storage: '1', location: 'A-01-03', itemCode: '000000002(O)', itemName: 'SOCKET 170361-1', nowQty: 200, inDay: new Date('2024-12-05') },
    { storage: '1', location: 'A-02-01', itemCode: '000000003(O)', itemName: 'TERMINAL 170358-1', nowQty: 500, inDay: new Date('2024-12-07') },
    { storage: '1', location: 'A-02-02', itemCode: 'APM-SA01ACN', itemName: 'AC서보드라이버 L7SA', nowQty: 25, inDay: new Date('2024-12-10') },
    { storage: '1', location: 'A-02-03', itemCode: 'APM-SC02ADK', itemName: 'AC서보드라이버 L7SC', nowQty: 30, inDay: new Date('2024-12-11') },
    { storage: '1', location: 'B-01-01', itemCode: 'APM-SE05ADK', itemName: 'AC서보드라이버 CDHD', nowQty: 15, inDay: new Date('2024-12-12') },
    { storage: '1', location: 'B-01-02', itemCode: '000000001(O)', itemName: 'CONNECTOR 172163-1(CAP)', nowQty: 100, inDay: new Date('2024-12-13'), remark: '추가 입고분' },
    { storage: '2', location: 'A-01-01', itemCode: 'MOTOR-001', itemName: '서보모터 100W', nowQty: 50, inDay: new Date('2024-12-05') },
    { storage: '2', location: 'A-01-02', itemCode: 'MOTOR-002', itemName: '서보모터 200W', nowQty: 35, inDay: new Date('2024-12-08') },
    { storage: '2', location: 'A-02-01', itemCode: 'MOTOR-003', itemName: '서보모터 400W', nowQty: 20, inDay: new Date('2024-12-10') },
    { storage: '3', location: 'A-01-01', itemCode: 'PROD-001', itemName: '완제품 A타입', nowQty: 100, inDay: new Date('2024-12-12') },
    { storage: '3', location: 'A-01-02', itemCode: 'PROD-002', itemName: '완제품 B타입', nowQty: 75, inDay: new Date('2024-12-14') },
  ]

  for (const rack of racks) {
    await prisma.lsMotorRack.create({
      data: rack
    })
  }
  console.log(`Created ${racks.length} rack items`)

  // 수불 이력 데이터 (ls_motor_subul)
  const subuls = [
    { storage: '1', location: 'A-01-01', itemCode: '000000001(O)', itemName: 'CONNECTOR 172163-1(CAP)', qty: 200, category: '입고', subulTime: new Date('2024-12-01 09:00:00'), user: 'admin' },
    { storage: '1', location: 'A-01-01', itemCode: '000000001(O)', itemName: 'CONNECTOR 172163-1(CAP)', qty: 50, category: '출고', subulTime: new Date('2024-12-02 14:30:00'), user: 'mobile', remark: '생산라인 출고' },
    { storage: '1', location: 'A-01-02', itemCode: '000000001(R)', itemName: 'CONNECTOR 172163-1(CAP)', qty: 100, category: '입고', subulTime: new Date('2024-12-03 10:00:00'), user: 'admin' },
    { storage: '1', location: 'A-01-02', itemCode: '000000001(R)', itemName: 'CONNECTOR 172163-1(CAP)', qty: 20, category: '출고', subulTime: new Date('2024-12-04 11:00:00'), user: 'mobile' },
    { storage: '1', location: 'A-02-02', itemCode: 'APM-SA01ACN', itemName: 'AC서보드라이버 L7SA', qty: 30, category: '입고', subulTime: new Date('2024-12-10 09:30:00'), user: 'admin' },
    { storage: '1', location: 'A-02-02', itemCode: 'APM-SA01ACN', itemName: 'AC서보드라이버 L7SA', qty: 5, category: '출고', subulTime: new Date('2024-12-11 15:00:00'), user: 'mobile', remark: '고객 납품' },
    { storage: '2', location: 'A-01-01', itemCode: 'MOTOR-001', itemName: '서보모터 100W', qty: 60, category: '입고', subulTime: new Date('2024-12-05 08:00:00'), user: 'admin' },
    { storage: '2', location: 'A-01-01', itemCode: 'MOTOR-001', itemName: '서보모터 100W', qty: 10, category: '출고', subulTime: new Date('2024-12-06 16:00:00'), user: 'mobile' },
    { storage: '3', location: 'A-01-01', itemCode: 'PROD-001', itemName: '완제품 A타입', qty: 100, category: '입고', subulTime: new Date('2024-12-12 10:00:00'), user: 'admin' },
    { storage: '3', location: 'A-01-02', itemCode: 'PROD-002', itemName: '완제품 B타입', qty: 75, category: '입고', subulTime: new Date('2024-12-14 09:00:00'), user: 'admin' },
  ]

  for (const subul of subuls) {
    await prisma.lsMotorSubul.create({
      data: subul
    })
  }
  console.log(`Created ${subuls.length} transaction records`)

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
