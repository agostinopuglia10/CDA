// IndexNow: dopo ogni deploy di produzione avvisa Bing (e Yandex, Seznam,
// Naver, che condividono lo stesso protocollo) delle pagine nuove o cambiate,
// così le scansionano in giorni invece che in settimane. Bing porta già una
// parte delle visite e ChatGPT/Copilot cercano sull'indice di Bing.
//
// Come decide cosa inviare: per ogni URL della sitemap calcola l'impronta
// (sha1) del file HTML pubblicato e la confronta con quella salvata nella
// cache di Netlify al deploy precedente. Invia solo le pagine nuove o
// cambiate; al primo deploy (cache vuota) le invia tutte.
//
// La chiave è nel file 5c85c65856cb414db18bc88a3e4cc154.txt alla radice del
// sito: IndexNow lo scarica per verificare che il sito sia nostro.
// Un errore qui non blocca mai il deploy: al massimo non parte l'avviso.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const HOST = 'cda-camper.it'
const KEY = '5c85c65856cb414db18bc88a3e4cc154'
const CACHE_FILE = '.indexnow-cache/hashes.json'

let pending = []

function sitemapUrls(publishDir) {
  const xml = fs.readFileSync(path.join(publishDir, 'sitemap.xml'), 'utf8')
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim())
}

function fileFor(publishDir, url) {
  const p = new URL(url).pathname
  return path.join(publishDir, p === '/' ? 'index.html' : decodeURIComponent(p.slice(1)))
}

module.exports = {
  async onPostBuild({ constants, utils }) {
    if (process.env.CONTEXT !== 'production') return
    try {
      await utils.cache.restore(CACHE_FILE)
      const old = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {}
      const now = {}
      for (const url of sitemapUrls(constants.PUBLISH_DIR)) {
        const file = fileFor(constants.PUBLISH_DIR, url)
        if (!fs.existsSync(file)) continue
        now[url] = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex')
        if (old[url] !== now[url]) pending.push(url)
      }
      fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
      fs.writeFileSync(CACHE_FILE, JSON.stringify(now))
      await utils.cache.save(CACHE_FILE)
      console.log(`IndexNow: ${pending.length} pagine nuove o cambiate su ${Object.keys(now).length}`)
    } catch (e) {
      pending = []
      console.log('IndexNow: calcolo saltato,', e.message)
    }
  },

  // onSuccess parte solo quando il deploy è online: le pagine inviate
  // esistono già quando Bing passa a leggerle.
  async onSuccess() {
    if (process.env.CONTEXT !== 'production' || pending.length === 0) return
    try {
      // IndexNow accetta fino a 10.000 URL per richiesta: il sito ne ha ~280.
      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: HOST,
          key: KEY,
          keyLocation: `https://${HOST}/${KEY}.txt`,
          urlList: pending.slice(0, 10000),
        }),
      })
      console.log(`IndexNow: inviate ${pending.length} pagine, risposta ${res.status}`)
    } catch (e) {
      console.log('IndexNow: invio non riuscito,', e.message)
    }
  },
}
