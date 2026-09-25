// ============================================================
// Edge Function: sync-newsletter-signup
//
// COSA FA, ad ogni nuova iscrizione alla newsletter dal sito:
// 1. Aggiunge l'indirizzo su MailerLite (lista iscritti, per campagne
//    manuali future se servono).
// 2. Invia subito un'email di benvenuto reale, via Resend (stesso
//    servizio già usato per gli avvisi di nuovo ordine).
//
// SECRETS USATI (già configurati su questo progetto):
//   MAILERLITE_API_KEY, MAILERLITE_GROUP_ID (facoltativo)
//   RESEND_API_KEY, FROM_EMAIL
// ============================================================

const MAILERLITE_API_KEY = Deno.env.get('MAILERLITE_API_KEY')!;
const MAILERLITE_GROUP_ID = Deno.env.get('MAILERLITE_GROUP_ID') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'CDA Sito <onboarding@resend.dev>';

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

    // L'email di benvenuto non deve mai far fallire l'iscrizione: se Resend
    // non è configurato o dà errore, l'iscritto resta comunque salvato.
    await sendWelcomeEmail(record.email, record.unsubscribe_token).catch(() => {});

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Errore sconosciuto', 500);
  }
});

async function sendWelcomeEmail(email: string, unsubscribeToken?: string) {
  if (!RESEND_API_KEY) return; // secret non configurato: nessun invio, nessun errore

  const unsubscribeUrl = unsubscribeToken
    ? `https://udynqqqxjcyhdeygqumi.supabase.co/functions/v1/newsletter-unsubscribe?token=${unsubscribeToken}`
    : null;

  const html = welcomeEmailHtml(unsubscribeUrl);

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      subject: 'Benvenuto/a da CDA — sei dei nostri',
      html,
    }),
  });
}

function welcomeEmailHtml(unsubscribeUrl: string | null): string {
  return `<!DOCTYPE html>
<html lang="it">
<body style="margin:0;padding:0;background:#F7F5F2;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F2;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #E4E1DB;">
        <tr><td style="background:#1B1B1D;padding:28px 32px;">
          <span style="font-family:Arial,sans-serif;font-weight:800;font-size:22px;letter-spacing:.04em;color:#ffffff;">CDA</span>
          <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#C9CDD0;margin-top:4px;">Camper &amp; Lavorazioni · Tivoli</div>
        </td></tr>
        <tr><td style="padding:36px 32px 8px;">
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#D2131A;font-weight:bold;">Iscrizione confermata</p>
          <h1 style="margin:0 0 18px;font-size:24px;line-height:1.2;color:#1B1B1D;">Benvenuto/a, sei dei nostri.</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3a3a3d;">
            Da oggi ricevi le novità di CDA: nuovi prodotti nello shop, occasioni reali (mai sconti inventati) e qualche consiglio utile per il tuo camper — senza esagerare con la frequenza.
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3a3a3d;">
            Una cosa che ci distingue: non siamo solo uno shop online. Dietro c'è un vero centro tecnico a Tivoli (RM), dove installiamo, montiamo e collaudiamo quello che vendiamo — dalle batterie ai climatizzatori, fino a lavorazioni su misura in lamiera come portapacchi e portabici.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            <tr><td style="background:#D2131A;">
              <a href="https://cda-camper.it/shop.html" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:bold;letter-spacing:.04em;text-transform:uppercase;color:#ffffff;text-decoration:none;">Vai allo shop →</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #E4E1DB;">
          <p style="margin:0 0 6px;font-size:12.5px;color:#6E7276;">CDA di Talucci Maria · Via Arci 24, Tivoli (RM) · P.IVA 04047161007</p>
          <p style="margin:0;font-size:12.5px;color:#6E7276;">
            ${unsubscribeUrl ? `<a href="${unsubscribeUrl}" style="color:#6E7276;">Annulla iscrizione</a>` : 'Puoi annullare l\'iscrizione in qualsiasi momento.'}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
