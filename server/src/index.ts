import 'express-async-errors'
import 'dotenv/config'
import express from 'express'
import cors, { CorsOptions } from 'cors'

import { errorHandler } from './middlewares/errorHandler'
import { authRoutes } from './routes/auth'
import { usersRoutes } from './routes/users'
import { companiesRoutes } from './routes/companies'
import { plansRoutes } from './routes/plans'
import { vouchersRoutes } from './routes/vouchers'
import { tripsRoutes } from './routes/trips'
import { salesRoutes } from './routes/sales'
import { sitesRoutes } from './routes/sites'
import { settingsRoutes } from './routes/settings'
import { voucherTemplatesRoutes } from './routes/voucherTemplates'
import { reportsRoutes } from './routes/reports'
import { dashboardRoutes } from './routes/dashboard'
import { startVoucherSyncJob } from './jobs/syncVouchers'

const app = express()

// Atrás do nginx: confia no primeiro proxy para que req.ip use o X-Forwarded-For
// (essencial para o rate limit por IP do login não tratar todos como 127.0.0.1).
app.set('trust proxy', 1)

// CORS restrito a uma allowlist (CORS_ORIGIN, separado por vírgula). Em produção o
// front é servido na mesma origem (nginx) e em dev via proxy do Vite — ambos são
// same-origin e não dependem destes cabeçalhos. Sem CORS_ORIGIN, nega cross-origin.
const allowedOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Sem header Origin (same-origin, curl, apps server-to-server) → permite.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('Origem não permitida pelo CORS'))
  },
}

app.use(cors(corsOptions))
// limite maior: logo/favicon trafegam como data URL (base64)
app.use(express.json({ limit: '12mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/companies', companiesRoutes)
app.use('/api/plans', plansRoutes)
app.use('/api/vouchers', vouchersRoutes)
app.use('/api/trips', tripsRoutes)
app.use('/api/sales', salesRoutes)
app.use('/api/sites', sitesRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/voucher-templates', voucherTemplatesRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/dashboard', dashboardRoutes)

app.use(errorHandler)

const PORT = process.env.PORT ?? 4000

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
  startVoucherSyncJob()
})
