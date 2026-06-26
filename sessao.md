# Sessão — Relatórios com Insights de IA

**Data:** 2026-06-22

## Objetivo
Implementar uma página de **Relatórios** com **insights gerados por IA** sobre o desempenho de vendas por empresa (embarcação).

## Decisões de escopo
| Tópico | Decisão |
|--------|---------|
| Provedor de IA | **OpenAI** (`/chat/completions`, modelo via `OPENAI_MODEL`, padrão `gpt-4o-mini`) |
| Escopo dos dados | **Vendas + viagens (caixa)** — receita por viagem, por plano, por vendedor, ticket médio e evolução temporal |
| Acesso | **MASTER e MANAGER** (vendedor não vê relatórios consolidados) |

> Observação: começamos do zero — não havia código prévio de relatórios/IA no projeto (sem página, rota, dependência ou chave de API).

## Implementação

### Backend (`server/`)
- **`src/services/ReportService.ts`** — consolida vendas de uma empresa num período:
  - Resumo: receita total, nº de vendas, ticket médio, vendedores ativos, planos distintos, viagens no intervalo.
  - Quebras: **por plano**, **por vendedor**, **por dia** (agrupamento no fuso `America/Sao_Paulo` via `Intl.DateTimeFormat` en-CA).
  - Conta vendas por `registeredAt` (momento da conexão do voucher), respeitando a regra de negócio do projeto.
- **`src/services/AiInsightsService.ts`** — gera a análise textual via OpenAI usando `axios` (sem nova dependência).
  - Prompt em PT-BR pedindo: *visão geral / destaques / pontos de atenção / recomendações*.
  - Lança `AiNotConfiguredError` quando falta `OPENAI_API_KEY` → rota responde **503** amigável.
  - `isConfigured` exposto para o front saber se o botão deve ficar ativo.
- **`src/routes/reports.ts`** — restrito a **MASTER e MANAGER** + `companyAccessError`:
  - `GET /api/reports/company/:companyId?from=&to=` → métricas (padrão: últimos 30 dias) + flag `aiAvailable`.
  - `POST /api/reports/company/:companyId/insights` → gera os insights sob demanda (recalcula métricas no servidor).
- **`src/index.ts`** — registrada a rota `/api/reports`.
- **`.env` / `.env.example`** — adicionadas `OPENAI_API_KEY` (vazia) e `OPENAI_MODEL=gpt-4o-mini`.

### Frontend (`client/`)
- **`src/pages/Reports.tsx`**:
  - Seletor de período (`RangePicker` com presets: 7d, 30d, este mês, 90d).
  - 4 `StatCard`s: receita, vendas, ticket médio, vendedores ativos.
  - Gráfico de receita por dia (reusa `components/RevenueChart`).
  - Tabelas **Por plano** e **Por vendedor**.
  - Card **Insights de IA** com botão sob demanda + renderizador leve de markdown (`MarkdownLite`: títulos, negrito, bullets).
  - Botão desabilitado (com tooltip) se IA não configurada ou sem vendas no período; trata erro 503.
- **`src/types/index.ts`** — tipos `CompanyReport`, `ReportBreakdownItem`, `ReportDayPoint`, `ReportInsights`.
- **`src/hooks/useReports.ts`** — `useCompanyReport` (query) + `useReportInsights` (mutation, sob demanda).
- **`src/App.tsx`** — rota `/reports`.
- **`src/components/AppLayout.tsx`** — item **Relatórios** no menu (ícone `BarChartOutlined`, roles MASTER/MANAGER).

## Arquivos alterados/criados
**Criados**
- `server/src/services/ReportService.ts`
- `server/src/services/AiInsightsService.ts`
- `server/src/routes/reports.ts`
- `client/src/pages/Reports.tsx`
- `client/src/hooks/useReports.ts`

**Editados**
- `server/src/index.ts`
- `server/.env`, `server/.env.example`
- `client/src/types/index.ts`
- `client/src/App.tsx`
- `client/src/components/AppLayout.tsx`

