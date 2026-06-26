import { Router } from 'express'
import { Role } from '@prisma/client'
import { authenticate, authorize } from '../middlewares/auth'
import { unifiService } from '../services/UnifiService'

export const sitesRoutes = Router()

sitesRoutes.use(authenticate)

// Listar os sites do controlador só faz sentido para o MASTER (criação de empresa);
// não expor a topologia da rede a MANAGER/SELLER.
sitesRoutes.get('/', authorize(Role.MASTER), async (_req, res) => {
  const sites = await unifiService.getSites()
  res.json(sites)
})
