// ============================================================
// Edge Function: stripe-webhook
//
// COSA FA:
// Ascolta gli eventi che Stripe manda quando un pagamento va a buon
// fine (checkout.session.completed) e segna l'ordine corrispondente
// come "paid" nel database. Senza questa funzione, un ordine resta
// per sempre "pending" (in attesa) anche dopo un pagamento vero:
// create-checkout-session lo crea "pending", solo questa funzione lo
// conferma davvero.
//
// COME ATTIVARLA:
// 1. Pubblica questa funzione da Edge Functions > Deploy a new function,
//    chiamata "stripe-webhook", incollando questo file (verify_jwt: false,
//    perché Stripe non manda un token Supabase, manda una propria firma).
// 2. Su Stripe Dashboard > Sviluppatori > Webhook > "Aggiungi endpoint":
//      URL endpoint: https://udynqqqxjcyhdeygqumi.supabase.co/functions/v1/stripe-webhook
//      Evento da ascoltare: checkout.session.completed
// 3. Dopo averlo creato, Stripe mostra un "Signing secret" (inizia con
//    whsec_...): copialo.
// 4. Nel progetto Supabase, Edge Functions > Secrets, aggiungi:
//      STRIPE_WEBHOOK_SECRET = il signing secret del punto 3
//    (STRIPE_SECRET_KEY è già impostata da quando abbiamo attivato il
//    checkout, non serve ricrearla).
//
// Fatto questo, ogni pagamento vero aggiorna da solo l'ordine a "paid".
// ============================================================

import Stripe from 'npm:stripe@17.4.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  if (!signature) {
    return new Response('Firma mancante', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response('Firma non valida: ' + (err instanceof Error ? err.message : 'errore'), { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.client_reference_id;

      if (orderId) {
        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
        const { error } = await supabase
          .from('orders')
          .update({ status: 'paid' })
          .eq('id', orderId);

        if (error) {
          return new Response('Errore aggiornamento ordine: ' + error.message, { status: 500 });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : 'Errore sconosciuto', { status: 500 });
  }
});
