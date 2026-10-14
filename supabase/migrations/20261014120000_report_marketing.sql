-- Marketing lab of a report: raw campaign numbers (spend, impressions, clicks, leads,
-- sales, revenue + per-campaign rows). Metrics are calculated in the app.
alter table public.reports add column if not exists marketing jsonb;
