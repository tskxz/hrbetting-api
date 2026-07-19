import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from: { id: number };
};

type TelegramUpdate = {
  callback_query?: TelegramCallbackQuery;
};

const TELEGRAM_TEXT_LIMIT = 4096;
const TELEGRAM_ALERT_TEXT_LIMIT = 200;

const PRIVATE_CHAT_HINT =
  "Abre uma conversa privada com o bot (procura o nome do bot e clica em Start) e volta a clicar no botao.";

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

function fitTelegramText(text: string) {
  if (text.length <= TELEGRAM_TEXT_LIMIT) {
    return text;
  }

  const suffix = "\n\nMensagem cortada pelo limite do Telegram.";
  return text.slice(0, TELEGRAM_TEXT_LIMIT - suffix.length).trimEnd() + suffix;
}

function fitAlertText(text: string) {
  if (text.length <= TELEGRAM_ALERT_TEXT_LIMIT) {
    return text;
  }

  return text.slice(0, TELEGRAM_ALERT_TEXT_LIMIT - 1).trimEnd() + "\u2026";
}

async function sendPrivateMessage(userId: number, text: string) {
  return telegram("sendMessage", {
    chat_id: userId,
    text: fitTelegramText(text),
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    // Impede reencaminhar/guardar, tal como as mensagens do canal na app HRBETTING.
    protect_content: true,
  });
}

async function answerCallback(
  callbackQueryId: string,
  text?: string,
  showAlert = false
) {
  return telegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text ? fitAlertText(text) : undefined,
    show_alert: showAlert,
  });
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
    const callback = update.callback_query;
    if (!callback) {
      return NextResponse.json({ ok: true });
    }

    const userId = callback.from.id;
    const data = String(callback.data || "");
    const [action, day, interval] = data.split("|");

    if (action !== "interval" || !day || !interval) {
      await answerCallback(callback.id);
      return NextResponse.json({ ok: true });
    }

    const intervals = await loadSignalsJson(day);
    const details = intervals?.[interval];

    if (!details) {
      await answerCallback(callback.id, `Sem dados para ${interval}.`, true);
      return NextResponse.json({ ok: true });
    }

    const sent = await sendPrivateMessage(userId, details);

    if (sent.ok) {
      await answerCallback(callback.id, "Picks enviados na tua conversa privada com o bot.");
    } else {
      await answerCallback(callback.id, PRIVATE_CHAT_HINT, true);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json({ ok: true });
  }
}
