# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Sobre o projeto

Aplicação de gerenciamento de hotspot UniFi para embarcações. Gerencia vouchers de acesso à internet, usuários hierárquicos, planos por empresa e controle financeiro por viagem.

## Papéis e permissões

| Papel | Criado por | Capacidades |
|-------|-----------|-------------|
| `MASTER` | (único, seed) | Cria gerentes, acessa tudo |
| `MANAGER` | Master | Cria vendedores, gerencia empresas (N:N), cria planos, gera vouchers, controla caixa |
| `SELLER` | Manager | Vinculado a **uma** empresa; gera vouchers dessa empresa |

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
- **Autenticação**: JWT para sessões da aplicação; cookie de sessão UniFi para chamadas à API do controlador
- **Estrutura de pastas**:
  - `src/routes/` — rotas Express agrupadas por domínio (`hotspot/`, `clients/`, `vouchers/`)
  - `src/services/` — lógica de negócio; `UnifiService` encapsula todas as chamadas à API UniFi OS
  - `src/prisma/` — schema e migrações
  - `src/middlewares/` — auth JWT, tratamento de erros

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
```

## Banco de dados

Usar Prisma para todas as operações com PostgreSQL. Após editar `schema.prisma`, rodar:

```bash
cd server && npx prisma migrate dev --name descricao_da_mudanca
```

Dados que vivem apenas no PostgreSQL (não no UniFi): logs de uso, configurações da aplicação, usuários locais da dashboard. Dados de rede (clientes, vouchers ativos) são lidos em tempo real da API UniFi e não duplicados localmente.
