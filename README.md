# HR Betting API

API em Next.js que não calcula nada — a análise dos jogos e o cálculo de probabilidades são feitos pela aplicação desktop HR Betting (C# / WPF). Este projeto é a ponte entre essa app e o Telegram: recebe os sinais já calculados, entrega-os aos utilizadores através do bot (onboarding, picks, subscrição premium) e trata o sistema de pagamentos (Stripe + Supabase) que controla o acesso ao canal.

## Stack técnica

- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript
- Tailwind CSS 4
- Vercel Blob (armazenamento privado dos sinais)
- Supabase (estado das subscrições/pagamentos)
- Stripe (Checkout + webhooks de subscrição)

## Estrutura do projeto

```text
app/
  page.tsx                          Página inicial com a lista de mercados suportados
  markets-explorer.tsx              Componente de cliente com filtros e cópia de códigos de mercado
  api/
    health/route.ts                 Endpoint de verificação de estado
    upload-signals/route.ts         Recebe os sinais enviados pela aplicação HR Betting
    telegram/route.ts               Webhook do bot de Telegram (onboarding, picks, pagamentos)
    payments/webhook/route.ts       Webhook do Stripe (sincroniza subscrições na Supabase)
    cron/remove-expired/route.ts    Cron diário: remove subscritores expirados do canal
lib/
  supabase.ts                       Cliente Supabase + helpers de subscritores
  stripe.ts                         Cliente Stripe + criação de sessões de Checkout
  telegram.ts                       Chamadas partilhadas ao Bot API (mensagens, aprovação de entrada)
supabase/
  migrations/0001_subscribers.sql   Tabelas subscribers + payments
docs/
  PRODUCAO_STRIPE_LIVE.md           Guia passo a passo para trocar o Stripe para modo live
vercel.json                         Agendamento do cron diário
```

## Endpoints da API

### `GET /api/health`

Endpoint de verificação de estado, sem autenticação.

### `POST /api/upload-signals`

Recebe os sinais por intervalo enviados pela aplicação HR Betting e guarda-os no Vercel Blob (acesso privado), num ficheiro por dia (`signals/<dia>.json`).

Corpo do pedido:

```json
{
  "secret": "HRBETTING_SECRET",
  "day": "17-07-2026",
  "intervals": {
    "17:00-18:00": "texto do sinal"
  }
}
```

Requer que `secret` corresponda à variável de ambiente `HRBETTING_SECRET`.

### `POST /api/telegram`

Webhook do bot de Telegram. Valida o cabeçalho `x-telegram-bot-api-secret-token` contra `TELEGRAM_WEBHOOK_SECRET`. Trata três tipos de update:

- **`message` com `/start <payload>`** — se o payload for `<dia>_<intervalo>` (deep link publicado pela app HR Betting no canal), responde em privado com o detalhe dessas picks. Sem payload válido, envia a mensagem de boas-vindas com os botões **Premium** e **Free**.
- **`callback_query`** — navegação do funil: Premium leva ao Passo 1, que cria uma sessão de Checkout do Stripe na hora (o botão "Pagar agora" já é um link real para o Stripe); Free só mostra o link do canal.
- **`chat_join_request`** — quando alguém pede para entrar no canal, consulta a Supabase e aprova ou recusa consoante haja uma subscrição ativa.

Todas as mensagens privadas levam uma marca de água (`*HRBETTING*`) e `protect_content: true`.

### `POST /api/payments/webhook`

Webhook do Stripe. Valida a assinatura (`STRIPE_WEBHOOK_SECRET`) e trata:

- `checkout.session.completed` — primeira ativação; envia a mensagem de confirmação ("Estás a postos! ✅") ao utilizador.
- `customer.subscription.created` / `customer.subscription.updated` — sincroniza estado e data de renovação na Supabase.
- `customer.subscription.deleted` — marca como cancelada e remove o utilizador do canal.
- `invoice.payment_failed` — marca como `past_due`.

### `GET /api/cron/remove-expired`

Rede de segurança diária (agendada em `vercel.json`, só corre em deployments de **Produção** — a Vercel não executa Cron Jobs em Preview). Remove do canal quem tem subscrição cancelada ou em atraso além do fim do período pago. Exige o cabeçalho `Authorization: Bearer <CRON_SECRET>`.

## Fluxo do bot no Telegram

```text
/start (deep link do canal ou link genérico)
  -> boas-vindas, com Premium / Free
       Free    -> link direto do canal (sujeito à mesma aprovação por subscrição)
       Premium -> Passo 1: cria o Checkout do Stripe na hora
                  -> "Pagar agora" (link real) -> paga
                  -> webhook do Stripe confirma -> Supabase: status = active
                  -> pede entrada no canal -> aprovado automaticamente
```

## Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `BOT_TOKEN` | Token do bot de Telegram (obtido no BotFather) |
| `HRBETTING_SECRET` | Segredo partilhado para autenticar os pedidos de `/api/upload-signals` |
| `TELEGRAM_WEBHOOK_SECRET` | Segredo definido no `setWebhook`, validado em cada pedido do Telegram |
| `BLOB_READ_WRITE_TOKEN` | Token de leitura/escrita do Vercel Blob Store (opcional em produção, onde a SDK pode usar OIDC automaticamente; obrigatório em desenvolvimento local) |
| `TELEGRAM_CHANNEL_URL` | Link de convite do canal HRBETTING (privado, sem `@username`) |
| `TELEGRAM_PREMIUM_CHAT_ID` | ID numérico do canal, para aprovar/recusar entradas e remover expirados (tem fallback fixo já correto no código) |
| `SIGNUP_URL` | URL de sucesso/cancelamento do Checkout do Stripe (fallback já aponta para a produção) |
| `CRON_SECRET` | Autentica os pedidos ao cron diário |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Ligação à base de dados de subscrições (nunca a chave `anon`) |
| `STRIPE_SECRET_KEY` | Chave secreta da API do Stripe (`sk_test_...` ou `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Assinatura do endpoint de webhook do Stripe (`whsec_...`) |
| `STRIPE_PRICE_ID` | ID do preço recorrente da subscrição Premium |

Em produção e preview na Vercel, a autenticação no Blob Store pode ser feita automaticamente via OIDC, desde que o Blob Store esteja ligado ao projeto. Em desenvolvimento local é necessário definir `BLOB_READ_WRITE_TOKEN` num ficheiro `.env`.

## Base de dados (Supabase)

Migração em `supabase/migrations/0001_subscribers.sql`: tabelas `subscribers` (chave `telegram_user_id` — não há sistema de login no site, a identidade é sempre o ID do Telegram) e `payments`. RLS ligado sem policies — só o service role (usado pela API) acede.

## Desenvolvimento local

Instalar dependências:

```bash
npm install
```

Criar um ficheiro `.env` na raiz do projeto com as variáveis listadas acima.

Arrancar o servidor de desenvolvimento:

```bash
npm run dev
```

A aplicação fica disponível em [http://localhost:3000](http://localhost:3000).

Para testar o webhook do Stripe localmente sem precisar de um URL público, usar a [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```

O comando imprime um `whsec_...` temporário — usar esse valor como `STRIPE_WEBHOOK_SECRET` local enquanto o comando estiver a correr.

Outros scripts disponíveis:

```bash
npm run build   # build de produção
npm run start   # servir o build de produção
npm run lint    # verificação de lint
```

## Deploy

O projeto está ligado à Vercel, nas branches `dev` (preview) e `master` (produção). O deploy é feito automaticamente a partir do repositório Git, ou manualmente através da CLI:

```bash
npx vercel deploy          # preview
npx vercel deploy --prod   # produção
```

Deployments de preview exigem login na Vercel (SSO) — serviços externos automáticos (Stripe, Telegram) não conseguem entregar webhooks a um URL de preview. Para testar esses fluxos, correr localmente com a Stripe CLI (ver acima) e simular os updates do Telegram diretamente por `curl`.

Para trocar o sistema de pagamentos para modo live (produção real, com cobranças verdadeiras), seguir `docs/PRODUCAO_STRIPE_LIVE.md`.
