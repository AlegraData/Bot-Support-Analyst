import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool    = new Pool({ connectionString: process.env.DATABASE_URL! })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any)
const prisma  = new PrismaClient({ adapter })

const ADMINS = [
  { email: 'carolinau@alegra.com',          name: 'Carolina U' },
  { email: 'cristhian.luna@alegra.com',     name: 'Cristhian Luna' },
  { email: 'xiomara.bohorquez@alegra.com',  name: 'Xiomara Bohorquez' },
]

async function main() {
  console.log('Seeding admins...')
  for (const admin of ADMINS) {
    await prisma.admin.upsert({
      where:  { email: admin.email },
      update: { name: admin.name },
      create: admin,
    })
    console.log(`  ✓ ${admin.email}`)
  }
  console.log('Done.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
