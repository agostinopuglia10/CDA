-- Il linter di sicurezza Supabase ha segnalato che trigger_notify_new_quote
-- e trigger_sync_newsletter_signup (security definer) risultano eseguibili
-- da anon/authenticated. Verificato con un test reale che PostgREST le blocca
-- comunque (funzioni "returns trigger" non esposte come RPC), ma è una
-- protezione implicita: meglio negare esplicitamente l'esecuzione diretta,
-- restano chiamabili solo come trigger dal database stesso.

revoke execute on function public.trigger_notify_new_quote() from anon, authenticated, public;
revoke execute on function public.trigger_sync_newsletter_signup() from anon, authenticated, public;
