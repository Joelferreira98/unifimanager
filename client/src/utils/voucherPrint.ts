import type { Voucher, VoucherTemplate } from '../types'

// Template padrão usado quando a empresa ainda não personalizou o voucher.
export const DEFAULT_TEMPLATE: Omit<VoucherTemplate, 'id' | 'companyId'> = {
  logoUrl: null,
  bgColor: '#ffffff',
  textColor: '#111111',
  accentColor: '#0075ff',
  borderColor: '#999999',
  headerText: null,
  subtitle: null,
  wifiName: null,
  instructions: null,
  footerText: null,
  cardsPerRow: 3,
  showLogo: true,
  showPrice: true,
  showPlan: true,
  showDuration: true,
}

function fmtDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

function formatCode(code: string) {
  return code.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type TemplateLike = Omit<VoucherTemplate, 'id' | 'companyId'>

// Renderiza o HTML de um único card de voucher conforme o template.
export function renderVoucherCard(v: Voucher, t: TemplateLike, companyName: string): string {
  const header = t.headerText?.trim() || companyName
  const subtitle = t.subtitle?.trim() || 'Código de acesso'

  const logo = t.showLogo && t.logoUrl
    ? `<img class="vt-logo" src="${t.logoUrl}" alt="logo" />`
    : ''

  const wifi = t.wifiName?.trim()
    ? `<div class="vt-wifi">Rede: <b>${esc(t.wifiName.trim())}</b></div>`
    : ''

  const planParts: string[] = []
  if (t.showPlan) planParts.push(esc(v.plan.name))
  if (t.showDuration) planParts.push(fmtDuration(v.plan.timeLimitMinutes))
  const plan = planParts.length
    ? `<div class="vt-plan">${planParts.join(' &mdash; ')}</div>`
    : ''

  const price = t.showPrice
    ? `<div class="vt-price">R$&nbsp;${Number(v.plan.price).toFixed(2)}</div>`
    : ''

  const instructions = t.instructions?.trim()
    ? `<div class="vt-instructions">${esc(t.instructions.trim())}</div>`
    : ''

  const footer = t.footerText?.trim()
    ? `<div class="vt-footer">${esc(t.footerText.trim())}</div>`
    : ''

  return `
    <div class="vt-card">
      ${logo}
      <div class="vt-header">${esc(header)}</div>
      ${wifi}
      <div class="vt-subtitle">${esc(subtitle)}</div>
      <div class="vt-code">${formatCode(v.code)}</div>
      ${plan}
      ${price}
      ${instructions}
      ${footer}
    </div>`
}

// Gera o CSS do documento/preview a partir das cores do template.
export function voucherStyles(t: TemplateLike, cols: number): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .vt-grid {
      display: grid;
      grid-template-columns: repeat(${cols}, 1fr);
      gap: 8px;
    }
    .vt-card {
      border: 1px dashed ${t.borderColor};
      border-radius: 8px;
      padding: 14px;
      background: ${t.bgColor};
      color: ${t.textColor};
      text-align: center;
      page-break-inside: avoid;
      font-family: Arial, Helvetica, sans-serif;
    }
    .vt-logo { max-height: 46px; max-width: 70%; object-fit: contain; margin: 0 auto 8px; display: block; }
    .vt-header { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
    .vt-wifi { font-size: 11px; opacity: 0.8; margin-top: 4px; }
    .vt-subtitle { font-size: 10px; opacity: 0.6; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .vt-code { font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 4px 0 6px; color: ${t.accentColor}; }
    .vt-plan { font-size: 12px; opacity: 0.85; }
    .vt-price { font-size: 16px; font-weight: bold; margin-top: 6px; }
    .vt-instructions { font-size: 10px; opacity: 0.7; margin-top: 8px; white-space: pre-wrap; }
    .vt-footer { font-size: 10px; opacity: 0.6; margin-top: 8px; border-top: 1px solid ${t.borderColor}55; padding-top: 6px; white-space: pre-wrap; }
  `
}

// Abre uma janela e imprime os vouchers usando o template da empresa.
export function printVouchers(
  vouchers: Voucher[],
  template: TemplateLike,
  companyName: string,
  onError?: (msg: string) => void
) {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    onError?.('Permita pop-ups para imprimir')
    return
  }
  const cols = template.cardsPerRow || 3
  const cards = vouchers.map((v) => renderVoucherCard(v, template, companyName)).join('')

  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body { background: #fff; padding: 10px; }
      ${voucherStyles(template, cols)}
      @media print { @page { margin: 8mm; size: A4; } body { padding: 0; } }
    </style>
  </head><body>
    <div class="vt-grid">${cards}</div>
    <script>window.onload = () => { window.print() }<\/script>
  </body></html>`)
  win.document.close()
}
