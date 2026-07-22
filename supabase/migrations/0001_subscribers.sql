-- Subscriptions premium ligadas diretamente ao telegram_user_id (sem conta no
-- site/login separado): a identidade principal do utilizador e sempre o
-- telegram_user_id, obtido assim que interage com o bot pela primeira vez.

create table if not exists subscribers (
  telegram_user_id bigint primary key,
  telegram_username text,
  telegram_first_name text,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'inactive'
    check (status in ('inactive', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id bigserial primary key,
  telegram_user_id bigint not null references subscribers(telegram_user_id) on delete cascade,
  stripe_payment_id text not null unique,
  amount integer,
  currency text,
  status text,
  created_at timestamptz not null default now()
);

create index if not exists payments_telegram_user_id_idx on payments(telegram_user_id);

-- So o service role (usado pela API, nunca exposto ao browser) acede a estas
-- tabelas; RLS ligado sem policies bloqueia anon/authenticated por omissao.
alter table subscribers enable row level security;
alter table payments enable row level security;
