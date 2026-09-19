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
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const NOTIFY_EMAIL = Deno.env.get('NOTIFY_EMAIL') || 'talucci.maria@alice.it';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'CDA Sito <onboarding@resend.dev>';
const NTFY_TOPIC = Deno.env.get('NTFY_TOPIC') || 'cda-camper-ordini-tvl24k';

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

        // Stripe raccoglie nome/email/telefono/indirizzo durante il suo checkout
        // (create-checkout-session lo richiede con shipping_address_collection e
        // phone_number_collection): il sito non li chiede mai da solo per chi paga
        // con carta, quindi li salviamo qui, ora che il pagamento è confermato.
        const details = session.customer_details;
        const addr = details?.address;
        const formattedAddress = [addr?.line1, addr?.line2, addr?.postal_code, addr?.city, addr?.state, addr?.country]
          .filter(Boolean)
          .join(', ');

        const updatePayload: Record<string, unknown> = { status: 'paid' };
        if (details?.name) updatePayload.customer_name = details.name;
        if (details?.email) updatePayload.customer_email = details.email;
        if (details?.phone) updatePayload.customer_phone = details.phone;
        if (formattedAddress) updatePayload.shipping_address = formattedAddress;

        const { data: updatedOrder, error } = await supabase
          .from('orders')
          .update(updatePayload)
          .eq('id', orderId)
          .select()
          .single();

        if (error) {
          return new Response('Errore aggiornamento ordine: ' + error.message, { status: 500 });
        }

        // Avviso via email: mai far fallire la conferma del pagamento se l'email non parte.
        await notifyNewOrder(updatedOrder, orderId).catch(() => {});
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

// Manda un avviso email al negozio ogni volta che un pagamento con carta
// va a buon fine, così non serve controllare la dashboard admin a mano.
async function notifyNewOrder(
  order: { customer_name: string; customer_email: string; customer_phone: string; shipping_address: string; total_cents: number },
  orderId: string
) {
  if (!RESEND_API_KEY) return; // secret non ancora configurato: nessun avviso, nessun errore

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: items } = await supabase
    .from('order_items')
    .select('quantity, unit_price_cents, product:product_id(name)')
    .eq('order_id', orderId);

  const itemsHtml = (items || [])
    .map((li: { quantity: number; unit_price_cents: number; product: { name: string } | null }) =>
      `<li>${escapeHtml(li.product?.name || 'Prodotto')} × ${li.quantity} — ${(li.unit_price_cents / 100).toFixed(2)} €</li>`
    )
    .join('');

  const html = `
    <h2>Nuovo ordine (Carta di credito)</h2>
    <p><strong>Totale:</strong> ${(order.total_cents / 100).toFixed(2)} €</p>
    <p><strong>Cliente:</strong> ${escapeHtml(order.customer_name) || '-'}</p>
    <p><strong>Email:</strong> ${escapeHtml(order.customer_email) || '-'}</p>
    <p><strong>Telefono:</strong> ${escapeHtml(order.customer_phone) || '-'}</p>
    <p><strong>Indirizzo di spedizione:</strong> ${escapeHtml(order.shipping_address) || '-'}</p>
    <p><strong>Articoli:</strong></p>
    <ul>${itemsHtml}</ul>
    <hr>
    <p style="color:#888;font-size:12px;">Gestisci l'ordine dalla dashboard admin del sito.</p>
  `;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject: `Nuovo ordine (Carta) — ${(order.total_cents / 100).toFixed(2)} €`,
      html,
    }),
  });

  // Notifica push istantanea sul telefono (app ntfy, nessun account):
  // l'email su Aruba/iPhone arriva solo a intervalli, non in push vero.
  // Header HTTP: solo ASCII (niente €/accenti), il resto va nel body.
  await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: 'POST',
    headers: { Title: `Nuovo ordine - ${(order.total_cents / 100).toFixed(2)} EUR`, Priority: 'high' },
    body: `Carta di credito (gia' incassato, accredito Stripe) - ${order.customer_name || 'Cliente'} - ${(items || []).map((li: { product: { name: string } | null }) => li.product?.name || 'Prodotto').join(', ')}`,
  }).catch(() => {});
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
