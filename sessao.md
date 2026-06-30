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

## Relatórios (por embarcação) espelhando o Relatório Geral
- `Reports.tsx` reestruturado para o mesmo layout do `GlobalReports.tsx`:
  - StatCards em ordem **volume-first**: Vendas → Receita → Ticket médio.
  - Tabela "Por plano" substituída por **"Ranking de planos por vendas"** no padrão do ranking de embarcações: posição `#`, plano, **Vendas com barra de progresso** (`Progress`), **Participação %** no total e Receita — ordenado por quantidade de vendas (client-side).
  - Sequência: Cards → Ranking de planos → Evolução por viagem (gráfico + tabela) → Receita por dia → Insights de IA.
- `breakdownColumns` removido (não mais usado); `Progress` adicionado aos imports.

## Revisão da aplicação — correções (commits `581bc8c` e `6e9f7c2`)
Revisão completa do backend (rotas, serviços, job de sync, auth) e das superfícies recentes do front. Achados corrigidos:

- **#1 [Alto] Vazamento entre empresas em `GET /api/vouchers`** (`routes/vouchers.ts`): a listagem só restringia o SELLER. Agora escopa por papel **antes** da query — MANAGER limitado às empresas que gerencia (403 para `companyId` fora do alcance; sem `companyId`, filtra por `companyId IN (geridas)`); MASTER vê tudo. Bônus: `status` validado contra o enum (antes `as any` virava 500).
- **#2 [Médio] Dashboard mensal incompleto** (novo `routes/dashboard.ts`): o dashboard filtrava no client uma lista capada em `take: 500` e sem recorte de data, deixando meses antigos incompletos. Criado `GET /api/dashboard/company/:id?from&to` que calcula no banco (vouchers/receita do período + `byDay`; pendentes/ativos ao vivo). `Dashboard.tsx` agora usa `useDashboardSummary`. `localDay` exportado do `ReportService`.
- **#3 [Baixo] `GET /api/sites`** restrito a `MASTER` (não expor topologia a MANAGER/SELLER).
- **#4 [Baixo] CORS** aberto → allowlist via `CORS_ORIGIN` (same-origin segue liberado; prod/nginx e dev/Vite são same-origin). Documentado no `.env.example`.
- **#5 [Baixo] Rate limit no login** (`routes/auth.ts`): `express-rate-limit` (10/IP/15min, ignora sucessos) + `app.set('trust proxy', 1)` para o IP real atrás do nginx.

**Não corrigidos (aceitáveis no cenário atual):** `missCounts` do sync em memória (só relevante se escalar para cluster; PM2 hoje é fork/1 instância) e `createVouchers` sem transação (vouchers órfãos no UniFi são recuperáveis via `/importable`).

**Pontos fortes confirmados:** controle de acesso por empresa via `companyAccessError`; venda criada no sync caindo no caixa aberto no momento do uso; idempotência via `Sale.voucherId @unique`; erros centralizados + Zod; sem `dangerouslySetInnerHTML`; segredos fora do git.

## Dashboard "Vendas no mês" batendo com o relatório (commit `b59aa95`)
- **Sintoma reportado:** o total do dashboard não batia com o relatório na empresa ANNA KAROLINA II.
- **Causa:** não era erro de cálculo — métricas diferentes. O dashboard mostrava **"Vouchers no mês" (gerados = 790)** e o relatório mostra **"Vendas" (vouchers conectados = 260)**. A **Receita** já batia nos dois (R$ 4.740). Confirmado por consulta direta ao banco.
- **Correção:** o card virou **"Vendas no mês"** (vouchers conectados), igual ao relatório. `dashboard.ts` retorna `salesCount` (= `sales.length`) no lugar de `total` (removida a contagem de vouchers gerados); `useDashboard.ts` e `Dashboard.tsx` atualizados (ícone `ShoppingCartOutlined`). Pendentes/Ativos seguem ao vivo; Receita inalterada.
- **Limpeza de dados (sem código):** havia duas empresas "ANNA KAROLINA II" — a inativa (`60227984…`, mesmo `unifiSiteId`) era um cadastro duplicado **vazio** (0 vouchers/vendas/planos/vendedores, só 1 viagem auto-criada) e invisível na UI (filtros `active:true`). Removida via transação (viagem + empresa) após guarda confirmando 0 vouchers/vendas. Nenhum dado real afetado.

## Regressão de CORS no login — corrigida (commit `933ad2d`)
- **Sintoma:** não era possível logar pelo navegador (curl sem `Origin` funcionava).
- **Causa:** a allowlist do CORS (item #4 da revisão) retornava **500** sempre que havia header `Origin` — e o navegador envia `Origin` até em POST same-origin. Isso quebrava o login e **toda requisição de escrita** pelo navegador. Reproduzido com `curl -H "Origin: ..."` → 500.
- **Correção (`index.ts`):** o CORS agora **sempre libera same-origin** (compara `new URL(origin).host` com `req.headers.host`) e as origens cross listadas em `CORS_ORIGIN`; para origem não permitida, apenas **omite** os cabeçalhos CORS (o navegador bloqueia a leitura) em vez de lançar erro/500.
- **Verificado:** same-origin → 401 com `Access-Control-Allow-Origin`; cross malicioso → sem `ACAO`; login real do master → 200.
- **Pendência de segurança:** a senha do master ainda é a padrão do seed (`changeme`) — recomendado trocar.

## Relatório geral escopado por acesso do usuário (commit `1a90c07`)
- **Pedido:** o relatório geral deve consolidar só as embarcações a que o usuário tem acesso (não sempre a frota inteira).
- **Backend:**
  - Novo `accessibleCompanyIds(user)` em `lib/companyAccess.ts`: `null` (todas) para MASTER; empresas geridas para MANAGER; a própria para SELLER.
  - `buildGlobalReport(range, companyIds?)` filtra empresas, vendas e viagens ativas pelas acessíveis (sem filtro = frota inteira / MASTER).
  - `routes/reports.ts`: `/global` e `/global/insights` calculam e passam as empresas acessíveis.
  - `AiInsightsService`: prompt do relatório geral não assume mais "frota inteira" → "conjunto de embarcações a que o usuário tem acesso".
- **Sem mudança no front:** a página renderiza o `byCompany` devolvido; `totalCompanies` já reflete o conjunto acessível.
- **Verificado:** MASTER → 7 empresas / 1000 vendas; MANAGER que gerencia 6 → 6 empresas / 968 vendas (a 7ª empresa e suas vendas ficaram de fora).
