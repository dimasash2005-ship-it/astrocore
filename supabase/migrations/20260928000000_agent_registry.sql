alter table public.providers
  add column if not exists last_seen_at timestamptz,
  add column if not exists agent_version text;

alter table public.api_keys
  add column if not exists provider_id uuid
    references public.providers(id) on delete set null;

create index if not exists api_keys_provider_id_idx
  on public.api_keys(provider_id);
