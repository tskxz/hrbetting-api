import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { kickChatMember, PREMIUM_CHAT_ID } from "@/lib/telegram";

// Rede de seguranca a correr diariamente (ver vercel.json), a par da remocao
// imediata feita no webhook do Stripe (customer.subscription.deleted). Cobre
// os casos em que o webhook falha ou nao chega a tempo.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("subscribers")
    .select("telegram_user_id, status, current_period_end")
    .neq("status", "active");

  if (error) {
    console.error("Cron remove-expired: erro ao consultar subscribers", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const now = new Date();
  const expired = (data ?? []).filter(
    (subscriber) =>
      subscriber.status === "canceled" ||
      (subscriber.status === "past_due" &&
        subscriber.current_period_end !== null &&
        new Date(subscriber.current_period_end) < now)
  );

  for (const subscriber of expired) {
    await kickChatMember(PREMIUM_CHAT_ID, subscriber.telegram_user_id);
  }

  return NextResponse.json({ ok: true, removed: expired.length });
}
