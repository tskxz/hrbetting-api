import { createClient } from "@supabase/supabase-js";

// Cliente server-side com a service role key — ignora RLS, so deve ser usado
// em route handlers (nunca exposto ao browser). Ligacao a Supabase, usada
// para o estado de subscricao (subscribers/payments), nunca para os sinais
// (esses continuam no Vercel Blob).
// URL placeholder so para nao rebentar a construcao do cliente durante o
// build antes de SUPABASE_URL estar definida; chamadas reais falham com um
// erro de rede claro ate a env var ser configurada.
export const supabase = createClient(
  process.env.SUPABASE_URL ?? "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder",
  {
    auth: {
      persistSession: false,
    },
  }
);

export type SubscriberStatus =
  | "inactive"
  | "active"
  | "past_due"
  | "canceled";

export type Subscriber = {
  telegram_user_id: number;
  telegram_username: string | null;
  telegram_first_name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriberStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

// Garante que existe um registo para este utilizador antes de o mandar para o
// checkout do Stripe. Nao mexe em status/stripe ids existentes — so atualiza
// o username/nome, que podem mudar entre interacoes.
export async function ensureSubscriber(
  telegramUserId: number,
  telegramUsername?: string,
  telegramFirstName?: string
) {
  const { error } = await supabase.from("subscribers").upsert(
    {
      telegram_user_id: telegramUserId,
      telegram_username: telegramUsername ?? null,
      telegram_first_name: telegramFirstName ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "telegram_user_id" }
  );

  if (error) {
    console.error("Supabase ensureSubscriber error", error);
  }
}

export async function getSubscriberStatus(
  telegramUserId: number
): Promise<SubscriberStatus | null> {
  const { data, error } = await supabase
    .from("subscribers")
    .select("status")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (error) {
    console.error("Supabase getSubscriberStatus error", error);
    return null;
  }

  return (data?.status as SubscriberStatus | undefined) ?? null;
}
