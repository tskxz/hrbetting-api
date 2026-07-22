import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

type TelegramMessage = {
  chat: { id: number };
  text?: string;
};

type TelegramUpdate = {
  message?: TelegramMessage;
};

const TELEGRAM_TEXT_LIMIT = 4096;
const WATERMARK = "*HRBETTING*";
const WATERMARK_HEADER = `${WATERMARK}\n\n`;

// Mensagem enviada quando alguem inicia conversa com o bot sem vir de um link
// de intervalo especifico (ex: link generico partilhado no site/bio/canal).
const WELCOME_MESSAGE = `Bem-vindo a comunidade.

A maioria dos apostadores segue o instinto e o resultado do ultimo jogo. Aqui seguimos o motor de calculo: probabilidades, xGoals e xCorners recalculados todos os dias, jogo a jogo.

📊 Motor de calculo proprio — nao e opiniao, e modelo
🎯 Picks filtrados por mercado (1, X2, Over, BTTS...)
📈 Taxa de acerto publicada, sem esconder o que corre mal
🔒 Conteudo exclusivo, protegido e para uso pessoal

Os sinais chegam aqui, em privado, assim que ficam disponiveis.`;

async function telegram(method: string, payload: unknown) {
  const response = await fetch(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  const body = await response.text();

  if (!response.ok) {
    console.error("Telegram error", response.status, body);
  }

  return response;
}

// Linha separadora entre jogos, construida em MensagensExporter.cs (repositorio
// HRBETTING) como `{Indent}{Separador}` — ex: "    ────────────".
const SEPARATOR_LINE = /^─+$/;

// Repete a marca de agua a seguir a cada jogo, para alem do topo de cada mensagem,
// para que um print de qualquer zona do texto mostre sempre "HRBETTING" por perto.
function interspersWatermark(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    result.push(line);
    if (SEPARATOR_LINE.test(line.trim())) {
      result.push(WATERMARK);
    }
  }

  return result.join("\n");
}

// Mesmo algoritmo do DividirEmPartes em TelegramService.cs (repositorio HRBETTING),
// para que mensagens longas fiquem divididas da mesma forma nos dois sitios.
// O limite reserva espaco para a marca de agua, que e adicionada a cada parte.
function splitTelegramText(text: string): string[] {
  const limit = TELEGRAM_TEXT_LIMIT - WATERMARK_HEADER.length;
  const lines = text.split("\n");
  const parts: string[] = [];
  let current = "";

  for (const line of lines) {
    if (current.length > 0 && current.length + line.length + 1 > limit) {
      parts.push(current.trimEnd());
      current = "";
    }
    current += line + "\n";
  }

  if (current.length > 0) {
    parts.push(current.trimEnd());
  }

  return parts.length > 0 ? parts : [text];
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendPrivateMessage(chatId: number, text: string) {
  const parts = splitTelegramText(interspersWatermark(text));
  let response: Response | undefined;

  for (let i = 0; i < parts.length; i++) {
    response = await telegram("sendMessage", {
      chat_id: chatId,
      text: WATERMARK_HEADER + parts[i],
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      // Impede reencaminhar/guardar, tal como as mensagens do canal na app HRBETTING.
      protect_content: true,
    });

    if (!response.ok) {
      return response;
    }

    if (i < parts.length - 1) {
      await delay(400);
    }
  }

  return response!;
}

async function loadSignalsJson(
  day: string
): Promise<Record<string, string> | null> {
  const result = await get(`signals/${day}.json`, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    useCache: false,
  });

  if (!result) {
    return null;
  }

  const text = await new Response(result.stream).text();
  return JSON.parse(text);
}

// Payload construido pela app HRBETTING (TelegramService.cs) no formato
// "<dia>_<intervalo sem dois pontos>", ex: "17-07-2026_1700-1800".
function decodeStartPayload(
  payload: string
): { day: string; interval: string } | null {
  const separatorIndex = payload.indexOf("_");
  if (separatorIndex === -1) {
    return null;
  }

  const day = payload.slice(0, separatorIndex);
  const intervalRaw = payload.slice(separatorIndex + 1);
  const match = intervalRaw.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})$/);

  if (!day || !match) {
    return null;
  }

  const [, h1, m1, h2, m2] = match;
  return { day, interval: `${h1}:${m1}-${h2}:${m2}` };
}

export async function POST(req: NextRequest) {
  const telegramSecret = req.headers.get("x-telegram-bot-api-secret-token");

  if (telegramSecret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Invalid Telegram secret" },
      { status: 401 }
    );
  }

  const update = (await req.json()) as TelegramUpdate;

  try {
    const message = update.message;
    const text = message?.text?.trim() ?? "";

    if (!message || !text.startsWith("/start")) {
      return NextResponse.json({ ok: true });
    }

    const [, payload] = text.split(/\s+/, 2);
    const decoded = payload ? decodeStartPayload(payload) : null;

    if (!decoded) {
      await sendPrivateMessage(message.chat.id, WELCOME_MESSAGE);
      return NextResponse.json({ ok: true });
    }

    const intervals = await loadSignalsJson(decoded.day);
    const details = intervals?.[decoded.interval];

    await sendPrivateMessage(
      message.chat.id,
      details ?? `Sem dados para ${decoded.interval}.`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json({ ok: true });
  }
}
