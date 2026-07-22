import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";
import { ensureSubscriber, getSubscriberStatus } from "@/lib/supabase";
import {
  approveChatJoinRequest,
  declineChatJoinRequest,
  PREMIUM_CHAT_ID,
  telegram,
} from "@/lib/telegram";

type TelegramMessage = {
  chat: { id: number };
  text?: string;
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from: { id: number; username?: string; first_name?: string };
};

type TelegramChatJoinRequest = {
  chat: { id: number };
  from: { id: number; username?: string; first_name?: string };
};

type TelegramUpdate = {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  chat_join_request?: TelegramChatJoinRequest;
};

type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
};

const TELEGRAM_TEXT_LIMIT = 4096;
const WATERMARK = "*HRBETTING*";
const WATERMARK_HEADER = `${WATERMARK}\n\n`;

// Link de convite do canal principal (privado, sem @username publico —
// confirmado via getChat). Usado pelo botao "Free" e por "Subscrever Canal".
const CHANNEL_URL = process.env.TELEGRAM_CHANNEL_URL ?? "https://t.me/DEFINIR_TELEGRAM_CHANNEL_URL";

const SIGNUP_URL = process.env.SIGNUP_URL ?? "https://hrbetting-api.vercel.app/";

const COMECAR_BUTTON_DATA = "start|comecar";
const PASSO1_BUTTON_DATA = "start|passo1";
const POSTOS_BUTTON_DATA = "start|postos";
const ASSINAR_BUTTON_DATA = "start|assinar";

// Logo nas boas-vindas, o utilizador escolhe entre continuar para o pagamento
// (Premium) ou só ver o canal (Free) — o canal e o mesmo nos dois casos,
// atualmente gerido como premium: pedir entrada sem subscrição ativa
// continua a ser recusado por chat_join_request, o Free só mostra o link.
const WELCOME_BUTTONS: InlineKeyboard = {
  inline_keyboard: [
    [{ text: "Premium", callback_data: COMECAR_BUTTON_DATA }],
    [{ text: "Free", url: CHANNEL_URL }],
  ],
};

const PASSO1_TRIGGER_BUTTON: InlineKeyboard = {
  inline_keyboard: [[{ text: "Criar conta →", callback_data: PASSO1_BUTTON_DATA }]],
};

const PASSO1_BUTTONS: InlineKeyboard = {
  inline_keyboard: [
    [{ text: "Pagar agora", callback_data: ASSINAR_BUTTON_DATA }],
    [{ text: "Já paguei", callback_data: POSTOS_BUTTON_DATA }],
  ],
};

const ASSINAR_BUTTON: InlineKeyboard = {
  inline_keyboard: [[{ text: "Assinar Premium", callback_data: ASSINAR_BUTTON_DATA }]],
};

const POSTOS_BUTTONS: InlineKeyboard = {
  inline_keyboard: [
    [{ text: "Assinar Premium", callback_data: ASSINAR_BUTTON_DATA }],
    [{ text: "Subscrever Canal", url: CHANNEL_URL }],
  ],
};

// Mensagem enviada quando alguem inicia conversa com o bot sem vir de um link
// de intervalo especifico (ex: link generico partilhado no site/bio/canal).
const WELCOME_MESSAGE = `Bem-vindo a comunidade.

A maioria dos apostadores segue o instinto e o resultado do ultimo jogo. Aqui seguimos o motor de calculo: probabilidades, xGoals e xCorners recalculados todos os dias, jogo a jogo.

📊 Motor de calculo proprio — nao e opiniao, e modelo
🎯 Picks filtrados por mercado (1, X2, Over, BTTS...)
📈 Taxa de acerto publicada, sem esconder o que corre mal
🔒 Conteudo exclusivo, protegido e para uso pessoal

Os sinais chegam aqui, em privado, assim que ficam disponiveis.`;

const COMECAR_MESSAGE = `Como funciona

⚽ O motor de calculo corre os jogos do dia, mercado a mercado
🕐 As picks ficam disponiveis por intervalo, a tempo de entrares
📊 Cada pick traz o jogo, o mercado + odd, e a leitura — o porque, nao so o palpite

Staking fixo, sem emocao: 1 unidade por pick. Jogamos para consistencia, o provavel acima do espetacular.

Duvidas? Fala aqui que respondo assim que puder.`;

const PASSO1_MESSAGE = `Passo 1 — Assinar

Para teres acesso as picks completas e ao canal precisas de uma subscricao Premium ativa.

Ainda nao pagaste? Paga a partir do botao abaixo.
Ja pagaste? Confirma no botao "Ja paguei" para avancares.`;

