-- =====================================================================
--  Casa da Carol — envio automático do briefing da manhã
--  Rode DEPOIS de publicar a função "briefing" (veja o README).
--  Troque SEU_PROJETO pelo código do projeto (o pedaço antes de .supabase.co).
--  Horário: o cron usa o horário UTC. 10:00 UTC = 7:00 em Brasília.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('briefing-da-manha') where exists (select 1 from cron.job where jobname = 'briefing-da-manha');

select cron.schedule(
  'briefing-da-manha',
  '0 10 * * *',
  $$
  select net.http_post(
    url     := 'https://SEU_PROJETO.supabase.co/functions/v1/briefing',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-briefing-segredo', (select decrypted_secret from vault.decrypted_secrets where name = 'briefing_segredo')),
    body    := '{}'::jsonb
  );
  $$
);
