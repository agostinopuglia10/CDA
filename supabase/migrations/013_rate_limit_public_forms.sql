-- I form pubblici (preventivo, newsletter) accettano insert diretti via
-- API con la chiave pubblica: senza limite, uno script potrebbe scrivere
-- migliaia di righe false, facendo esplodere le email inviate da Resend
-- (una per ogni richiesta preventivo) e intasando la casella del titolare.
-- Aggiunto un doppio limite: per singola email e un tetto globale orario,
-- come circuit breaker contro un flood con email casuali.

create or replace function public.enforce_quote_request_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_by_email integer;
  recent_total integer;
begin
  select count(*) into recent_by_email
  from public.quote_requests
  where email = new.email
    and created_at > now() - interval '1 hour';

  if recent_by_email >= 3 then
    raise exception 'Troppe richieste da questo indirizzo email, riprova più tardi.';
  end if;

  select count(*) into recent_total
  from public.quote_requests
  where created_at > now() - interval '1 hour';

  if recent_total >= 20 then
    raise exception 'Troppe richieste ricevute in questo momento, riprova più tardi.';
  end if;

  return new;
end;
$$;

drop trigger if exists quote_requests_rate_limit on public.quote_requests;
create trigger quote_requests_rate_limit
before insert on public.quote_requests
for each row
execute function public.enforce_quote_request_rate_limit();

revoke execute on function public.enforce_quote_request_rate_limit() from anon, authenticated, public;

create or replace function public.enforce_newsletter_signup_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_by_email integer;
  recent_total integer;
begin
  select count(*) into recent_by_email
  from public.newsletter_signups
  where email = new.email
    and created_at > now() - interval '24 hours';

  if recent_by_email >= 1 then
    raise exception 'Questo indirizzo si è già iscritto di recente.';
  end if;

  select count(*) into recent_total
  from public.newsletter_signups
  where created_at > now() - interval '1 hour';

  if recent_total >= 30 then
    raise exception 'Troppe iscrizioni ricevute in questo momento, riprova più tardi.';
  end if;

  return new;
end;
$$;

drop trigger if exists newsletter_signups_rate_limit on public.newsletter_signups;
create trigger newsletter_signups_rate_limit
before insert on public.newsletter_signups
for each row
execute function public.enforce_newsletter_signup_rate_limit();

revoke execute on function public.enforce_newsletter_signup_rate_limit() from anon, authenticated, public;
