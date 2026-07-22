import Stripe from "stripe";

// Fallback nao-vazio so para nao rebentar a construcao do cliente durante o
// build (antes de STRIPE_SECRET_KEY estar definida); chamadas reais falham
// com um erro de autenticacao claro do Stripe ate a env var ser configurada.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder");

export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID ?? "";

// Metadata e definida tanto na Session como na Subscription: o webhook
// checkout.session.completed so tem a Session, enquanto invoice.paid e
// customer.subscription.* so tem a Subscription — precisamos do
// telegram_user_id em ambos os lados para saber quem atualizar na BD.
export async function createCheckoutSession(
  telegramUserId: number,
  successUrl: string,
  cancelUrl: string
) {
  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    metadata: { telegram_user_id: String(telegramUserId) },
    subscription_data: {
      metadata: { telegram_user_id: String(telegramUserId) },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}
