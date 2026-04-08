const http = require('http');
const fs = require('fs');
const port = process.env.PORT || 4111;
const file = "C:\\Users\\Admin\\Documents\\Cadenza-Agent-Vue\\deployed\\address_book_ui_frontend_address_book_ui_1775485527722.html";
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/health') { res.writeHead(200); return res.end(JSON.stringify({ok:true})); }
  try {
    const html = fs.readFileSync(file, 'utf-8');
    res.writeHead(200, {'Content-Type':'text/html'});
    res.end(html);
  } catch(e) {
    res.writeHead(500); res.end('Error: ' + e.message);
  }
});
server.listen(port, () => console.log('Frontend server listening on port ' + port));
