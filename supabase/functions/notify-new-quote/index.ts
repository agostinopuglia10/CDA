// ============================================================
// Edge Function: notify-new-quote
//
// COSA FA:
// Ogni volta che arriva una nuova richiesta di preventivo (form
// Contatti), invia un'email di avviso — così non devi controllare
// a mano la tabella su Supabase.
//
// COME ATTIVARLA:
// 1. Crea un account gratuito su resend.com (servizio per inviare email)
// 2. Prendi la tua API key da resend.com/api-keys
// 3. Nel progetto Supabase, Edge Functions > Secrets, aggiungi:
//      RESEND_API_KEY   = la chiave presa da Resend
//      NOTIFY_EMAIL     = l'indirizzo a cui vuoi ricevere gli avvisi
//                         (per ora: agostino.puglia@gmail.com — cambialo
//                          qui quando avrai l'email definitiva
//                          dell'attività, senza toccare il codice)
// 4. Pubblica questa funzione da Edge Functions > Deploy a new function,
//    chiamata "notify-new-quote", incollando questo file
// 5. Collega il "trigger": Database > Webhooks > Create a new webhook
//      - Tabella: quote_requests
//      - Evento: Insert
//      - Tipo: Edge Function
//      - Funzione: notify-new-quote
//
// Fatto questo, ogni nuova richiesta dal form Contatti ti arriva
// automaticamente via email.
// ============================================================

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
// Placeholder: sostituiscilo aggiornando il secret NOTIFY_EMAIL su Supabase,
// non serve ripubblicare la funzione.
const NOTIFY_EMAIL = Deno.env.get('NOTIFY_EMAIL') || 'agostino.puglia@gmail.com';
// Il mittente deve appartenere a un dominio verificato su Resend;
// finché non ne verifichi uno tuo (es. info@cda-camper.it), usa quello di test.
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'CDA Sito <onboarding@resend.dev>';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record || {};

    // Il form Contatti è pubblico: chiunque può scrivere HTML nei campi
    // (es. un link camuffato nel messaggio). Va sempre "escapato" prima di
    // finire nel corpo HTML dell'email, altrimenti verrebbe reso cliccabile
    // nella tua casella di posta.
    const html = `
      <h2>Nuova richiesta dal sito CDA</h2>
      <p><strong>Nome:</strong> ${escapeHtml(record.name) || '-'}</p>
      <p><strong>Email:</strong> ${escapeHtml(record.email) || '-'}</p>
      <p><strong>Telefono:</strong> ${escapeHtml(record.phone) || '-'}</p>
      <p><strong>Motivo:</strong> ${escapeHtml(record.request_type) || '-'}</p>
      <p><strong>Messaggio:</strong> ${escapeHtml(record.message) || '-'}</p>
      <p><strong>Pagina di provenienza:</strong> ${escapeHtml(record.source_page) || '-'}</p>
      <hr>
      <p style="color:#888;font-size:12px;">Rispondi direttamente all'email del cliente per contattarlo.</p>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: NOTIFY_EMAIL,
        reply_to: record.email || undefined,
        subject: `Nuova richiesta: ${record.request_type || 'Shop/Servizi'} — ${record.name || ''}`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Errore sconosciuto' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
