import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.user.findFirst({ where: { role: Role.MASTER } })
  if (existing) {
    console.log('Master já existe, seed ignorado.')
    return
  }

  await prisma.user.create({
    data: {
      name: 'Master',
      email: process.env.MASTER_EMAIL ?? 'master@admin.com',
      password: await bcrypt.hash(process.env.MASTER_PASSWORD ?? 'changeme', 10),
      role: Role.MASTER,
    },
  })

  console.log('Usuário master criado.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
