// ============================================================
// Edge Function: publish-scheduled-post
//
// COSA FA:
// Chiamata ogni giorno da un job pianificato (pg_cron, vedi migrazione
// 011_cron_publish_social_posts.sql). Ogni volta controlla la tabella
// social_posts e, se sono passati almeno MIN_DAYS_BETWEEN_POSTS giorni
// dall'ultimo post pubblicato, pubblica il prossimo post con
// status = 'ready' su Facebook (e su Instagram, se colleghi anche
// META_IG_USER_ID) — senza che tu debba incollare nulla a mano.
//
// GATE DI SICUREZZA (voluto, non toccare): un post parte SOLO se ha
// status = 'ready' E un'immagine (image_url) valorizzata. I 7 post
// caricati dalla migrazione 010 partono tutti come 'draft' — restano
// fermi finché non decidi tu di portarli a 'ready' (equivale a premere
// "pubblica"): Supabase -> Table Editor -> social_posts -> modifica la
// riga, incolla l'URL dell'immagine vera, cambia status in "ready".
//
// COME ATTIVARLA:
// 1. Crea la Pagina Facebook + collega un profilo Instagram Business
//    (Meta Business Suite > Impostazioni > Account collegati)
// 2. Su Meta for Developers crea un'app, poi genera un token di accesso
//    di lunga durata per la tua Pagina (Page Access Token) con i permessi
//    pages_manage_posts e, se usi anche Instagram, instagram_content_publish
// 3. Nel progetto Supabase, Edge Functions > Secrets, aggiungi:
//      META_PAGE_ACCESS_TOKEN  = il token del punto 2
//      META_PAGE_ID            = l'ID numerico della Pagina Facebook
//      META_IG_USER_ID         = facoltativo, ID account Instagram Business
//                                (se assente, pubblica solo su Facebook)
// 4. Pubblica questa funzione da Edge Functions > Deploy a new function,
//    chiamata "publish-scheduled-post", incollando questo file
// 5. Applica la migrazione 011 (pg_cron) se non è già attiva
//
// Finché i secret del punto 3 non ci sono, la funzione gira comunque
// (chiamata dal cron ogni giorno) ma non fa nulla — risponde solo
// "Meta non ancora configurato".
// ============================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const META_PAGE_ACCESS_TOKEN = Deno.env.get('META_PAGE_ACCESS_TOKEN') || '';
const META_PAGE_ID = Deno.env.get('META_PAGE_ID') || '';
const META_IG_USER_ID = Deno.env.get('META_IG_USER_ID') || '';
const MIN_DAYS_BETWEEN_POSTS = Number(Deno.env.get('MIN_DAYS_BETWEEN_POSTS') || '3');

const REST_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

Deno.serve(async () => {
  try {
    if (!META_PAGE_ACCESS_TOKEN || !META_PAGE_ID) {
      return ok('Meta non ancora configurato (manca META_PAGE_ACCESS_TOKEN o META_PAGE_ID) — nessun post pubblicato.');
    }

    const lastPublished = await fetchOne(
      `${SUPABASE_URL}/rest/v1/social_posts?select=published_at&status=eq.published&order=published_at.desc&limit=1`
    );
    if (lastPublished?.published_at) {
      const daysSince = (Date.now() - new Date(lastPublished.published_at).getTime()) / 86400000;
      if (daysSince < MIN_DAYS_BETWEEN_POSTS) {
        return ok(`Troppo presto: ultimo post pubblicato ${daysSince.toFixed(1)} giorni fa (minimo ${MIN_DAYS_BETWEEN_POSTS}).`);
      }
    }

    const next = await fetchOne(
      `${SUPABASE_URL}/rest/v1/social_posts?select=*&status=eq.ready&image_url=not.is.null&order=sort_order.asc&limit=1`
    );
    if (!next) {
      return ok('Nessun post con status "ready" e immagine pronta da pubblicare.');
    }

    const message = [next.headline, next.caption, next.hashtags].filter(Boolean).join('\n\n');

    try {
      const fbPostId = await publishToFacebook(next.image_url, message);
      let igPostId: string | null = null;
      if (META_IG_USER_ID) {
        igPostId = await publishToInstagram(next.image_url, message);
      }

      await patchPost(next.id, {
        status: 'published',
        published_at: new Date().toISOString(),
        external_post_id: [fbPostId, igPostId].filter(Boolean).join(' / '),
        error_message: null,
      });

      return ok(`Pubblicato "${next.slug}" su Facebook${igPostId ? ' e Instagram' : ''}.`);
    } catch (publishErr) {
      const message = publishErr instanceof Error ? publishErr.message : String(publishErr);
      await patchPost(next.id, { status: 'failed', error_message: message });
      return ok(`Pubblicazione fallita per "${next.slug}": ${message}`, 500);
    }
  } catch (err) {
    return ok(err instanceof Error ? err.message : 'Errore sconosciuto', 500);
  }
});

async function publishToFacebook(imageUrl: string, caption: string): Promise<string> {
  const params = new URLSearchParams({ url: imageUrl, caption, access_token: META_PAGE_ACCESS_TOKEN });
  const res = await fetch(`https://graph.facebook.com/v20.0/${META_PAGE_ID}/photos`, { method: 'POST', body: params });
  const data = await res.json();
  if (!res.ok) throw new Error('Facebook: ' + JSON.stringify(data.error || data));
  return data.post_id || data.id;
}

async function publishToInstagram(imageUrl: string, caption: string): Promise<string> {
  const createParams = new URLSearchParams({ image_url: imageUrl, caption, access_token: META_PAGE_ACCESS_TOKEN });
  const createRes = await fetch(`https://graph.facebook.com/v20.0/${META_IG_USER_ID}/media`, { method: 'POST', body: createParams });
  const createData = await createRes.json();
  if (!createRes.ok) throw new Error('Instagram (media): ' + JSON.stringify(createData.error || createData));

  const publishParams = new URLSearchParams({ creation_id: createData.id, access_token: META_PAGE_ACCESS_TOKEN });
  const publishRes = await fetch(`https://graph.facebook.com/v20.0/${META_IG_USER_ID}/media_publish`, { method: 'POST', body: publishParams });
  const publishData = await publishRes.json();
  if (!publishRes.ok) throw new Error('Instagram (publish): ' + JSON.stringify(publishData.error || publishData));
  return publishData.id;
}

async function fetchOne(url: string): Promise<Record<string, any> | null> {
  const res = await fetch(url, { headers: REST_HEADERS });
  if (!res.ok) throw new Error('Lettura social_posts fallita: ' + (await res.text()));
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function patchPost(id: string, fields: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/social_posts?id=eq.${id}`, {
    method: 'PATCH',
    headers: REST_HEADERS,
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Aggiornamento social_posts fallito: ' + (await res.text()));
}

function ok(message: string, status = 200) {
  return new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json' } });
}
