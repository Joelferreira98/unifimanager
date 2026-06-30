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

// CORS: sempre permite same-origin (o navegador manda header Origin até em POST
// same-origin) e, além disso, as origens cross-origin listadas em CORS_ORIGIN
// (separadas por vírgula). Em prod o front é servido pelo nginx na mesma origem e
// em dev via proxy do Vite — ambos same-origin. Origem cross não listada é negada.
const allowedOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(
  cors((req, callback) => {
    const origin = req.headers.origin
    let allow = false
    if (!origin) {
      allow = true // sem Origin (curl, server-to-server) → permite
    } else if (allowedOrigins.includes(origin)) {
      allow = true // cross-origin explicitamente liberada
    } else {
      try {
        allow = new URL(origin).host === req.headers.host // same-origin
      } catch {
        allow = false
      }
    }
    // Não lança erro (evita 500): só (não) anexa os cabeçalhos CORS; o navegador
    // bloqueia a leitura de respostas cross-origin não liberadas por conta própria.
    const options: CorsOptions = { origin: allow }
    callback(null, options)
  })
)
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
