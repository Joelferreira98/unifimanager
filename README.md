# UniFi Hotspot Manager

Aplicação de gerenciamento de hotspot UniFi para **embarcações**. Gera e controla vouchers de acesso à internet, organiza usuários hierárquicos, planos por embarcação e o controle financeiro por viagem (caixa), com relatórios e insights de IA.

---

## Funcionalidades

- **Vouchers** — geração, listagem e impressão personalizada (template por embarcação); sincronização automática com o controlador UniFi.
- **Usuários hierárquicos** — papéis MASTER, MANAGER e SELLER com permissões distintas.
- **Empresas (embarcações)** — vínculo N:N com gerentes, planos próprios e site UniFi.
- **Planos** — personalizados por embarcação/trajeto (tempo, dados, limites de banda, preço).
- **Caixa por viagem** — cada viagem é um ciclo de caixa; fechar o caixa abre uma nova viagem automaticamente.
- **Dashboard** — resumo por mês com navegação entre meses (vouchers e receita do mês; pendentes/ativos ao vivo).
- **Relatórios por embarcação** — receita, vendas, ticket médio, ranking de planos por vendas, evolução por viagem e receita diária.
- **Relatório geral da frota** — consolida todas as embarcações (ranking por volume de vendas), acessível ao MASTER e a quem ele permitir.
- **Insights de IA (OpenAI)** — análise textual sob demanda, focada no volume de vendas e na evolução entre viagens.

---

## Stack

| Camada | Tecnologias |
|--------|-------------|
| Frontend | React + TypeScript (Vite), Ant Design v5, React Query, Zustand, React Router v6, Recharts |
| Backend | Node.js + TypeScript, Express, Prisma ORM |
| Banco | PostgreSQL |
| Auth | JWT (sessões da app) + API Key do UniFi (chamadas ao controlador) |
| IA | OpenAI Chat Completions (opcional) |

---

## Estrutura do monorepo

```
/
├── client/          # React + TypeScript + Ant Design
├── server/          # Node.js + TypeScript + Express + Prisma
├── package.json     # Workspace root (npm workspaces)
└── docker-compose.yml
```

### Backend (`/server`)
- `src/routes/` — rotas Express por domínio (auth, users, companies, plans, vouchers, sales, trips, reports, …)
- `src/services/` — lógica de negócio; `UnifiService`, `ReportService`, `AiInsightsService`, `VoucherSyncService`
- `src/middlewares/` — autenticação JWT e autorização por papel
- `prisma/` — `schema.prisma` e migrações

### Frontend (`/client`)
- `src/pages/` — uma pasta/arquivo por rota principal
- `src/components/` — componentes reutilizáveis
- `src/hooks/` — hooks de dados com React Query
- `src/store/` — estado global (Zustand)
- `src/services/api.ts` — cliente Axios com interceptors (JWT)

---

## Papéis e permissões

| Papel | Criado por | Capacidades |
|-------|-----------|-------------|
| `MASTER` | (único, seed) | Cria gerentes, acessa tudo, concede acesso ao relatório geral |
| `MANAGER` | Master | Cria vendedores, gerencia empresas (N:N), cria planos, gera vouchers, controla caixa |
| `SELLER` | Manager | Vinculado a **uma** empresa; gera vouchers dessa empresa |

## Modelo de domínio

```
User (MASTER/MANAGER/SELLER)
  └─ MANAGER ──< ManagerCompany >── Company (Embarcação)
  └─ SELLER ──→ Company (1 empresa)

Company
  ├──< Plan
  ├──< Trip (viagem = período de caixa)
  │     ├──< Voucher
  │     └──< Sale (criada só quando o voucher é CONECTADO)
  └─ unifiSiteId → site no UniFi
```

> **Regra crítica:** a `Sale` é criada pelo job de sincronização (`VoucherSyncService`) quando detecta que `activatedAt` foi preenchido na API UniFi — **nunca** no momento da geração do voucher.

---

## Configuração

### Pré-requisitos
- Node.js 18+
- PostgreSQL
- Um controlador UniFi com a Network API habilitada e uma **API Key** (UniFi Application → Settings → Integrations)

### Instalação

```bash
# Instala dependências de todos os workspaces
npm install
```

### Variáveis de ambiente

Copie `server/.env.example` para `server/.env` e preencha:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/unifi_hotspot
UNIFI_HOST=https://192.168.1.1
UNIFI_API_KEY=sua_api_key_gerada_no_painel
UNIFI_SITE_ID=uuid-do-site
JWT_SECRET=string_aleatoria_longa
JWT_EXPIRES_IN=8h
VOUCHER_SYNC_INTERVAL_MINUTES=2

# Insights de IA (opcional) — sem a chave, os relatórios funcionam,
# apenas o botão "Gerar insights" fica indisponível.
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Seed do usuário master
MASTER_EMAIL=master@admin.com
MASTER_PASSWORD=changeme
```

### Banco de dados

```bash
cd server
npx prisma migrate dev   # cria/aplica migrações
npm run db:seed          # cria o usuário MASTER inicial
```

---

## Comandos

```bash
npm run dev            # frontend (3000) + backend (4000) juntos
npm run dev:client     # só frontend
npm run dev:server     # só backend
npm run build          # build de produção (server + client)
npm test               # testes (todos os workspaces)
npm run lint           # lint

# Banco (dentro de /server)
npm run db:migrate     # prisma migrate dev
npm run db:seed        # popula o master
npm run db:studio      # abre o Prisma Studio
```

---

## Integração com a UniFi Network API v1

- **Autenticação:** header `X-API-KEY: {api_key}` em todas as requisições.
- **Base URL local:** `https://{controller-ip}/proxy/network/integration/v1`
- Instalações locais usam **TLS autoassinado** — o `UnifiService` configura o axios com `httpsAgent` (`rejectUnauthorized: false`).

Principais endpoints utilizados: `GET /v1/sites`, `GET /v1/sites/{siteId}/clients`, `POST /v1/sites/{siteId}/clients/{clientId}/actions` (`AUTHORIZE_GUEST_ACCESS`), `GET|DELETE /v1/sites/{siteId}/hotspot/vouchers`.

---

## Deploy (produção)

A aplicação roda a partir do build, com PM2 servindo a API e o nginx servindo o `client/dist`:

```bash
npm run build
pm2 restart unifi-ak2-api   # API (porta 4101)
```

Após editar `schema.prisma`, gere e aplique a migração antes do restart:

```bash
cd server && npx prisma migrate deploy
```

---

## Licença

Projeto privado.
