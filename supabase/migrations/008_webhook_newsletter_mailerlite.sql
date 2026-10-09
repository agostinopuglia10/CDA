-- Collega automaticamente ogni nuova iscrizione newsletter alla Edge
-- Function sync-newsletter-signup (che la inoltra a MailerLite).
-- Equivale esattamente a creare un Database Webhook dalla dashboard di
-- Supabase (Database > Webhooks), fatto qui via SQL.

create extension if not exists pg_net;

create or replace function public.trigger_sync_newsletter_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://udynqqqxjcyhdeygqumi.supabase.co/functions/v1/sync-newsletter-signup',
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'newsletter_signups',
      'schema', 'public',
      'record', to_jsonb(new)
    ),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return new;
end;
$$;

drop trigger if exists sync_newsletter_signup_webhook on public.newsletter_signups;

create trigger sync_newsletter_signup_webhook
after insert on public.newsletter_signups
for each row
execute function public.trigger_sync_newsletter_signup();
