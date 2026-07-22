# Sistema de Pagamentos — Estado Atual (branch `dev`)

Resumo do que foi implementado a partir de `docs/TELEGRAM_VERCEL_PAGAMENTOS_ARQUITETURA.md`
(repositório `HRBETTING`), das limitações conhecidas, e do que falta para ir
para produção real.

## O que foi implementado

Arquitetura simplificada: **sem login no site** — o `telegram_user_id` é a
identidade principal desde o primeiro `/start`. O canal HRBETTING atual
passou a ser o canal premium (acesso por subscrição ativa).

### Ficheiros novos

- `lib/supabase.ts` — cliente Supabase (service role) + `ensureSubscriber`,
  `getSubscriberStatus`.
- `lib/stripe.ts` — cliente Stripe + `createCheckoutSession`.
- `lib/telegram.ts` — chamadas partilhadas ao Bot API: `sendTelegramMessage`,
  `approveChatJoinRequest`, `declineChatJoinRequest`, `kickChatMember`.
- `supabase/migrations/0001_subscribers.sql` — tabelas `subscribers`
  (chave `telegram_user_id`) e `payments`, com RLS ligado (só o service role
  acede).
- `app/api/payments/webhook/route.ts` — recebe eventos do Stripe
  (`checkout.session.completed`, `customer.subscription.created/updated/deleted`,
  `invoice.payment_failed`), sincroniza o estado na Supabase, notifica o
  utilizador no Telegram.
- `app/api/cron/remove-expired/route.ts` + `vercel.json` — rede de segurança
  diária que remove subscritores expirados do canal.

### Alterado

- `app/api/telegram/route.ts` — novo passo "Assinar Premium" / "Pagar agora"
  (Passo 1) que cria uma sessão de Checkout do Stripe; tratamento de
  `chat_join_request` (aprova/recusa consoante a subscrição esteja ativa).

### Variáveis de ambiente novas

| Variável | Onde é usada |
| --- | --- |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Ligação à base de dados |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID` | Checkout + webhook |
| `TELEGRAM_PREMIUM_CHAT_ID` | ID do canal (tem fallback fixo já correto: `-1004469029288`) |
| `CRON_SECRET` | Autentica o cron diário |
| `SIGNUP_URL` | URL de sucesso/cancelamento do Checkout |

## Como foi testado

Testado localmente (servidor de dev + Stripe CLI via `stripe listen`, que
encaminha webhooks reais do Stripe para o localhost sem precisar de URL
público), com credenciais reais em modo de teste:

1. "Assinar Premium" → sessão de Checkout real criada.
2. Subscrição de teste real criada via API do Stripe (cartão de teste oficial
   — a iframe do cartão do Checkout não é acessível por automação de browser).
3. Webhook sincronizou a Supabase corretamente (`status`, IDs do Stripe,
   `current_period_end`).
4. Pedido de entrada no canal com subscrição ativa → **aprovado**.
5. Cancelamento da subscrição → webhook marcou `canceled` e tentou remover do
   canal.
6. Dados de teste limpos no final (Stripe + Supabase).

## Limitações conhecidas

1. **Vercel Deployment Protection (SSO) nos previews.** O URL da `dev`
   (`https://hrbetting-api-git-dev-tanjil-khans-projects.vercel.app/`) exige
   login Vercel. Para ti, a navegar já com sessão iniciada, é transparente.
   Mas **serviços externos automáticos não conseguem fazer login** — por
   isso o Stripe não consegue entregar webhooks reais a este URL, nem o
   Telegram conseguiria se o bot apontasse para lá. Produção não tem esta
   proteção.
2. **`STRIPE_WEBHOOK_SECRET` atual é temporário**, gerado pelo `stripe listen`
   local — só funciona enquanto esse comando corre no meu/teu computador. Não
   serve para um webhook real apontado a um URL publicado.
3. **A iframe do cartão do Stripe Checkout não é acessível por automação de
   browser** (isolamento propositado por conformidade PCI). Os testes de
   pagamento completo foram feitos criando a subscrição diretamente via API
   do Stripe, não clicando no formulário.
4. **Os Cron Jobs da Vercel só correm em deployments de Produção**, nunca em
   Preview — por isso a remoção diária de expirados não é testável
   automaticamente na `dev`, só manualmente (`curl` com o `CRON_SECRET`).
5. **"Pedidos de Adesão" no canal Telegram é uma definição manual** — só
   pode ser ativada por ti, no Telegram, como admin do canal (não é possível
   via Bot API).
6. **Sem sistema de recuperação de conta** — a identidade é sempre o
   `telegram_user_id`; não há forma de recuperar acesso se a conta de
   Telegram do utilizador mudar ou for perdida.
7. **Credenciais atuais do Stripe são de modo de teste** (`sk_test_...`) —
   produção precisa das chaves e do preço em modo real (`sk_live_...`).

## Checklist para produção real

1. **Ativar "Pedidos de Adesão"** no canal HRBETTING (Telegram → Editar canal
   → Definições de Subscritores), se ainda não estiver ativo.
2. **Stripe em modo real**: criar o produto/preço em modo live (não teste) e
   obter o novo `STRIPE_PRICE_ID` e `STRIPE_SECRET_KEY` (`sk_live_...`).
3. **Configurar o webhook definitivo no Stripe** (Developers → Webhooks, modo
   live) a apontar para `https://hrbetting-api.vercel.app/api/payments/webhook`,
   subscrito aos eventos: `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`. Copiar o
   `STRIPE_WEBHOOK_SECRET` definitivo gerado.
4. **Adicionar todas as env vars à Vercel em Production**:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` (live),
   `STRIPE_WEBHOOK_SECRET` (live, do passo 3), `STRIPE_PRICE_ID` (live).
   `CRON_SECRET`, `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
   `TELEGRAM_CHANNEL_URL` já lá estão. `SIGNUP_URL` não precisa de ser
   definida em Produção — o fallback do código já aponta para o URL certo
   (`https://hrbetting-api.vercel.app/`).
5. **Aplicar a migração** `supabase/migrations/0001_subscribers.sql` na base
   de dados de produção (mesmo projeto Supabase, ou o de produção se vieres a
   separar dev/prod).
6. **Promover a branch `dev` para `master`** (PR + merge, ou promoção direta
   do deployment na Vercel).
7. **Fazer um pagamento real de teste** (valor pequeno, cartão real, depois
   cancela/reembolsa) para confirmar que a ligação em produção funciona de
   ponta a ponta antes de anunciar a subscrição a utilizadores reais.
8. **Acompanhar os primeiros pagamentos reais** via logs da Vercel e o painel
   de eventos do Stripe.