## Verificação
- `tsc --noEmit` ✅ server e client
- `npm run build` ✅ (bundle gerado)
- `npm run lint` ⚠️ quebrado no projeto inteiro (sem config de eslint → cai no eslint 6.4.0 global). **Pré-existente**, não relacionado a estas mudanças.

## Pendências / próximos passos
1. Preencher `OPENAI_API_KEY` em `server/.env` (sem ela, a página mostra métricas normalmente; só os insights ficam indisponíveis). ✅ feito.
2. Aplicar o build em produção: `npm run build` + `pm2 restart unifi-ak2-api`. ✅ feito.
3. **Opcional (decisão em aberto):** incluir uso de rede do UniFi (taxa de ativação de vouchers, planos mais consumidos) ao relatório — hoje cobre apenas vendas + viagens.
4. ~~Remover o vendedor da UI de relatórios~~ ✅ feito (ver seção abaixo).

## Ajuste — insights mais acertivos (foco em volume)
- A IA passou a tratar a **quantidade de vendas por viagem** como métrica central; vendedor é ignorado; planos são entendidos como personalizados por embarcação/trajeto (sem comparação cruzada).
- `ReportService` ganhou `byTrip` (`ReportTripPoint`) com numeração cronológica e variação % entre viagens.
- `AiInsightsService`: `SYSTEM_PROMPT` reescrito (seções Veredito / Evolução das viagens / Mix de planos / Pontos de atenção / Recomendações), `temperature` 0.3.
- `Reports.tsx`: card "Evolução por viagem (caixa)" (gráfico + tabela com variação vs. anterior).

## Relatório geral da frota (todas as embarcações)
- **Acesso:** MASTER sempre; demais usuários só com permissão concedida pelo MASTER (campo `User.canViewGlobalReports`, migração `add_can_view_global_reports`).
- **Backend:**
  - `ReportService.buildGlobalReport(range)` → `GlobalReport` (resumo da frota, `byCompany` ordenado por nº de vendas, `byDay`).
  - `AiInsightsService.generateGlobalInsights` + `GLOBAL_SYSTEM_PROMPT` (ranking de embarcações por volume; aponta líderes e paradas).
  - Rotas `GET /api/reports/global` e `POST /api/reports/global/insights` com guard `authorizeGlobalReports`.
  - `PATCH /api/users/:id/global-reports` (MASTER) concede/revoga; flag incluída em login, `/me` e listagem de usuários.
- **Frontend:**
  - Página `GlobalReports.tsx` (rota `/global-reports`): StatCards da frota, "Ranking de embarcações por vendas" (com barra de participação) e insights de IA.
  - Menu **Relatório Geral** visível ao MASTER e a quem tem a permissão.
  - Página de Usuários: switch "Relatório geral" (só MASTER) para conceder/revogar.
  - `MarkdownLite` extraído para `components/MarkdownLite.tsx` (compartilhado entre as duas páginas de relatório).

## Dashboard por mês (navegação entre meses)
- `Dashboard.tsx`: navegador de mês no topo (setas ◀ ▶ + mês por extenso em PT, ex. "Junho de 2026" + atalho "Mês atual"). Seta de avançar desabilitada no mês corrente (sem futuro).
- **Por mês** (filtrado no client a partir dos vouchers já carregados — sem chamada extra ao backend):
  - **Vouchers no mês** → vouchers gerados no mês (`generatedAt`).
  - **Receita do mês** + gráfico "Receita — <mês>" → vendas com `registeredAt` no mês (mantém a regra de negócio).
- **Sempre ao vivo** (independente do mês): **Pendentes** e **Ativos** contam o status atual de todos os vouchers da empresa.

## Remoção do vendedor da página de Relatórios
- `Reports.tsx`: removidos o StatCard "Vendedores ativos" (linha agora com 3 cards: Receita, Vendas, Ticket médio) e a tabela "Por vendedor" (a tabela "Por plano" passou a ocupar a largura total). Ícone `TeamOutlined` removido dos imports.
- Backend mantém `bySeller` no `CompanyReport` (compatibilidade); apenas não é mais exibido. A IA já ignorava o vendedor.
