# HR Betting API

API em Next.js que serve como backend web da aplicação desktop HR Betting (C# / WPF), responsável pela análise de jogos de futebol e cálculo de probabilidades. Além da página de apresentação dos mercados suportados, expõe endpoints para receber sinais gerados pela aplicação desktop e para o modo interativo do bot de Telegram.

## Stack técnica

- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript
- Tailwind CSS 4
- Vercel Blob (armazenamento privado dos sinais)

## Estrutura do projeto

```text
app/
  page.tsx                    Página inicial com a lista de mercados suportados
  markets-explorer.tsx        Componente de cliente com filtros e cópia de códigos de mercado
  api/
    health/route.ts           Endpoint de verificação de estado
    upload-signals/route.ts   Recebe os sinais enviados pela aplicação HR Betting
    telegram/route.ts         Webhook do bot de Telegram (modo interativo)
docs/
  VERCEL_TELEGRAM_WEBHOOK_TODO.md   Especificação do fluxo de integração com o Telegram
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

Webhook do bot de Telegram. Valida o cabeçalho `x-telegram-bot-api-secret-token` contra `TELEGRAM_WEBHOOK_SECRET` e, ao receber um `callback_query` com `callback_data` no formato `interval|<dia>|<intervalo>`, procura os detalhes desse intervalo no Blob e responde no chat de origem.

## Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `BOT_TOKEN` | Token do bot de Telegram (obtido no BotFather) |
| `HRBETTING_SECRET` | Segredo partilhado para autenticar os pedidos de `/api/upload-signals` |
| `TELEGRAM_WEBHOOK_SECRET` | Segredo definido no `setWebhook`, validado em cada pedido do Telegram |
| `BLOB_READ_WRITE_TOKEN` | Token de leitura/escrita do Vercel Blob Store (opcional em produção, onde a SDK pode usar OIDC automaticamente; obrigatório em desenvolvimento local) |

Em produção e preview na Vercel, a autenticação no Blob Store pode ser feita automaticamente via OIDC, desde que o Blob Store esteja ligado ao projeto. Em desenvolvimento local é necessário definir `BLOB_READ_WRITE_TOKEN` num ficheiro `.env`.


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

Outros scripts disponíveis:

```bash
npm run build   # build de produção
npm run start   # servir o build de produção
npm run lint    # verificação de lint
```

## Deploy

O projeto está ligado à Vercel. O deploy é feito automaticamente a partir do repositório Git, ou manualmente através da CLI:

```bash
npx vercel deploy --prod
```
