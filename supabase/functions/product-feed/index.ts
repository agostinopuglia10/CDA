// ============================================================
// Edge Function: product-feed
//
// COSA FA:
// Genera in tempo reale un feed prodotti in formato Google Shopping
// (RSS 2.0 con namespace g:) leggendo i prodotti direttamente dal
// database. Ogni volta che viene chiamata, il feed riflette lo stato
// attuale del catalogo: non serve rigenerarlo a mano.
//
// Include SOLO i prodotti che rispettano i requisiti minimi di Google
// Merchant Center (altrimenti Google li rifiuta comunque):
//   - active = true
//   - prezzo reale impostato (price_cents > 0)
//   - foto presente (image_url non vuoto)
// I prodotti senza foto o ancora a prezzo segnaposto (0€) restano
// fuori dal feed finché non li completi — non è un errore, è voluto.
//
// COME ATTIVARLA:
// 1. Installa la CLI di Supabase (una volta sola): npm install -g supabase
// 2. Nel terminale, dalla cartella del progetto:
//      supabase login
//      supabase link --project-ref udynqqqxjcyhdeygqumi
// 3. Pubblica la funzione:
//      supabase functions deploy product-feed --no-verify-jwt
//    (--no-verify-jwt perché Google Merchant deve poterla leggere
//    senza autenticazione, come un feed pubblico qualsiasi)
// 4. L'URL del feed sarà:
//      https://udynqqqxjcyhdeygqumi.supabase.co/functions/v1/product-feed
//    Questo è l'URL da incollare in Google Merchant Center sotto
//    "Feed" > "Aggiungi feed" > "Recupero pianificato".
//
// IMPORTANTE PRIMA DI ATTIVARE SU GOOGLE MERCHANT:
// - Serve un sito pubblicato con dominio reale (oggi il sito non è
//   ancora online), perché Google verifica che i link dei prodotti
//   puntino a pagine raggiungibili.
// - Le immagini attualmente collegate sono ospitate sui server dei
//   fornitori (Euro Accessoires Italia / GES): verifica di avere
//   l'autorizzazione scritta a usarle prima di metterle in un feed
//   pubblicitario attivo, non solo sul sito.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: products, error } = await supabase
      .from('products')
      .select('id, slug, name, description, price_cents, currency, image_url, brand, stock, is_bundle, categories(name, path)')
      .eq('active', true)
      .gt('price_cents', 0)
      .not('image_url', 'is', null)
      .neq('image_url', '');

    if (error) {
      return new Response('Errore nel recupero prodotti: ' + error.message, { status: 500, headers: CORS_HEADERS });
    }

    const items = (products || [])
      .map((p) => {
        const link = `${SITE_URL}/prodotto.html?id=${p.id}`;
        const priceEUR = (p.price_cents / 100).toFixed(2);
        const currency = (p.currency || 'EUR').toUpperCase();
        const availability = p.stock && p.stock > 0 ? 'in stock' : 'in stock'; // drop-ship: si spedisce dal fornitore alla ricezione dell'ordine
        const productType = p.categories?.path
          ? p.categories.path.split('.').map((s: string) => capitalize(s.replace(/-/g, ' '))).join(' > ')
          : '';

        return `  <item>
    <g:id>${escapeXml(p.id)}</g:id>
    <title>${escapeXml(truncate(p.name, 150))}</title>
    <description>${escapeXml(truncate(p.description || p.name, 5000))}</description>
    <link>${escapeXml(link)}</link>
    <g:image_link>${escapeXml(p.image_url)}</g:image_link>
    <g:availability>${availability}</g:availability>
    <g:price>${priceEUR} ${currency}</g:price>
    <g:condition>new</g:condition>
    <g:identifier_exists>no</g:identifier_exists>
    ${p.brand ? `<g:brand>${escapeXml(p.brand)}</g:brand>` : ''}
    ${productType ? `<g:product_type>${escapeXml(productType)}</g:product_type>` : ''}
  </item>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>CDA Camper - Shop</title>
  <link>${escapeXml(SITE_URL)}</link>
  <description>Feed prodotti Shop Camper CDA - Tivoli (RM)</description>
${items}
</channel>
</rss>`;

    return new Response(xml, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/xml; charset=UTF-8' },
    });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : 'Errore sconosciuto', { status: 500, headers: CORS_HEADERS });
  }
});

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max - 1) + '…' : value;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
