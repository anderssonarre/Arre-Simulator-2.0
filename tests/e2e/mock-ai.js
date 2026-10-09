// Låtsas-Claude för webbläsartestet. Svarar som riktiga API:t, med verktygsanrop, men utan nyckel
// och utan kostnad. Räknar anropen på /calls så att testet kan kolla hur många som gjordes.
'use strict';
const http = require('http');

function start(port) {
  const calls = { vardag: 0, halsa: 0, svara: 0, tidning: 0, uppdrag: 0 };
  const server = http.createServer((req, res) => {
    if (req.url === '/calls') return res.end(JSON.stringify(calls));
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = JSON.parse(raw || '{}'),
        tool = body.tool_choice?.name,
        sys = body.system || '';
      calls[tool] = (calls[tool] || 0) + 1;
      const ids = [...sys.matchAll(/^- (\w+): /gm)].map((m) => m[1]);
      let input;
      if (tool === 'vardag') {
        const pairs = [...sys.matchAll(/^- (\w+) och (\w+) \(/gm)];
        const players = (sys.match(/spelar och går runt på campus: (.*)\./) || [])[1]?.split(', ') || [];
        input = {
          personer: ids.map((id) => ({ id, tanke: 'TEST-TANKE ' + id })),
          samtal: pairs.map((p, i) => ({
            a: p[1],
            b: p[2],
            repliker: ['TEST-SAMTAL ' + i, 'svar', 'slut'],
            om: players[i % Math.max(1, players.length)] || '',
          })),
        };
      } else if (tool === 'halsa') {
        const who = (sys.match(/ska hälsa på (\S+)/) || [])[1] || '';
        input = { personer: ids.map((id) => ({ id, hälsningar: ['TEST-HEJ ' + who] })) };
      } else if (tool === 'uppdrag') {
        input = {
          uppdrag: [
            {
              titel: 'TEST-UPPDRAG',
              person: 'ida',
              erbjudande: 'Kan du hämta min halsduk vid Tritonia?',
              steg: [
                { typ: 'plats', plats: 'tritonia', mål: 'Hämta halsduken', hittar: 'En randig halsduk.' },
                { typ: 'prata', person: 'ida', mål: 'Ge den till Ida', knapp: 'Här!', svar: 'Tack!' },
              ],
              belöning: { pengar: 7, glädje: 4, relation: 6 },
              avslut: 'Ida knyter halsduken.',
            },
            { titel: 'Ogiltigt', person: 'ida', erbjudande: 'x', steg: [{ typ: 'plats', plats: 'månen', mål: 'x' }] },
          ],
        };
      } else if (tool === 'tidning') {
        const facts = [...sys.matchAll(/^- (.+)$/gm)].map((m) => m[1]);
        input = { rubrik: 'TEST-RUBRIK', artiklar: [{ rubrik: 'Veckan', text: facts.join(' ') }] };
      } else input = { svar: 'TEST-SVAR', handling: 'ingen' };
      // Dagsanropet tar en stund, som på riktigt, så att samtidiga spelare hinner fråga samtidigt.
      setTimeout(
        () => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              stop_reason: 'tool_use',
              content: [{ type: 'tool_use', id: 't1', name: tool, input }],
            }),
          );
        },
        tool === 'vardag' ? 600 : 50,
      );
    });
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}
module.exports = { start };
