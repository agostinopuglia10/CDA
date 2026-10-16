const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.json': 'application/json'
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  // path.join da solo non blocca "..": una richiesta tipo /../../../etc/passwd
  // uscirebbe dalla cartella del sito. path.resolve + controllo del prefisso
  // impedisce di leggere file fuori da "root".
  const fp = path.resolve(root, '.' + p);
  if (fp !== root && !fp.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
// Solo localhost: il server serve esclusivamente per l'anteprima sulla
// macchina di sviluppo, non deve rispondere ad altri dispositivi in rete.
}).listen(8642, '127.0.0.1', () => console.log('listening on 127.0.0.1:8642'));
