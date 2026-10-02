-- La Edge Function backup-database prima non controllava chi la chiamava:
-- chiunque conoscesse l'indirizzo poteva farla girare a raffica e sprecare
-- lo spazio/le risorse gratuite del piano (trovato durante un controllo di
-- sicurezza). Il codice segreto vero e proprio vive solo in Supabase Vault
-- (mai in questo file/nel codice sorgente, per non finire nella cronologia
-- git): qui c'è solo la funzione che lo confronta e il cron aggiornato per
-- mandarlo nell'header "x-cron-secret".

create or replace function public.verify_backup_cron_secret(p_secret text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select p_secret = (
    select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret'
  );
$$;

revoke all on function public.verify_backup_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_backup_cron_secret(text) to service_role;

select cron.unschedule('weekly-database-backup')
where exists (select 1 from cron.job where jobname = 'weekly-database-backup');

select cron.schedule(
  'weekly-database-backup',
  '0 3 * * 0',
  $$
  select net.http_post(
    url := 'https://udynqqqxjcyhdeygqumi.supabase.co/functions/v1/backup-database',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
