// ID numerico do canal HRBETTING (privado, confirmado via getChat). Usado
// para aprovar/recusar pedidos de entrada e para remover subscritores
// expirados — diferente do TELEGRAM_CHANNEL_URL, que e so o link de convite.
export const PREMIUM_CHAT_ID = Number(
  process.env.TELEGRAM_PREMIUM_CHAT_ID ?? "-1004469029288"
);

export async function telegram(method: string, payload: unknown) {
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
    console.error("Telegram error", method, response.status, body);
  }

  return response;
}

type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
};

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyMarkup?: InlineKeyboard
) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    protect_content: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function approveChatJoinRequest(chatId: number, userId: number) {
  return telegram("approveChatJoinRequest", { chat_id: chatId, user_id: userId });
}

export async function declineChatJoinRequest(chatId: number, userId: number) {
  return telegram("declineChatJoinRequest", { chat_id: chatId, user_id: userId });
}

// Remove sem banir permanentemente: bane e desbane de imediato, para o
// utilizador poder voltar a pedir entrada se voltar a subscrever.
export async function kickChatMember(chatId: number, userId: number) {
  await telegram("banChatMember", { chat_id: chatId, user_id: userId });
  return telegram("unbanChatMember", { chat_id: chatId, user_id: userId, only_if_banned: true });
}
