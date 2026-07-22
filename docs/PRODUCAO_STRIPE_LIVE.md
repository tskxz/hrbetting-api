# Ativar o Stripe em modo live (produção real)

Guia passo a passo para trocar o sistema de pagamentos de modo de teste
para modo live — incluindo como obter cada chave do Stripe do zero, numa
conta nova. Ver também [docs/PAGAMENTOS_STATUS.md](PAGAMENTOS_STATUS.md)
para o estado geral do sistema.

Resumo do que muda: 3 variáveis de ambiente (`STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`), sempre em par — nunca misturar
uma chave de teste com um price ou webhook de live, ou vice-versa. O
Stripe trata modo de teste e modo live como dois ambientes completamente
separados: produtos, preços, chaves e webhooks de um não existem no outro.

## 0. Antes de começares

- Precisas de acesso de administrador à conta Stripe (nova ou existente).
- Precisas de acesso à Vercel (`vercel env add`/`vercel env rm`, ou ao
  dashboard) para o projeto `hrbetting-api`.
- Nada disto exige alterar código — só valores de configuração.

## 1. Preparar a conta Stripe

### 1.1 Se for uma conta nova, a começar do zero

1. Cria a conta em `https://dashboard.stripe.com/register`.
2. Confirma o email.
3. **Ativa a conta** (obrigatório para aceitar pagamentos reais): no
   dashboard vai aparecer um aviso "Activate your account" / "Ativa a tua
   conta" — preenche:
   - Dados do negócio (nome legal, país, tipo de entidade).
   - Conta bancária para onde o Stripe transfere o dinheiro recebido.
   - Verificação de identidade (pode pedir documento, consoante o país).
4. Sem este passo, a conta fica limitada ao modo de teste — não é
   possível ativar o modo live nem receber pagamentos reais.

### 1.2 Se for a mesma conta já usada em modo de teste

- Confirma só que está ativada (mesmo passo 3 acima) — muitas contas
  usadas só para testes nunca completam este passo.

## 2. Trocar para modo live no dashboard

No topo do dashboard do Stripe há um interruptor **Test mode / Modo de
teste**. Desliga-o. A partir daqui, tudo o que vires e criares
(produtos, chaves, webhooks) é **live** — separado do que já existe em
modo de teste.

## 3. Obter as 3 chaves necessárias

### 3.1 `STRIPE_PRICE_ID` — criar o produto e o preço

1. Menu lateral → **Product catalog** (Catálogo de produtos) → **+ Add
   product**.
2. Nome do produto (ex: "HRBETTING Premium").
3. Em **Pricing**: escolhe **Recurring** (recorrente), define o valor,
   moeda (EUR) e o intervalo de cobrança (ex: mensal).
4. Guarda. Na página do produto, o preço criado tem um ID no formato
   `price_...` — copia esse valor.

### 3.2 `STRIPE_SECRET_KEY` — a chave secreta da API

1. Menu lateral → **Developers** (Programadores) → **API keys**.
2. Em **Secret key**, clica **Reveal live key** (Revelar chave live).
3. Copia o valor — começa por `sk_live_...`.
4. **Nunca** partilhes esta chave em chat, capturas de ecrã, ou a
   commites no git. Só existe nas variáveis de ambiente da Vercel.

### 3.3 `STRIPE_WEBHOOK_SECRET` — o endpoint de webhook

1. Menu lateral → **Developers** → **Webhooks** → **+ Add endpoint**.
2. **Endpoint URL**: `https://hrbetting-api.vercel.app/api/payments/webhook`
3. **Events to send** (seleciona só estes 5, exatamente os que o código em
   `app/api/payments/webhook/route.ts` trata):
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Clica **Add endpoint**.
5. Na página do endpoint criado, em **Signing secret**, clica **Reveal**
   — copia o valor, começa por `whsec_...`.

> **Nota:** isto pode também ser feito via API/CLI em vez do dashboard —
> foi assim que o endpoint de teste atual foi criado nesta conversa, com
> um pedido `POST` para `https://api.stripe.com/v1/webhook_endpoints`
> autenticado com a `STRIPE_SECRET_KEY`. Só é preciso teres a chave
> secreta live já em mãos (passo 3.2) para usar esta alternativa.

## 4. Atualizar as variáveis de ambiente na Vercel (Production)

Os nomes das variáveis não mudam — só os valores, de teste para live.
Via CLI, a partir da pasta do projeto:

```bash
vercel env rm STRIPE_SECRET_KEY production
vercel env add STRIPE_SECRET_KEY production
# cola o valor sk_live_... quando pedido

vercel env rm STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_WEBHOOK_SECRET production
# cola o valor whsec_... quando pedido

vercel env rm STRIPE_PRICE_ID production
vercel env add STRIPE_PRICE_ID production
# cola o valor price_... quando pedido
```

Ou no dashboard da Vercel: **Project Settings → Environment Variables**,
edita as 3 entradas em **Production**.

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` não mudam — a base de dados
é a mesma em teste e em produção, a não ser que decidas criar um projeto
Supabase separado só para produção (não é necessário).

## 5. Publicar as alterações

Alterar env vars não atualiza deployments já feitos — é preciso um
deploy novo para as apanhar:

```bash
vercel deploy --prod
```

Ou faz um commit vazio e `git push origin master` (o deploy automático da
Vercel trata do resto).

## 6. Confirmar o canal do Telegram

Se ainda não estiver feito: **Pedidos de Adesão** tem de estar ativo no
canal HRBETTING (Telegram → Editar canal → Definições de Subscritores).
Sem isto, `chat_join_request` nunca chega ao bot.

## 7. Teste real (obrigatório antes de anunciar a subscrição)

1. Abre o bot real no Telegram → `/start` → **Premium** → **Passo 1** →
   **Pagar agora**.
2. Paga com um **cartão real** (usa um valor de subscrição pequeno para o
   teste, se possível).
3. Confirma que chega a mensagem "Estás a postos! ✅".
4. Pede para entrar no canal e confirma que a aprovação é automática.
5. No dashboard do Stripe (modo live), vai a **Payments**, encontra esse
   pagamento e **reembolsa-o** (ou cancela a subscrição em
   **Customers → [o cliente] → Subscriptions**) para não ficares a
   cobrar-te a ti próprio indefinidamente.

## 8. Acompanhar os primeiros pagamentos reais

- Stripe (modo live) → **Developers → Events** e **Payments**, para veres
  cada evento a chegar e cada cobrança.
- Vercel → **Logs** do projeto, filtrando por `/api/payments/webhook`,
  para confirmares que os webhooks estão a ser processados sem erro.

## Apêndice: onde fica cada coisa no dashboard do Stripe

| Variável | Onde encontrar | Formato |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Developers → API keys → Secret key | `sk_live_...` |
| `STRIPE_PRICE_ID` | Product catalog → produto → preço | `price_...` |
| `STRIPE_WEBHOOK_SECRET` | Developers → Webhooks → endpoint → Signing secret | `whsec_...` |

## Apêndice: reverter para modo de teste

Se precisares de voltar a testar sem afetar produção: repete os passos 4
e 5 com os valores `sk_test_...` / `whsec_...` / `price_...` de teste que
já existem (ou cria um webhook de teste novo, seguindo o passo 3.3 com o
toggle de modo de teste ligado). As duas contas (teste e live) coexistem
sempre lado a lado na mesma conta Stripe — nunca é preciso escolher uma
ou outra de forma permanente.
