-- Client portals: an agency / marketer gives each client a branded page
-- (astrocore.one/c/<slug>) with the reports made for that client.

create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  slug          text not null unique,                 -- public id in /c/<slug>
  color         text not null default '#E8002A',
  logo_url      text,
  intro         text,                                 -- greeting on the portal
  password_hash text,                                 -- null = open by link
  is_active     boolean not null default true,
  show_powered  boolean not null default true,
  views         integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists clients_user_id_idx on public.clients(user_id);

alter table public.clients enable row level security;
drop policy if exists "clients own" on public.clients;
create policy "clients own" on public.clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.reports  add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.missions add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists reports_client_id_idx on public.reports(client_id);
