# Sistema de Pagamentos — Estado Atual

> **Atualização:** promovido de `dev` para `master` (produção) — o bot real
> do Telegram já corre este código. O Stripe continua em **modo de teste**
> (`sk_test_...` / preço de teste) de propósito, para dar para validar o
> fluxo completo com o bot real sem cobrar ninguém a sério. Ver secção
> "Checklist para produção real" para o que falta trocar para modo live.

Resumo do que foi implementado a partir de `docs/TELEGRAM_VERCEL_PAGAMENTOS_ARQUITETURA.md`
(repositório `HRBETTING`), das limitações conhecidas, e do que falta para ir
para produção real (modo live).

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

Depois de promover para `master`, repeti o teste do passo 1 diretamente
contra `https://hrbetting-api.vercel.app/api/telegram` (produção real) —
sessão de Checkout criada e registo gravado na Supabase corretamente,
depois limpo.

## Limitações conhecidas

1. **Vercel Deployment Protection (SSO) nos previews** (deixou de afetar o
   fluxo principal, já que produção não tem esta proteção). Continua a
   aplicar-se ao URL da `dev`
   (`https://hrbetting-api-git-dev-tanjil-khans-projects.vercel.app/`), caso
   voltes a usá-lo para testar alterações futuras antes de promover.
2. **`STRIPE_WEBHOOK_SECRET` de produção já é definitivo** — criado via API
   do Stripe (`webhook_endpoints`), a apontar para
   `https://hrbetting-api.vercel.app/api/payments/webhook`, ainda em modo de
   teste. Quando trocares para modo live (checklist abaixo), este endpoint
   webhook tem de ser recriado em modo live — os endpoints de teste e live
   são sempre separados no Stripe.
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

## Checklist para produção real (modo live)

Já feito: `dev` promovida para `master`, env vars de Supabase/Stripe (modo
teste) na Vercel em Production, webhook do Stripe (modo teste) criado a
apontar para `https://hrbetting-api.vercel.app/api/payments/webhook`,
migração aplicada (mesmo projeto Supabase usado em dev e produção). O bot
real já usa este código — só falta trocar o Stripe para modo live antes de
cobrar utilizadores a sério.

1. **Ativar "Pedidos de Adesão"** no canal HRBETTING (Telegram → Editar canal
   → Definições de Subscritores), se ainda não estiver ativo.
2. **Stripe em modo live**: criar o produto/preço em modo live (não teste) no
   dashboard, obter o novo `STRIPE_PRICE_ID` e `STRIPE_SECRET_KEY`
   (`sk_live_...`).
3. **Criar o webhook em modo live** (Developers → Webhooks, com o toggle de
   "Test mode" desligado) a apontar para o mesmo URL
   (`https://hrbetting-api.vercel.app/api/payments/webhook`), com os mesmos
   eventos: `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`. Copiar o novo `STRIPE_WEBHOOK_SECRET` (é sempre
   diferente do de modo teste).
4. **Substituir em Production**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   e `STRIPE_PRICE_ID` pelos valores live do passo 2 e 3 (`vercel env rm` +
   `vercel env add`, ou no dashboard).
5. **Fazer um pagamento real de teste** (valor pequeno, cartão real, depois
   cancela/reembolsa) para confirmar que a ligação em produção funciona de
   ponta a ponta antes de anunciar a subscrição a utilizadores reais.
6. **Acompanhar os primeiros pagamentos reais** via logs da Vercel e o painel
   de eventos do Stripe.
