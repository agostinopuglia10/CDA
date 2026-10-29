-- Collega automaticamente ogni nuova richiesta di preventivo (form
-- Contatti) alla Edge Function notify-new-quote (che manda l'email di
-- avviso al titolare via Resend). Equivale a creare un Database Webhook
-- dalla dashboard di Supabase (Database > Webhooks), fatto qui via SQL,
-- stesso schema già usato per newsletter_signups -> MailerLite.

create extension if not exists pg_net;

create or replace function public.trigger_notify_new_quote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://udynqqqxjcyhdeygqumi.supabase.co/functions/v1/notify-new-quote',
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'quote_requests',
      'schema', 'public',
      'record', to_jsonb(new)
    ),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return new;
end;
$$;

drop trigger if exists notify_new_quote_webhook on public.quote_requests;

create trigger notify_new_quote_webhook
after insert on public.quote_requests
for each row
execute function public.trigger_notify_new_quote();
