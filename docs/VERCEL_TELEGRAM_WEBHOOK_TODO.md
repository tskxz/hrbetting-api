# HRBETTING - Parte em Falta: Vercel / Telegram Webhook

Este ficheiro descreve apenas o que falta implementar do lado **Vercel / Next.js** para ativar o modo interativo do Telegram.

A app HRBETTING já está preparada para:

- enviar os detalhes dos jogos por intervalo para a Vercel;
- publicar no Telegram mensagens-resumo por intervalo;
- usar botões inline com `callback_data`;
- enviar `day` e `interval` no formato esperado.

O que falta é o site Next.js receber, guardar e responder aos cliques.

## Objetivo

Fluxo esperado:

```text
HRBETTING app
  -> POST /api/upload-signals
  -> grava JSON por dia na Vercel
  -> app envia Telegram: "Jogos das 17:00-18:00" + botão "Ver jogos"
  -> utilizador clica
  -> Telegram chama POST /api/telegram
  -> Vercel lê o JSON
  -> Vercel envia os detalhes desse intervalo para o canal/chat
```

## Variáveis de Ambiente

Configurar na Vercel:

```env
BOT_TOKEN=token_do_bot_telegram
HRBETTING_SECRET=segredo_igual_ao_configurado_na_app
TELEGRAM_WEBHOOK_SECRET=segredo_usado_no_setWebhook
BLOB_PUBLIC_BASE_URL=https://xxxxx.public.blob.vercel-storage.com
```

Nota: `BLOB_PUBLIC_BASE_URL` vem do Vercel Blob. Depois do primeiro upload, usar a base do `blob.url`.

Exemplo:

```text
blob.url = https://abc123.public.blob.vercel-storage.com/signals/17-07-2026.json
BLOB_PUBLIC_BASE_URL = https://abc123.public.blob.vercel-storage.com
```

## Dependência Necessária

Instalar:

```bash
npm install @vercel/blob
```

## Endpoint 1: Upload dos Sinais

Criar:

```text
app/api/upload-signals/route.ts
```

Código:

```ts
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

type SignalPayload = {
  day: string;
  secret: string;
  intervals: Record<string, string>;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SignalPayload;

  if (body.secret !== process.env.HRBETTING_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!body.day || !body.intervals || typeof body.intervals !== "object") {
    return NextResponse.json(
      { ok: false, error: "Invalid payload" },
      { status: 400 }
    );
  }

  const filename = `signals/${body.day}.json`;

  const blob = await put(filename, JSON.stringify(body.intervals, null, 2), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true
  });

  return NextResponse.json({
    ok: true,
    day: body.day,
    saved: Object.keys(body.intervals).length,
    url: blob.url
  });
}
```

## Endpoint 2: Webhook Telegram

Criar:

```text
app/api/telegram/route.ts
```

Código:

```ts
import { NextRequest, NextResponse } from "next/server";

async function telegram(method: string, payload: unknown) {
  const response = await fetch(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  const body = await response.text();

  if (!response.ok) {
    console.error("Telegram error", response.status, body);
  }

  return response;
}

async function sendMessage(chatId: number | string, text: string) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true
  });
}

async function answerCallback(callbackQueryId: string) {
  return telegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId
  });
}

async function loadSignalsJson(day: string): Promise<Record<string, string> | null> {
  const url = `${process.env.BLOB_PUBLIC_BASE_URL}/signals/${day}.json`;

  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function POST(req: NextRequest) {
  const telegramSecret = req.headers.get("x-telegram-bot-api-secret-token");

  if (telegramSecret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Invalid Telegram secret" },
      { status: 401 }
    );
  }

  const update = await req.json();

  try {
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const data = String(callback.data || "");

      await answerCallback(callback.id);

      if (data.startsWith("interval|")) {
        const [, day, interval] = data.split("|");

        const intervals = await loadSignalsJson(day);
        const details = intervals?.[interval];

        if (!details) {
          await sendMessage(chatId, `Sem dados para ${interval}.`);
        } else {
          await sendMessage(chatId, details);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);

    // Responder 200 evita que o Telegram repita o mesmo update indefinidamente.
    return NextResponse.json({ ok: true });
  }
}
```

## Configurar o Webhook do Telegram

Abrir no browser, substituindo os valores:

```text
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://TEU-SITE.vercel.app/api/telegram&secret_token=TELEGRAM_WEBHOOK_SECRET
```

Confirmar:

```text
https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
```

## Teste Manual do Upload

Depois do deploy, testar:

```ts
await fetch("https://TEU-SITE.vercel.app/api/upload-signals", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    secret: "segredo_igual_ao_configurado_na_app",
    day: "17-07-2026",
    intervals: {
      "17:00-18:00": "🎯 Jogo A vs Jogo B\n1.5 | 1.42 ★★\n⛳️ xCorners: 10.50 (Over 10.5 | 2.05)",
      "18:00-19:00": "🎯 Jogo C vs Jogo D\nBTTS | 1.80 ★★"
    }
  })
});
```

## Configuração na App HRBETTING

Na janela de configuração do Telegram da app:

```text
Bot Token = BOT_TOKEN
Chat ID = id do canal
Vercel URL = https://TEU-SITE.vercel.app
Vercel Secret = HRBETTING_SECRET
```

Se `Vercel URL` e `Vercel Secret` estiverem preenchidos, a app usa o modo interativo.

Se estiverem vazios, a app envia as mensagens completas como antes.

## Resultado Esperado no Telegram

A app envia algo como:

```text
Jogos das 17:00-18:00
[Ver jogos]
```

Ao clicar em `Ver jogos`, o webhook responde com os detalhes guardados no JSON:

```text
🕒 17:00-18:00
🎯 Jogo A vs Jogo B
    *1,5 | 1.42 ★★*
⚽ xGoals: ...
⛳️ xCorners: 10.50 (Over 10.5 | 2.05)
```

