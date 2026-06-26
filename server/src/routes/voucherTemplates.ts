import { Router } from 'express'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middlewares/auth'
import type { AuthPayload } from '../middlewares/auth'

export const voucherTemplatesRoutes = Router()

voucherTemplatesRoutes.use(authenticate)

// Garante que o usuário tem acesso à empresa. MASTER vê tudo;
// MANAGER precisa gerenciar a empresa; SELLER precisa pertencer a ela.
async function hasCompanyAccess(user: AuthPayload, companyId: string): Promise<boolean> {
  if (user.role === Role.MASTER) return true
  if (user.role === Role.MANAGER) {
    const access = await prisma.managerCompany.findUnique({
      where: { managerId_companyId: { managerId: user.userId, companyId } },
    })
    return !!access
  }
  return user.companyId === companyId
}

function defaultTemplate(companyId: string) {
  return { companyId }
}

// GET — qualquer usuário com acesso à empresa (vendedor precisa para imprimir).
voucherTemplatesRoutes.get('/company/:companyId', async (req, res) => {
  const { companyId } = req.params
  if (!(await hasCompanyAccess(req.user, companyId))) {
    res.status(403).json({ message: 'Acesso negado a essa empresa' })
    return
  }
  const template = await prisma.voucherTemplate.upsert({
    where: { companyId },
    update: {},
    create: defaultTemplate(companyId),
  })
  res.json(template)
})

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida')
const imageDataUrl = z.string().startsWith('data:image/', 'Deve ser uma imagem')
const text = z.string().max(500).nullable().optional()

const updateSchema = z.object({
  logoUrl: imageDataUrl.max(7_000_000).nullable().optional(),
  bgColor: hex.optional(),
  textColor: hex.optional(),
  accentColor: hex.optional(),
  borderColor: hex.optional(),
  headerText: text,
  subtitle: text,
  wifiName: text,
  instructions: text,
  footerText: text,
  cardsPerRow: z.number().int().min(1).max(5).optional(),
  showLogo: z.boolean().optional(),
  showPrice: z.boolean().optional(),
  showPlan: z.boolean().optional(),
  showDuration: z.boolean().optional(),
})

// PUT — apenas MASTER ou MANAGER que gerencia a empresa.
voucherTemplatesRoutes.put(
  '/company/:companyId',
  authorize(Role.MASTER, Role.MANAGER),
  async (req, res) => {
    const { companyId } = req.params
    if (!(await hasCompanyAccess(req.user, companyId))) {
      res.status(403).json({ message: 'Você não gerencia essa empresa' })
      return
    }
    const data = updateSchema.parse(req.body)
    const template = await prisma.voucherTemplate.upsert({
      where: { companyId },
      update: data,
      create: { ...defaultTemplate(companyId), ...data },
    })
    res.json(template)
  }
)
