import axios, { AxiosInstance } from 'axios'
import type { CompanyReport, GlobalReport } from './ReportService'

// Erro de configuração ausente: a rota traduz para 503 com mensagem amigável.
export class AiNotConfiguredError extends Error {
  constructor() {
    super('Insights de IA não configurados: defina OPENAI_API_KEY no servidor.')
    this.name = 'AiNotConfiguredError'
  }
}

const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

// Variação percentual entre dois valores (null quando não há base de comparação).
function pct(curr: number, prev: number): string {
  if (prev === 0) return curr > 0 ? '+∞%' : '0%'
  const v = ((curr - prev) / prev) * 100
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

// Monta um resumo textual e compacto do relatório para enviar ao modelo.
function buildUserPrompt(report: CompanyReport): string {
  const { summary, byPlan, byDay, byTrip } = report
  const lines: string[] = []

  lines.push(`Empresa (embarcação): ${report.companyName}`)
  lines.push(`Período: ${fmtDate(report.range.from)} a ${fmtDate(report.range.to)}`)
  lines.push('')
  lines.push('## Resumo')
  lines.push(`- Total de vendas (vouchers conectados): ${summary.salesCount}`)
  lines.push(`- Receita total: ${BRL(summary.totalRevenue)}`)
  lines.push(`- Ticket médio: ${BRL(summary.avgTicket)}`)
  lines.push(`- Planos distintos vendidos: ${summary.plansSold}`)
  lines.push(`- Viagens (caixas) no período: ${summary.tripsInRange}`)

  lines.push('')
  lines.push('## Evolução por viagem (caixa) — em ordem cronológica')
  lines.push('Cada viagem é um ciclo de caixa. A MÉTRICA PRINCIPAL é a quantidade de vendas por viagem. A variação % é em relação à viagem anterior listada.')
  if (byTrip.length === 0) {
    lines.push('- (sem vendas em nenhuma viagem do período)')
  } else {
    byTrip.forEach((t, i) => {
      const prev = i > 0 ? byTrip[i - 1] : null
      const varTxt = prev ? ` (vendas ${pct(t.salesCount, prev.salesCount)}, receita ${pct(t.revenue, prev.revenue)})` : ''
      const status = t.active ? 'em aberto' : 'fechada'
      lines.push(
        `- Viagem #${t.number} [${status}] ${fmtDate(t.openedAt)}: ${t.salesCount} vendas, ${BRL(t.revenue)}, ticket médio ${BRL(t.avgTicket)}${varTxt}`
      )
    })
  }

  lines.push('')
  lines.push('## Mix de planos (personalizados para o trajeto desta embarcação)')
  lines.push('Os planos são específicos desta embarcação e do seu trajeto — não compare com outras embarcações. Analise quais planos têm mais saída (volume de vendas).')
  if (byPlan.length === 0) lines.push('- (sem vendas)')
  for (const p of byPlan) lines.push(`- ${p.name}: ${p.salesCount} vendas, ${BRL(p.revenue)}`)

  lines.push('')
  lines.push('## Evolução diária')
  if (byDay.length === 0) lines.push('- (sem vendas)')
  for (const d of byDay) lines.push(`- ${d.date}: ${d.salesCount} vendas, ${BRL(d.revenue)}`)

  return lines.join('\n')
}

const SYSTEM_PROMPT = `Você é um analista de negócios sênior de uma operação de venda de vouchers de internet (hotspot) em embarcações.
Cada "viagem" é um ciclo de caixa: a unidade central da análise é a EVOLUÇÃO da QUANTIDADE DE VENDAS entre viagens consecutivas.
Recebe um relatório consolidado de vendas de uma empresa em um período e produz uma análise objetiva e assertiva em português do Brasil.

Contexto crítico do negócio (siga à risca):
- A métrica que mais importa é a QUANTIDADE DE VENDAS (volume de vouchers conectados) por viagem. Receita e ticket médio são secundários e servem só de apoio.
- NÃO analise nem mencione vendedores: quem vendeu é irrelevante para o negócio. Não cite nomes de vendedores nem "melhor vendedor".
- Os planos são PERSONALIZADOS para cada embarcação e seu trajeto. Não os trate como genéricos nem compare com outras embarcações. Analise apenas o mix interno: quais planos têm mais saída (volume) nesta embarcação.

Regras de assertividade:
- Sempre cite números concretos (quantidades de vendas e variações percentuais de volume entre viagens consecutivas). Use valores em R$ apenas como apoio.
- Dê um veredito claro da tendência de VOLUME de vendas: "crescimento", "queda" ou "estável", justificado pelos números. Evite linguagem vaga quando os dados permitem afirmar.
- Nomeie explicitamente a viagem com mais vendas e a com menos vendas, e o plano de maior saída.
- Não invente dados nem extrapole. Se houver poucas viagens/vendas, afirme isso e seja cauteloso.
- Não repita as tabelas; foque em interpretação acionável.

Responda em Markdown, conciso, com estas seções:
- **Veredito**: 1-2 frases com a tendência do volume de vendas (crescimento/queda/estável) e o número que a sustenta.
- **Evolução das viagens**: bullets comparando a quantidade de vendas entre viagens consecutivas (variação %), apontando a viagem de maior e a de menor volume.
- **Mix de planos**: quais planos têm mais saída nesta embarcação, com as quantidades.
- **Pontos de atenção**: quedas de volume, dias fracos ou anomalias.
- **Recomendações**: 2-4 ações práticas e específicas para aumentar o volume de vendas.`

// Resumo textual do relatório geral (frota inteira) para o modelo.
function buildGlobalUserPrompt(report: GlobalReport): string {
  const { summary, byCompany, byDay } = report
  const lines: string[] = []

  lines.push('Relatório geral da frota (todas as embarcações).')
  lines.push(`Período: ${fmtDate(report.range.from)} a ${fmtDate(report.range.to)}`)
  lines.push('')
  lines.push('## Resumo da frota')
  lines.push(`- Total de vendas (vouchers conectados): ${summary.salesCount}`)
  lines.push(`- Receita total: ${BRL(summary.totalRevenue)}`)
  lines.push(`- Ticket médio: ${BRL(summary.avgTicket)}`)
  lines.push(`- Embarcações ativas na frota: ${summary.totalCompanies}`)
  lines.push(`- Embarcações com vendas no período: ${summary.sellingCompanies}`)

  lines.push('')
  lines.push('## Ranking de embarcações (ordenado por quantidade de vendas)')
  lines.push('A métrica principal é a QUANTIDADE de vendas. Cada embarcação tem planos próprios para seu trajeto; não os compare entre embarcações.')
  if (byCompany.length === 0) {
    lines.push('- (nenhuma embarcação cadastrada)')
  } else {
    byCompany.forEach((c, i) => {
      const status = c.hasActiveTrip ? 'viagem em aberto' : 'sem viagem aberta'
      lines.push(
        `${i + 1}. ${c.name}: ${c.salesCount} vendas, ${BRL(c.revenue)}, ticket médio ${BRL(c.avgTicket)}, ${c.tripsWithSales} viagem(ns) com venda, ${status}`
      )
    })
  }

  lines.push('')
  lines.push('## Evolução diária da frota')
  if (byDay.length === 0) lines.push('- (sem vendas)')
  for (const d of byDay) lines.push(`- ${d.date}: ${d.salesCount} vendas, ${BRL(d.revenue)}`)

  return lines.join('\n')
}

const GLOBAL_SYSTEM_PROMPT = `Você é um analista de negócios sênior de uma operação de venda de vouchers de internet (hotspot) em embarcações, analisando o CONJUNTO de embarcações a que o usuário tem acesso (pode ser a frota inteira ou apenas parte dela).
Recebe um relatório consolidado dessas embarcações em um período e produz uma análise objetiva e assertiva em português do Brasil.

Contexto crítico do negócio (siga à risca):
- A métrica que mais importa é a QUANTIDADE DE VENDAS (volume de vouchers conectados) por embarcação. Receita e ticket médio são secundários e servem só de apoio.
- NÃO analise nem mencione vendedores: quem vendeu é irrelevante. Não cite nomes de vendedores.
- Cada embarcação tem PLANOS PRÓPRIOS, personalizados para seu trajeto. Não compare planos entre embarcações; compare as embarcações entre si pelo VOLUME de vendas.
- Identifique embarcações que estão vendendo bem e as que estão paradas ou fracas (poucas ou zero vendas).

Regras de assertividade:
- Sempre cite números concretos (quantidades de vendas por embarcação, participação no total da frota).
- Nomeie explicitamente a embarcação líder em vendas e as de pior desempenho (incluindo as com zero vendas no período).
- Não invente dados nem extrapole. Se a frota for pequena ou houver poucas vendas, afirme isso e seja cauteloso.
- Não repita as tabelas; foque em interpretação acionável.

Responda em Markdown, conciso, com estas seções:
- **Veredito**: 1-2 frases com o desempenho geral da frota (volume total de vendas) e o número que o sustenta.
- **Ranking de embarcações**: destaque as líderes e as fracas/paradas em volume de vendas, com números e participação no total.
- **Pontos de atenção**: embarcações sem vendas ou em queda, concentração das vendas em poucas embarcações, dias fracos.
- **Recomendações**: 2-4 ações práticas e específicas para elevar o volume de vendas da frota.`

class AiInsightsService {
  private client: AxiosInstance
  private model: string

  constructor() {
    this.model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
    this.client = axios.create({
      baseURL: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      timeout: 60_000,
    })
  }

  get isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY
  }

  async generateInsights(report: CompanyReport): Promise<string> {
    return this.complete(SYSTEM_PROMPT, buildUserPrompt(report))
  }

  async generateGlobalInsights(report: GlobalReport): Promise<string> {
    return this.complete(GLOBAL_SYSTEM_PROMPT, buildGlobalUserPrompt(report))
  }

  private async complete(system: string, user: string): Promise<string> {
    if (!this.isConfigured) throw new AiNotConfiguredError()

    const { data } = await this.client.post(
      '/chat/completions',
      {
        model: this.model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
    )

    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new Error('Resposta vazia do provedor de IA')
    return content.trim()
  }
}

export const aiInsightsService = new AiInsightsService()
