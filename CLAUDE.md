# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Sobre o projeto

Aplicação de gerenciamento de hotspot UniFi para embarcações. Gerencia vouchers de acesso à internet, usuários hierárquicos, planos por empresa e controle financeiro por viagem.

## Papéis e permissões

| Papel | Criado por | Capacidades |
|-------|-----------|-------------|
| `MASTER` | (único, seed) | Cria gerentes, acessa tudo, concede acesso ao relatório geral da frota |
| `MANAGER` | Master | Cria vendedores, gerencia empresas (N:N), cria planos, gera vouchers, controla caixa |
| `SELLER` | Manager | Vinculado a **uma** empresa; gera vouchers dessa empresa |

> O MASTER pode conceder acesso ao **relatório geral da frota** a qualquer usuário que ele criou, via o campo `User.canViewGlobalReports` (toggle na página de Usuários).

## Modelo de domínio

```
User (MASTER/MANAGER/SELLER)
  └─ MANAGER ──< ManagerCompany >── Company (Embarcação)
  └─ SELLER ──→ Company (1 empresa)

Company
  ├──< Plan (nome, preço, limites de tempo/dados/banda)
  ├──< Trip (viagem = período de caixa)
  │     ├──< Voucher (gerado pelo vendedor)
  │     └──< Sale (registrada apenas quando voucher é CONECTADO)
  └─ unifiSiteId → UUID do site no UniFi

Voucher
  ├─ status: PENDING → ACTIVE → EXPIRED
  ├─ activatedAt: preenchido quando conectado na rede (via sync com UniFi)
  └─ Sale criada automaticamente ao detectar activatedAt

Trip (Caixa/Viagem)
  ├─ Fechar caixa: seta closedAt e cria nova Trip automaticamente
  └─ Vouchers gerados em viagens anteriores permanecem válidos
```

**Regra crítica de venda:** A `Sale` é criada pelo job de sincronização (`VoucherSyncService`) quando detecta que `activatedAt` foi preenchido na API UniFi — nunca no momento da geração do voucher.

## Relatórios, dashboard e insights de IA

### Dashboard por mês
A página `Dashboard` tem um navegador de mês (setas + mês por extenso em PT). **Vouchers do mês** (por `generatedAt`) e **Receita do mês** (por `Sale.registeredAt`) + o gráfico reagem ao mês selecionado; **Pendentes/Ativos** são sempre ao vivo (status atual de todos os vouchers). Tudo é filtrado no client a partir dos vouchers já carregados — sem chamada extra ao backend.

### Relatórios (`ReportService`)
- `buildCompanyReport(companyId, range)` → `CompanyReport`: resumo, `byPlan`, `bySeller` (mantido por compatibilidade, **não exibido**), `byDay` e `byTrip` (`ReportTripPoint`, numeração cronológica das viagens + variação % entre elas).
- `buildGlobalReport(range, companyIds?)` → `GlobalReport`: consolida as embarcações **a que o usuário tem acesso** (sem `companyIds` = toda a frota, caso do MASTER); `byCompany` ordenado por **quantidade de vendas**; `byDay` agregado. As empresas acessíveis vêm de `accessibleCompanyIds(user)` em `lib/companyAccess.ts` (`null`=todas/MASTER; geridas para MANAGER; a própria para SELLER).
- A página de Relatórios (por embarcação) e o Relatório Geral compartilham o mesmo layout: StatCards volume-first, ranking com barra de participação (`MarkdownLite` é compartilhado em `client/src/components/`).

### Insights de IA (`AiInsightsService`)
- Integração **sem dependência nova**: usa `axios` para a OpenAI Chat Completions. Opt-in (botão sob demanda); sem `OPENAI_API_KEY` os relatórios funcionam e só o botão fica indisponível (rota responde 503 via `AiNotConfiguredError`).
- **Foco do negócio (refletido nos prompts):** a métrica central é a **quantidade de vendas** (volume) por viagem/embarcação; o **vendedor é irrelevante** (não citar); planos são **personalizados por embarcação/trajeto** (não comparar entre embarcações).

### Rotas e acesso (`src/routes/reports.ts`)
- `GET /api/reports/company/:companyId` e `POST /api/reports/company/:companyId/insights` — MASTER/MANAGER (+ `companyAccessError`).
- `GET /api/reports/global` e `POST /api/reports/global/insights` — guard `authorizeGlobalReports`: MASTER sempre; demais só com `canViewGlobalReports`. O relatório é **escopado por acesso**: cada usuário só vê o consolidado das embarcações a que tem acesso (MASTER = frota inteira). O prompt da IA reflete isso ("conjunto de embarcações a que o usuário tem acesso", não "frota inteira").
- `PATCH /api/users/:id/global-reports` (MASTER) concede/revoga a permissão. A flag viaja no login, no `/me` e na listagem de usuários.

## Estrutura do monorepo

```
/
├── client/          # React + TypeScript + Ant Design
├── server/          # Node.js + TypeScript + Express
├── package.json     # Workspace root (npm workspaces)
└── docker-compose.yml
```

## Comandos principais

