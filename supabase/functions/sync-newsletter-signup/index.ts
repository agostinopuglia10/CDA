// ============================================================
// Edge Function: sync-newsletter-signup
//
// COSA FA:
// Ogni volta che qualcuno si iscrive alla newsletter dal sito, lo
// aggiunge automaticamente su MailerLite — così puoi davvero mandare
// email agli iscritti, invece che lasciarli fermi nel database.
//
// COME ATTIVARLA:
// 1. Su MailerLite: Integrations > Developer API > genera una API key
// 2. (Facoltativo) Su MailerLite crea un Gruppo (es. "Sito CDA") e prendi
//    il suo Group ID dall'URL o dalle impostazioni del gruppo — se lo
//    salti, gli iscritti vengono comunque aggiunti, solo senza gruppo.
// 3. Nel progetto Supabase, Edge Functions > Secrets, aggiungi:
//      MAILERLITE_API_KEY   = la chiave presa al punto 1
//      MAILERLITE_GROUP_ID  = l'ID del gruppo (facoltativo)
// 4. Pubblica questa funzione da Edge Functions > Deploy a new function,
//    chiamata "sync-newsletter-signup", incollando questo file
// 5. Collega il "trigger": Database > Webhooks > Create a new webhook
//      - Tabella: newsletter_signups
//      - Evento: Insert
//      - Tipo: Edge Function
//      - Funzione: sync-newsletter-signup
//
// Fatto questo, ogni iscrizione dal sito finisce automaticamente anche
// su MailerLite, pronta per essere inclusa nelle tue email/newsletter.
// ============================================================

const MAILERLITE_API_KEY = Deno.env.get('MAILERLITE_API_KEY')!;
const MAILERLITE_GROUP_ID = Deno.env.get('MAILERLITE_GROUP_ID') || '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const payload = await req.json();
    const record = payload.record || {};

    if (!record.email) {
      return jsonError('Email mancante', 400);
    }

    const body: Record<string, unknown> = {
      email: record.email,
      fields: {
        source: record.source_page || '',
      },
    };
    if (MAILERLITE_GROUP_ID) body.groups = [MAILERLITE_GROUP_ID];

    const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MAILERLITE_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      return jsonError('Errore MailerLite: ' + errText, 500);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
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
