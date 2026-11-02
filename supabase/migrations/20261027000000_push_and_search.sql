-- supabase/migrations/20261027000000_push_and_search.sql
-- ЯК ЗАПУСТИТИ: Supabase → SQL Editor → New query → встав увесь файл → Run.
-- Нічого міняти не треба: CRON_SECRET береться автоматично з твоєї крон-задачі
-- "astrocore-missions" (та сама, що запускає місії).
-- Можна запускати кілька разів, нічого не зламається.

-- ── 1. Пристрої, на яких увімкнені сповіщення ─────────────────────────────
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push own select" on public.push_subscriptions;
create policy "push own select" on public.push_subscriptions for select using (auth.uid() = user_id);
drop policy if exists "push own delete" on public.push_subscriptions;
create policy "push own delete" on public.push_subscriptions for delete using (auth.uid() = user_id);

-- ── 2. Агент дописав відповідь → AstroCore шле пуш ────────────────────────
create extension if not exists pg_net;

create or replace function public.notify_agent_reply() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  secret text;
begin
  if new.role = 'assistant' and old.status = 'pending' and coalesce(new.status, 'done') <> 'pending' then
    -- the same secret the missions cron already sends (no need to paste it anywhere)
    select substring(command from 'Bearer ([A-Za-z0-9_.~+/=-]+)') into secret
      from cron.job where jobname = 'astrocore-missions' limit 1;
    if secret is null then return new; end if;
    perform net.http_post(
      url     := 'https://astrocore.one/api/push/hook',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
      body    := jsonb_build_object('message_id', new.id)
    );
  end if;
  return new;
exception when others then
  return new;  -- проблема зі сповіщенням ніколи не ламає збереження відповіді
end $$;

drop trigger if exists chat_messages_push on public.chat_messages;
create trigger chat_messages_push after update of status on public.chat_messages
  for each row execute function public.notify_agent_reply();

-- ── 3. Швидкий пошук по всіх повідомленнях ────────────────────────────────
create extension if not exists pg_trgm;
create index if not exists chat_messages_content_trgm on public.chat_messages using gin (content gin_trgm_ops);

-- ── Перевірка: має показати true (секрет знайдено) ─────────────────────────
select (substring(command from 'Bearer ([A-Za-z0-9_.~+/=-]+)') is not null) as secret_found
  from cron.job where jobname = 'astrocore-missions';