```bash
# Instalar dependências de todos os workspaces
npm install

# Rodar frontend e backend simultaneamente
npm run dev

# Apenas frontend (porta 3000)
npm run dev:client

# Apenas backend (porta 4000)
npm run dev:server

# Build de produção
npm run build

# Testes
npm test                      # todos
npm test --workspace=server   # só backend
npm test --workspace=client   # só frontend

# Um teste específico no backend
cd server && npx jest src/path/to/test.spec.ts

# Lint
npm run lint
```

## Arquitetura

### Backend (`/server`)

- **Framework**: Express.js com TypeScript
- **ORM**: Prisma + PostgreSQL
- **Autenticação**: JWT para sessões da aplicação; **API Key** (`X-API-KEY`) para chamadas à API do controlador UniFi
- **Estrutura de pastas**:
  - `src/routes/` — rotas Express por domínio (auth, users, companies, plans, vouchers, sales, trips, reports, …)
  - `src/services/` — lógica de negócio: `UnifiService` (API UniFi), `VoucherSyncService` (sync periódico + criação de `Sale`), `ReportService` (relatórios), `AiInsightsService` (insights OpenAI)
  - `src/middlewares/` — `authenticate` (JWT) e `authorize(...roles)`
  - `src/lib/` — utilitários (`prisma`, `companyAccess`)
  - `prisma/` — `schema.prisma` e migrações

### Frontend (`/client`)

- **Framework**: React + TypeScript (Vite)
- **UI**: Ant Design — usar componentes `antd` nativos; evitar estilização inline quando há componente equivalente
- **Dados**: React Query (`@tanstack/react-query`) para cache e sincronização com o servidor
- **Roteamento**: React Router v6
- **Estrutura de pastas**:
  - `src/pages/` — uma pasta por página/rota principal
  - `src/components/` — componentes reutilizáveis
  - `src/services/api.ts` — cliente Axios com interceptors (token JWT, refresh)
  - `src/hooks/` — hooks de dados usando React Query

### Integração com UniFi Network API v1

A API usa **API Key** (não cookie de sessão). A chave é gerada em: UniFi Application → Settings → Integrations.

**Autenticação:** header `X-API-KEY: {api_key}` em todas as requisições.

**Base URL local:** `https://{controller-ip}/proxy/network/integration/v1`

**Endpoints utilizados:**

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/v1/info` | Versão da aplicação |
| `GET` | `/v1/sites` | Listar sites (`offset`, `limit`, `filter`) |
| `GET` | `/v1/sites/{siteId}/clients` | Clientes conectados |
| `GET` | `/v1/sites/{siteId}/clients/{clientId}` | Detalhes de um cliente |
| `POST` | `/v1/sites/{siteId}/clients/{clientId}/actions` | Ação no cliente (ex: `AUTHORIZE_GUEST_ACCESS`) |
| `GET` | `/v1/sites/{siteId}/hotspot/vouchers` | Listar vouchers |
| `GET` | `/v1/sites/{siteId}/hotspot/vouchers/{voucherId}` | Detalhes de um voucher |
| `DELETE` | `/v1/sites/{siteId}/hotspot/vouchers` | Deletar vouchers em lote (com `filter`) |
| `DELETE` | `/v1/sites/{siteId}/hotspot/vouchers/{voucherId}` | Deletar voucher específico |

**Filtros:** endpoints de listagem aceitam `?filter=` com sintaxe `property.function(value)`. Exemplos: `expired.eq(false)`, `name.like('guest*')`, `and(expired.eq(false), dataUsageLimitMBytes.isNotNull())`.

**Paginação:** todos os lists retornam `{ offset, limit, count, totalCount, data[] }`.

**Ação de autorização de guest:**
```json
POST /v1/sites/{siteId}/clients/{clientId}/actions
{
  "action": "AUTHORIZE_GUEST_ACCESS",
  "timeLimitMinutes": 60,
  "dataUsageLimitMBytes": 1024,
  "rxRateLimitKbps": 5000,
  "txRateLimitKbps": 2000
}
```

> Instalações locais usam certificado TLS autoassinado — configurar `axios` com `httpsAgent: new https.Agent({ rejectUnauthorized: false })` no `UnifiService`.

### Variáveis de ambiente

O servidor lê de `server/.env`:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/unifi_hotspot
UNIFI_HOST=https://192.168.1.1
UNIFI_API_KEY=sua_api_key_gerada_no_painel
UNIFI_SITE_ID=uuid-do-site
JWT_SECRET=...
JWT_EXPIRES_IN=8h
VOUCHER_SYNC_INTERVAL_MINUTES=2

# Insights de IA (opcional). Sem a chave, os relatórios funcionam;
# só o botão "Gerar insights" fica indisponível.
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

## Banco de dados

Usar Prisma para todas as operações com PostgreSQL. Após editar `schema.prisma`, rodar:

```bash
cd server && npx prisma migrate dev --name descricao_da_mudanca
```

Dados que vivem apenas no PostgreSQL (não no UniFi): logs de uso, configurações da aplicação, usuários locais da dashboard. Dados de rede (clientes, vouchers ativos) são lidos em tempo real da API UniFi e não duplicados localmente.
