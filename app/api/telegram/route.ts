import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

type ReplyMarkup = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
};

type TelegramMessage = {
  message_id: number;
  chat: { id: number | string };
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  message?: TelegramMessage;
};

type TelegramUpdate = {
  callback_query?: TelegramCallbackQuery;
};

const TELEGRAM_TEXT_LIMIT = 4096;

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

function intervalSummaryText(interval: string) {
  return `\u{1F3AF} Mercados em foco\n\n${interval} \u00B7 Odds e picks filtradas`;
}

function intervalButton(day: string, interval: string): ReplyMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: "Ver picks do bloco",
          callback_data: `interval|${day}|${interval}`,
        },
      ],
    ],
  };
}

function closeButton(day: string, interval: string): ReplyMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: "Fechar bloco",
          callback_data: `close|${day}|${interval}`,
        },
      ],
    ],
  };
}

function fitTelegramText(text: string) {
  if (text.length <= TELEGRAM_TEXT_LIMIT) {
    return text;
  }

  const suffix = "\n\nMensagem cortada pelo limite do Telegram.";
  return text.slice(0, TELEGRAM_TEXT_LIMIT - suffix.length).trimEnd() + suffix;
}

async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  replyMarkup: ReplyMarkup
) {
  return telegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: fitTelegramText(text),
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
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

  const update = (await req.json()) as TelegramUpdate;

  try {
    const callback = update.callback_query;
    if (!callback) {
      return NextResponse.json({ ok: true });
    }

    await answerCallback(callback.id);

    const message = callback.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const messageId = message.message_id;
    const data = String(callback.data || "");
    const [action, day, interval] = data.split("|");

    if (!day || !interval) {
      return NextResponse.json({ ok: true });
    }

    if (action === "interval") {
      const intervals = await loadSignalsJson(day);
      const details = intervals?.[interval];

      if (!details) {
        await editMessageText(
          chatId,
          messageId,
          `Sem dados para ${interval}.`,
          intervalButton(day, interval)
        );
      } else {
        await editMessageText(chatId, messageId, details, closeButton(day, interval));
      }
    }

    if (action === "close") {
      await editMessageText(
        chatId,
        messageId,
        intervalSummaryText(interval),
        intervalButton(day, interval)
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json({ ok: true });
  }
}
