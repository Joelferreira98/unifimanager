import { Router } from 'express'
import { authenticate } from '../middlewares/auth'
import { unifiService } from '../services/UnifiService'

export const sitesRoutes = Router()

sitesRoutes.use(authenticate)

sitesRoutes.get('/', async (_req, res) => {
  const sites = await unifiService.getSites()
  res.json(sites)
})
