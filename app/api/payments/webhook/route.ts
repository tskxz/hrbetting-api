import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabase, type SubscriberStatus } from "@/lib/supabase";
import { kickChatMember, PREMIUM_CHAT_ID, sendTelegramMessage } from "@/lib/telegram";

const CHANNEL_URL = process.env.TELEGRAM_CHANNEL_URL ?? "https://t.me/DEFINIR_TELEGRAM_CHANNEL_URL";

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriberStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "inactive";
  }
}

async function syncSubscription(telegramUserId: number, subscription: Stripe.Subscription) {
  const periodEnd = subscription.items.data[0]?.current_period_end;

  const { error } = await supabase
    .from("subscribers")
    .update({
      stripe_customer_id:
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      status: mapStripeStatus(subscription.status),
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq("telegram_user_id", telegramUserId);

  if (error) {
    console.error("Supabase syncSubscription error", error);
  }
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  if (!signature) {
    return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? ""
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const telegramUserId = Number(session.metadata?.telegram_user_id);

        if (telegramUserId && session.subscription) {
          const subscriptionId =
            typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          await syncSubscription(telegramUserId, subscription);

          await sendTelegramMessage(
            telegramUserId,
            "Estas a postos! ✅\n\nPagamento confirmado — a tua subscricao Premium esta ativa.\n\nAgora e seguir o jogo — as picks, as noticias e os resultados ficam aqui e no canal. Pede para entrar que a aprovacao e automatica.",
            { inline_keyboard: [[{ text: "Subscrever Canal", url: CHANNEL_URL }]] }
          );
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const telegramUserId = Number(subscription.metadata?.telegram_user_id);

        if (telegramUserId) {
          await syncSubscription(telegramUserId, subscription);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const telegramUserId = Number(subscription.metadata?.telegram_user_id);

        if (telegramUserId) {
          await syncSubscription(telegramUserId, subscription);
          await kickChatMember(PREMIUM_CHAT_ID, telegramUserId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const telegramUserId = Number(
          invoice.parent?.subscription_details?.metadata?.telegram_user_id
        );

        if (telegramUserId) {
          const { error } = await supabase
            .from("subscribers")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("telegram_user_id", telegramUserId);

          if (error) {
            console.error("Supabase invoice.payment_failed update error", error);
          }
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Stripe webhook handling error", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
