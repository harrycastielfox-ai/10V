# SIED — Sistema Integrado de Evidências e Dados

Sistema operacional interno para acompanhamento de inquéritos, representações judiciais, CVLI, medidas protetivas, auditoria e indicadores da unidade (DT Itabela / 23ª COORPIN).

Uso restrito a agentes autorizados. Não é um projeto de código aberto.

## Stack

- [TanStack Start](https://tanstack.com/start) (React 19 + TanStack Router) sobre Vite
- Tailwind CSS 4
- [Supabase](https://supabase.com) (autenticação, banco de dados, RLS)
- Deploy via Cloudflare (Wrangler / Nitro `cloudflare-pages` preset)
- Gerenciador de pacotes: `pnpm`

## Modelo de distribuição

O SIED/10V é um **sistema web interno**, acessado por navegador corporativo e mantido
centralmente. Essa decisão evita dependência de instalação local, permissões de
administrador e ciclos de atualização de executáveis nos computadores institucionais.

Quando a infraestrutura autorizar, o mesmo sistema poderá oferecer instalação como PWA
para atalhos e abertura em janela, sem criar uma segunda aplicação nem duplicar regras
de negócio. Um aplicativo nativo só será avaliado para recursos que realmente dependam
de hardware ou integração local especializada.

## Pré-requisitos

- Node.js 20+
- `pnpm` (`corepack enable` já resolve, a versão fixada está em `package.json` → `packageManager`)
- Um projeto Supabase com o schema aplicado (ver `supabase/migrations`)

## Configuração

Copie `.env.example` para `.env.local` e preencha com as credenciais do seu projeto Supabase:

```bash
cp .env.example .env.local
```

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Use a **publishable/anon key**, nunca a service role key, neste arquivo — ele é lido pelo cliente.

## Rodando localmente

```bash
pnpm install
pnpm run dev
```

O Vite escolhe a porta automaticamente (por padrão `http://localhost:8080`); confira a saída do comando.

Outros scripts úteis:

```bash
pnpm run build     # build de produção (Cloudflare Pages)
pnpm run lint       # eslint
pnpm run format     # prettier --write
```

## Estrutura

```
src/
  routes/        # páginas (TanStack Router baseado em arquivos)
  components/    # componentes de UI compartilhados
  lib/            # repositories, auth, contratos operacionais
  data/           # dados estáticos/derivados
  hooks/          # hooks React compartilhados
supabase/
  migrations/    # histórico de migrations do banco
docs/            # decisões de produto, contratos de dados, diagnósticos de segurança
```

## Segurança e dados

- RLS (Row Level Security) é obrigatória em todas as tabelas sensíveis; nenhuma tabela deve ser lida/escrita diretamente sem passar pelas policies e RPCs previstas.
- Operações críticas (procedimentos, representações, usuários, permissões) devem gerar registro em auditoria.
- Indicadores exibidos no sistema não devem ser inventados — a classificação de cada indicador (real, aproximado, heurístico) está documentada em `docs/central-pendencias-contrato-indicadores.md`.

Para mais contexto de produto e decisões arquiteturais, veja a pasta [`docs/`](docs/), especialmente [`docs/visao-produto-sied.md`](docs/visao-produto-sied.md) e [`docs/identidade-sied.md`](docs/identidade-sied.md).
