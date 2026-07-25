// ============================================================
// Edge Function: create-checkout-session
//
// COSA FA:
// Riceve dal sito l'elenco degli articoli nel carrello (solo ID e
// quantità), controlla i prezzi VERI nel database (mai fidarsi di un
// prezzo mandato dal browser: si potrebbe modificare facilmente), crea
// un ordine "pending" e una sessione di pagamento Stripe, e restituisce
// l'URL a cui reindirizzare il cliente per pagare.
//
// COME ATTIVARLA (quando avrai gli account pronti):
// 1. Installa la CLI di Supabase (una volta sola): npm install -g supabase
// 2. Nel terminale, dalla cartella del progetto:
//      supabase login
//      supabase link --project-ref udynqqqxjcyhdeygqumi
// 3. Imposta la chiave segreta di Stripe (MAI nel codice, MAI nel sito):
//      supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxxxxx
// 4. Pubblica la funzione:
//      supabase functions deploy create-checkout-session
// 5. L'URL della funzione sarà:
//      https://udynqqqxjcyhdeygqumi.supabase.co/functions/v1/create-checkout-session
//    Dimmelo quando è online e collego il bottone "Vai al carrello" del sito.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') || 'https://www.cda-camper.it';

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

    // 2. Crea l'ordine "pending" nel database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: customer?.name || '',
        customer_email: customer?.email || '',
        customer_phone: customer?.phone || '',
        shipping_address: customer?.shipping_address || '',
        status: 'pending',
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

    // 3. Crea la sessione di pagamento su Stripe
    const stripeBody = new URLSearchParams();
    stripeBody.set('mode', 'payment');
    stripeBody.set('success_url', `${SITE_URL}/ordine-confermato.html?session_id={CHECKOUT_SESSION_ID}`);
    stripeBody.set('cancel_url', `${SITE_URL}/shop.html`);
    stripeBody.set('client_reference_id', order.id);
    if (customer?.email) stripeBody.set('customer_email', customer.email);

    lineItems.forEach((li: { product: { name: string; price_cents: number; currency: string }; quantity: number }, idx: number) => {
      stripeBody.set(`line_items[${idx}][price_data][currency]`, (li.product.currency || 'eur').toLowerCase());
      stripeBody.set(`line_items[${idx}][price_data][product_data][name]`, li.product.name);
      stripeBody.set(`line_items[${idx}][price_data][unit_amount]`, String(li.product.price_cents));
      stripeBody.set(`line_items[${idx}][quantity]`, String(li.quantity));
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: stripeBody,
    });

    const session = await stripeRes.json();
    if (!stripeRes.ok) return jsonError('Errore Stripe: ' + (session.error?.message || 'sconosciuto'), 500);

    // 4. Salva l'id sessione Stripe sull'ordine, per riconciliare dopo il pagamento
    await supabase.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id);

    return new Response(JSON.stringify({ checkout_url: session.url }), {
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
