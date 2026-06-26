import { Router } from 'express'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middlewares/auth'

export const settingsRoutes = Router()

const SINGLETON = 'singleton'

async function getOrCreateSettings() {
  return prisma.appSettings.upsert({
    where: { id: SINGLETON },
    update: {},
    create: { id: SINGLETON },
  })
}

// Público: o front precisa da marca (nome/logo/cores) antes do login.
settingsRoutes.get('/', async (_req, res) => {
  res.json(await getOrCreateSettings())
})

type Settings = Awaited<ReturnType<typeof getOrCreateSettings>>

// Decodifica um data URL base64 em { mime, buffer }.
function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl)
  if (!m) return null
  return { mime: m[1], buffer: Buffer.from(m[2], 'base64') }
}

// Ícone padrão (WiFi) nas cores da marca, usado quando não há logo.
function defaultIconSvg(s: Settings): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${s.gradientFrom}"/><stop offset="1" stop-color="${s.gradientTo}"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <g fill="none" stroke="#ffffff" stroke-width="30" stroke-linecap="round">
    <path d="M150 250a150 150 0 0 1 212 0"/>
    <path d="M196 298a86 86 0 0 1 120 0"/>
  </g>
  <circle cx="256" cy="356" r="26" fill="#ffffff"/>
</svg>`
}

// MIME do ícone do app: tipo real do logo, ou SVG do ícone padrão.
function iconMime(s: Settings): string {
  if (s.logoUrl) return /^data:([^;]+)/.exec(s.logoUrl)?.[1] ?? 'image/png'
  return 'image/svg+xml'
}

// Manifest PWA gerado a partir da marca definida pelo MASTER.
settingsRoutes.get('/manifest.webmanifest', async (_req, res) => {
  const s = await getOrCreateSettings()
  const mime = iconMime(s)
  const isSvg = mime === 'image/svg+xml'
  const icons = isSvg
    ? [{ src: '/api/settings/app-icon/any.svg', sizes: 'any', type: mime, purpose: 'any' }]
    : [
        { src: '/api/settings/app-icon/192', sizes: '192x192', type: mime, purpose: 'any' },
        { src: '/api/settings/app-icon/512', sizes: '512x512', type: mime, purpose: 'any' },
      ]
  const shortName = s.appName.length > 12 ? s.appName.split(' ')[0].slice(0, 12) : s.appName

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.json({
    id: '/',
    name: s.appName,
    short_name: shortName,
    description: 'Gestão de hotspot e vouchers',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#070b25',
    theme_color: s.primaryColor,
    icons,
  })
})

// Ícone do app (logo do MASTER ou ícone padrão). :size só varia a URL.
settingsRoutes.get('/app-icon/:size', async (_req, res) => {
  const s = await getOrCreateSettings()
  res.setHeader('Cache-Control', 'public, max-age=300')
  if (s.logoUrl) {
    const parsed = parseDataUrl(s.logoUrl)
    if (parsed) {
      res.setHeader('Content-Type', parsed.mime)
      res.send(parsed.buffer)
      return
    }
  }
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
  res.send(defaultIconSvg(s))
})

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida')
const imageDataUrl = z.string().startsWith('data:image/', 'Deve ser uma imagem')

const updateSchema = z.object({
  appName: z.string().min(1).max(60).optional(),
  logoUrl: imageDataUrl.max(7_000_000).nullable().optional(),
  faviconUrl: imageDataUrl.max(500_000).nullable().optional(),
  primaryColor: hex.optional(),
  gradientFrom: hex.optional(),
  gradientTo: hex.optional(),
})

// Apenas MASTER edita a marca da aplicação.
settingsRoutes.put('/', authenticate, authorize(Role.MASTER), async (req, res) => {
  const data = updateSchema.parse(req.body)
  const settings = await prisma.appSettings.upsert({
    where: { id: SINGLETON },
    update: data,
    create: { id: SINGLETON, ...data },
  })
  res.json(settings)
})
