import { Role } from '@prisma/client'
import { prisma } from './prisma'
import type { AuthPayload } from '../middlewares/auth'

/**
 * Retorna a mensagem de erro de acesso à empresa, ou null se o usuário pode operá-la.
 * SELLER → só a própria empresa. MANAGER → só empresas vinculadas. MASTER → tudo.
 */
export async function companyAccessError(
  user: AuthPayload,
  companyId: string
): Promise<string | null> {
  if (user.role === Role.SELLER && user.companyId !== companyId) {
    return 'Você não pertence a essa empresa'
  }
  if (user.role === Role.MANAGER) {
    const access = await prisma.managerCompany.findUnique({
      where: { managerId_companyId: { managerId: user.userId, companyId } },
    })
    if (!access) return 'Você não gerencia essa empresa'
  }
  return null
}

/**
 * IDs das empresas que o usuário pode acessar. `null` = todas (MASTER).
 * MANAGER → empresas que gerencia; SELLER → a própria (ou nenhuma).
 */
export async function accessibleCompanyIds(user: AuthPayload): Promise<string[] | null> {
  if (user.role === Role.MASTER) return null
  if (user.role === Role.SELLER) return user.companyId ? [user.companyId] : []
  const managed = await prisma.managerCompany.findMany({
    where: { managerId: user.userId },
    select: { companyId: true },
  })
  return managed.map((m) => m.companyId)
}
