// ============================================================
// Edge Function: log-funnel-event
//
// COSA FA:
// Registra un passaggio del funnel di acquisto (vista prodotto,
// aggiunta al carrello, inizio checkout) in modo anonimo, SENZA
// dipendere dal consenso cookie GA4/Meta (che carica solo dopo
// "Accetta tutti" e quindi perde la maggior parte delle sessioni
// reali). Nessun dato personale: solo un id di visita generato
// lato client (sessionStorage, sparisce alla chiusura della scheda),
// mai incrociato con email/nome/IP salvati altrove.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_EVENTS = new Set(['view_item', 'add_to_cart', 'begin_checkout']);

// Crawler e strumenti automatici (Googlebot, Bing, PageSpeed, Lighthouse, browser headless...)
// eseguono il JavaScript del sito e mandavano eventi falsi: il 03-04/10/2026 risultavano
// 167 e 124 "visualizzazioni prodotto" in un giorno su 123 prodotti diversi, cioe' Google che
// scansionava il catalogo, non persone. Non vanno contate nel funnel.
const BOT_USER_AGENT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|inspectiontool|python-requests|curl\/|wget|node-fetch|axios/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  // Risposta "ok" anche per i bot, cosi' non vedono errori: semplicemente non registriamo nulla.
  if (BOT_USER_AGENT.test(req.headers.get('user-agent') || '')) {
    return new Response(JSON.stringify({ ok: true, ignored: 'bot' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { event_name, visit_id, product_id } = await req.json();

    if (!ALLOWED_EVENTS.has(event_name) || typeof visit_id !== 'string' || !visit_id) {
      return new Response(JSON.stringify({ error: 'Parametri non validi' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await supabase.from('funnel_events').insert({
      event_name,
      visit_id: visit_id.slice(0, 100),
      product_id: typeof product_id === 'string' ? product_id : null,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch {
    // Non deve mai bloccare l'esperienza utente: un errore qui non
    // è più grave di un evento mancato.
    return new Response(JSON.stringify({ ok: false }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