const POSTOS_MESSAGE = `Estas a postos! ✅

Agora e seguir o jogo — as picks, as noticias e os resultados ficam aqui e no canal.

O canal e reservado a subscritores. Assina o Premium e depois pede para entrar — a aprovacao e automatica assim que o pagamento for confirmado.`;

const PAGAMENTO_MESSAGE = `Assinar Premium

Acesso completo ao canal HRBETTING: picks diarias, motor de calculo, taxa de acerto sempre visivel.

Pagamento seguro via Stripe. A subscricao fica ativa assim que o pagamento for confirmado, e a entrada no canal e aprovada automaticamente.`;

const PAGAMENTO_ERRO_MESSAGE = "Nao foi possivel criar o pagamento agora. Tenta novamente daqui a pouco.";

const PEDIDO_RECUSADO_MESSAGE = `O teu pedido para entrar no canal HRBETTING nao foi aprovado — nao ha nenhuma subscricao ativa associada a esta conta.

Assina o Premium para teres acesso.`;

const PEDIDO_APROVADO_MESSAGE = "Pedido aprovado! Bem-vindo ao canal HRBETTING Premium.";

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

async function sendPrivateMessage(
  chatId: number,
  text: string,
  replyMarkup?: InlineKeyboard
) {
  const parts = splitTelegramText(interspersWatermark(text));
  let response: Response | undefined;

  for (let i = 0; i < parts.length; i++) {
    const isLastPart = i === parts.length - 1;

    response = await telegram("sendMessage", {
      chat_id: chatId,
      text: WATERMARK_HEADER + parts[i],
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      // Impede reencaminhar/guardar, tal como as mensagens do canal na app HRBETTING.
      protect_content: true,
      // O teclado so vai anexado a ultima parte da mensagem.
      ...(isLastPart && replyMarkup ? { reply_markup: replyMarkup } : {}),
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

async function answerCallback(callbackQueryId: string) {
  return telegram("answerCallbackQuery", { callback_query_id: callbackQueryId });
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
    const callback = update.callback_query;
    if (callback) {
      await answerCallback(callback.id);

      if (callback.data === COMECAR_BUTTON_DATA) {
        await sendPrivateMessage(callback.from.id, COMECAR_MESSAGE, PASSO1_TRIGGER_BUTTON);
      }

      if (callback.data === PASSO1_BUTTON_DATA) {
        await sendPrivateMessage(callback.from.id, PASSO1_MESSAGE, PASSO1_BUTTONS);
      }

      if (callback.data === POSTOS_BUTTON_DATA) {
        await sendPrivateMessage(callback.from.id, POSTOS_MESSAGE, POSTOS_BUTTONS);
      }

      if (callback.data === ASSINAR_BUTTON_DATA) {
        await ensureSubscriber(
          callback.from.id,
          callback.from.username,
          callback.from.first_name
        );

        const session = await createCheckoutSession(
          callback.from.id,
          `${SIGNUP_URL}?checkout=success`,
          `${SIGNUP_URL}?checkout=cancel`
        );

        if (session.url) {
          await sendPrivateMessage(callback.from.id, PAGAMENTO_MESSAGE, {
            inline_keyboard: [[{ text: "Pagar agora", url: session.url }]],
          });
        } else {
          await sendPrivateMessage(callback.from.id, PAGAMENTO_ERRO_MESSAGE);
        }
      }

      return NextResponse.json({ ok: true });
    }

    const joinRequest = update.chat_join_request;
    if (joinRequest) {
      if (joinRequest.chat.id === PREMIUM_CHAT_ID) {
        const status = await getSubscriberStatus(joinRequest.from.id);

        if (status === "active") {
          await approveChatJoinRequest(joinRequest.chat.id, joinRequest.from.id);
          await sendPrivateMessage(joinRequest.from.id, PEDIDO_APROVADO_MESSAGE);
        } else {
          await declineChatJoinRequest(joinRequest.chat.id, joinRequest.from.id);
          await sendPrivateMessage(joinRequest.from.id, PEDIDO_RECUSADO_MESSAGE, ASSINAR_BUTTON);
        }
      }

      return NextResponse.json({ ok: true });
    }

    const message = update.message;
    const text = message?.text?.trim() ?? "";

    if (!message || !text.startsWith("/start")) {
      return NextResponse.json({ ok: true });
    }

    const [, payload] = text.split(/\s+/, 2);
    const decoded = payload ? decodeStartPayload(payload) : null;

    if (!decoded) {
      await sendPrivateMessage(message.chat.id, WELCOME_MESSAGE, WELCOME_BUTTONS);
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
