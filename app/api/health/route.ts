import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    version: "telegram-marketing-v2",
    telegramSummary: "\\u{1F3AF} Mercados em foco",
    buttonOpen: "Ver picks do bloco",
    buttonClose: "Fechar bloco",
  });
}
