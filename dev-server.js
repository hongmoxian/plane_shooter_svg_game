/**
 * Dependency-free development server, accessible only on this computer.
 * Usage: npm run dev
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT || 8080);
const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg'
};

http.createServer((req, res) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
        res.writeHead(400).end('Bad request');
        return;
    }
    const segments = pathname.split(/[\\/]/).filter(Boolean);
    if (segments.some(s => s.startsWith('.') || s === '..')) {
        res.writeHead(403).end('Forbidden');
        return;
    }
    const filename = segments.length ? path.join(...segments) : 'index.html';
    const absolute = path.resolve(root, filename);
    if (!absolute.startsWith(root + path.sep) || !mime[path.extname(absolute).toLowerCase()]) {
        res.writeHead(403).end('Forbidden');
        return;
    }
    fs.readFile(absolute, (err, contents) => {
        if (err) {
            res.writeHead(404).end('Not found');
            return;
        }
        res.writeHead(200, {
            'Content-Type': mime[path.extname(absolute).toLowerCase()],
            'Cache-Control': 'no-store'
        });
        res.end(contents);
    });
}).listen(port, '127.0.0.1', () => {
    console.log('Open http://127.0.0.1:' + port);
});
