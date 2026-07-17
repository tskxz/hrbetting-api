import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

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

async function sendMessage(chatId: number | string, text: string) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  });
}

async function answerCallback(callbackQueryId: string) {
  return telegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
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

    return NextResponse.json({ ok: true });
  }
}
