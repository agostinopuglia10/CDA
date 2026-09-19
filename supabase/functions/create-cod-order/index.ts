// ============================================================
// Edge Function: create-cod-order
//
// COSA FA:
// Crea un ordine pagato "in contrassegno" (contanti al corriere alla
// consegna): niente Stripe, niente pagamento online. Controlla i
// prezzi VERI nel database (mai fidarsi di un prezzo mandato dal
// browser), crea l'ordine con status 'cod_pending' e i relativi
// order_items, e restituisce l'id ordine per la pagina di conferma.
//
// L'eventuale commissione per il contrassegno la applica il corriere
// al momento della consegna, non è inclusa nel totale calcolato qui.
//
// COME ATTIVARLA:
// 1. Installa la CLI di Supabase (una volta sola): npm install -g supabase
// 2. Nel terminale, dalla cartella del progetto:
//      supabase login
//      supabase link --project-ref udynqqqxjcyhdeygqumi
// 3. Pubblica la funzione:
//      supabase functions deploy create-cod-order
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const NOTIFY_EMAIL = Deno.env.get('NOTIFY_EMAIL') || 'talucci.maria@alice.it';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'CDA Sito <onboarding@resend.dev>';
// Nome pubblico ma "difficile da indovinare": chiunque lo conosca potrebbe
// mandare notifiche finte, ma non leggere quelle vere (ntfy.sh e' solo push,
// nessun dato sensibile transita qui oltre a nome cliente e articoli).
const NTFY_TOPIC = Deno.env.get('NTFY_TOPIC') || 'cda-camper-ordini-tvl24k';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { items, customer } = await req.json();
    // items atteso: [{ product_id: 'uuid', quantity: 2 }, ...]
    // customer atteso: { name, email, phone, shipping_address }

    if (!Array.isArray(items) || items.length === 0) {
      return jsonError('Carrello vuoto', 400);
    }
    if (!customer?.name || !customer?.email || !customer?.phone || !customer?.shipping_address) {
      return jsonError('Dati cliente incompleti: nome, email, telefono e indirizzo di spedizione sono obbligatori per il contrassegno', 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Recupera i prezzi VERI dal database (mai dal client)
    const productIds = items.map((i: { product_id: string }) => i.product_id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price_cents, currency, stock, active')
      .in('id', productIds);

    if (productsError) return jsonError('Errore nel recupero prodotti: ' + productsError.message, 500);

    const lineItems = items.map((item: { product_id: string; quantity: number }) => {
      const product = products.find((p: { id: string }) => p.id === item.product_id);
      if (!product || !product.active) {
        throw new Error('Prodotto non disponibile: ' + item.product_id);
      }
      return { product, quantity: Math.max(1, item.quantity | 0) };
    });

    const totalCents = lineItems.reduce(
      (sum: number, li: { product: { price_cents: number }; quantity: number }) => sum + li.product.price_cents * li.quantity,
      0
    );

    // 2. Crea l'ordine con status 'cod_pending': da riscuotere alla consegna,
    // nessuna sessione Stripe collegata.
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        shipping_address: customer.shipping_address,
        status: 'cod_pending',
        total_cents: totalCents,
      })
      .select()
      .single();

    if (orderError) return jsonError('Errore nella creazione ordine: ' + orderError.message, 500);

    await supabase.from('order_items').insert(
      lineItems.map((li: { product: { id: string; price_cents: number } }) => ({
        order_id: order.id,
        product_id: li.product.id,
        quantity: (items.find((i: { product_id: string }) => i.product_id === li.product.id) || {}).quantity || 1,
        unit_price_cents: li.product.price_cents,
      }))
    );

    // Avviso via email: mai far fallire l'ordine se l'email non parte.
    await notifyNewOrder(order, lineItems, 'Contrassegno').catch(() => {});

    return new Response(JSON.stringify({ order_id: order.id }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Errore sconosciuto', 500);
  }
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Manda un avviso email al negozio ogni volta che arriva un ordine vero
// (contrassegno qui, pagamento confermato in stripe-webhook per la carta),
// così non serve controllare la dashboard admin a mano per accorgersene.
async function notifyNewOrder(
  order: { id: string; customer_name: string; customer_email: string; customer_phone: string; shipping_address: string; total_cents: number },
  lineItems: { product: { name: string; price_cents: number }; quantity: number }[],
  paymentLabel: string
) {
  if (!RESEND_API_KEY) return; // secret non ancora configurato: nessun avviso, nessun errore

  const itemsHtml = lineItems
    .map((li) => `<li>${escapeHtml(li.product.name)} × ${li.quantity} — ${(li.product.price_cents / 100).toFixed(2)} €</li>`)
    .join('');

  const html = `
    <h2>Nuovo ordine (${escapeHtml(paymentLabel)})</h2>
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
      subject: `Nuovo ordine (${paymentLabel}) — ${(order.total_cents / 100).toFixed(2)} €`,
      html,
    }),
  });

  // Notifica push istantanea sul telefono (app ntfy, nessun account):
  // l'email su Aruba/iPhone arriva solo a intervalli, non in push vero.
  // Header HTTP: solo ASCII (niente €/accenti), il resto va nel body.
  await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: 'POST',
    headers: { Title: `Nuovo ordine - ${(order.total_cents / 100).toFixed(2)} EUR`, Priority: 'high' },
    body: `${paymentLabel} (da riscuotere al corriere alla consegna) - ${order.customer_name || 'Cliente'} - ${lineItems.map((li) => li.product.name).join(', ')}`,
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
