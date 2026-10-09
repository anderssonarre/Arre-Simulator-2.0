// Webbläsartest: startar servern med låtsas-Claude, öppnar spelet i två webbläsare samtidigt och
// kollar att det viktigaste fungerar. Körs av GitHub vid varje push, och lokalt med:
//   cd tests/e2e && npm install && npx playwright install chromium && node spela.js
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');
const mock = require('./mock-ai.js');

const PORT = 8090,
  AI_PORT = 9190,
  URL = 'http://localhost:' + PORT + '/?gfx=classic';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const steps = [];
function step(name) {
  steps.push(name);
  console.log('·', name);
}

async function waitFor(page, fn, what, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await page.evaluate(fn).catch(() => false)) return;
    await sleep(250);
  }
  throw Error('Väntade förgäves på: ' + what);
}

(async () => {
  const aiServer = await mock.start(AI_PORT);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arre-e2e-'));
  const game = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..', '..', 'server'),
    env: {
      ...process.env,
      PORT: String(PORT),
      ANTHROPIC_API_KEY: 'test',
      ANTHROPIC_BASE_URL: 'http://localhost:' + AI_PORT,
      DATA_DIR: dataDir,
      DATABASE_URL: '',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const browser = await chromium.launch();
  const errors = [];
  let failed = false;
  try {
    for (let i = 0; i < 40; i++) {
      try {
        if ((await fetch('http://localhost:' + PORT + '/health')).ok) break;
      } catch {}
      await sleep(250);
    }
    step('servern är igång');

    const open = async (nick, options = {}) => {
      const ctx = await browser.newContext(options);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(nick + ': ' + e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(nick + ': ' + m.text()));
      await page.goto(URL);
      await waitFor(page, () => typeof start === 'function' && serverFound !== null, 'sidan');
      return page;
    };

    // Zeb har en sparning från version 1, med en person som inte finns längre.
    const zeb = await open('Zeb');
    await zeb.evaluate(() => {
      const s = fresh('zeb');
      Object.assign(s, {
        version: 1,
        world: 'outdoor',
        x: 40,
        y: 40,
        relations: { axel: 55, otto: 60, borta: 30 },
        histories: { borta: [] },
      });
      localStorage.setItem(SAVE, JSON.stringify(s));
    });
    await zeb.reload();
    await waitFor(zeb, () => typeof start === 'function' && serverFound !== null, 'sidan igen');
    const arvid = await open('Arvid');

    // Båda börjar nästan samtidigt.
    await Promise.all([
      zeb.evaluate(() => {
        $('nickInput').value = 'Zeb';
        $('continueButton').click();
      }),
      arvid.evaluate(() => {
        $('nickInput').value = 'Arvid';
        const s = fresh('arvid');
        s.relations = { axel: 50, ida: 20 };
        start(s);
      }),
    ]);
    await waitFor(zeb, () => active, 'att Zebs spel startar');
    step('gamla sparningen gick att fortsätta');
    const saved = await zeb.evaluate(() => ({
      version: state.version,
      world: state.world,
      relations: state.relations,
      backup: !!localStorage.getItem(SAVE + '_backup_v1'),
    }));
    assert.equal(saved.version, 2);
    assert.equal(saved.world, 'home', 'den som stod ute på gamla kartan börjar hemma');
    assert.deepEqual(saved.relations, { axel: 55, otto: 60 });
    assert.ok(saved.backup, 'en kopia av den gamla sparningen finns');
    step('sparningen uppgraderades och lagades');

    // Dagens liv: samma tankar och samtal för båda, egna hälsningar.
    for (const p of [zeb, arvid])
      await waitFor(
        p,
        () => net.status === 'online' && state.life?.shared && Object.keys(state.life.barks).length,
        'dagens liv från servern',
      );
    const life = (p) =>
      p.evaluate(() => ({
        thoughts: state.life.thoughts,
        talks: state.life.talks,
        bark: state.life.barks.axel,
      }));
    const [lz, la] = [await life(zeb), await life(arvid)];
    assert.deepEqual(lz.thoughts, la.thoughts, 'samma tankar');
    assert.deepEqual(lz.talks, la.talks, 'samma samtal');
    assert.ok(lz.talks.some((t) => t.om === 'Zeb' || t.om === 'Arvid'), 'samtal om spelarna');
    assert.deepEqual(lz.bark, ['TEST-HEJ Zeb']);
    assert.deepEqual(la.bark, ['TEST-HEJ Arvid']);
    const calls = await (await fetch('http://localhost:' + AI_PORT + '/calls')).json();
    assert.equal(calls.vardag, 1, 'ett gemensamt dagsanrop');
    assert.equal(calls.halsa, 2, 'ett hälsningsanrop per spelare');
    step('dagens liv delas av alla, hälsningarna är personliga');

    // Ett samtal mellan två personer spelas upp med pratbubblor.
    const talk = await zeb.evaluate(async () => {
      const t = state.life.talks[0],
        a = people.get(t.a).obj,
        b = people.get(t.b).obj;
      for (const o of [a, b]) if (!world.objects.includes(o)) world.objects.push(o);
      Object.assign(player, { x: a.x + 2, y: a.y });
      b.x = a.x + 0.8;
      b.y = a.y;
      state.life.played = [];
      const ok = startTalk(a, b),
        said = [];
      for (let i = 0; i < 60 && said.length < 3; i++) {
        talkTick();
        for (const o of [a, b])
          if (
            o.bubbleUntil > performance.now() &&
            !said.includes(o.bubble) &&
            !o.bubble.startsWith('TEST-HEJ') // en hälsning till dig kan komma emellan
          )
            said.push(o.bubble);
        await new Promise((r) => setTimeout(r, 200));
      }
      return { ok, said };
    });
    assert.ok(talk.ok);
    assert.deepEqual(talk.said, ['TEST-SAMTAL 0', 'svar', 'slut']);
    step('personerna pratar med varandra');

    // Prata med Axel: han berättar vad han tänker på idag.
    const hist = await zeb.evaluate(() => {
      chat(characters.find((c) => c.id === 'axel'));
      const h = state.histories.axel.map((x) => x.text);
      close();
      return h;
    });
    assert.ok(hist.includes('TEST-TANKE axel'), 'tanken kommer i samtalet');
    step('samtal med en person');

    // Introduktionen: att börja prata med någon (känd eller okänd) räcker för steget.
    const tut = await arvid.evaluate(() => {
      const before = ['world:outdoor', 'world:w33', 'föreläsning', 'lunch'];
      state.tutorial = [...before];
      chat(characters.find((c) => c.id === 'axel'));
      close();
      const afterKnown = tutorialStep()?.id;
      state.tutorial = [...before];
      strangerChat({ profile: { name: 'Okänd', personality: 'friendly', topic: 'campus' } });
      close();
      const afterStranger = tutorialStep()?.id;
      state.tutorial = null;
      return { afterKnown, afterStranger };
    });
    assert.equal(tut.afterKnown, 'jobb', 'prata med en person klarar steget');
    assert.equal(tut.afterStranger, 'jobb', 'prata med en okänd klarar steget');
    step('introduktionens pratsteg');

    // Sidouppdrag: alla platser går att nå, och ett helt uppdrag går att spela igenom.
    const quests = await arvid.evaluate(() => {
      // Varje plats ska gå att gå till från husets ingång.
      const unreachable = Object.keys(PLATSER).filter((name) => {
        const s = questSpot(name),
          w = s && worlds[s.world];
        return !s || !findPath(w, w.spawn.x, w.spawn.y, s.x, s.y);
      });
      const clickFirst = () => $('dialogActions').querySelector('button').click();
      state.relations.ossi = 10;
      state.quests = null;
      const offer = questOfferFor('ossi')?.id;
      const mark = questMark('ossi');
      acceptQuest(questById('ossis-cykel'));
      const goal = objective().title;
      const markers = () => worlds.outdoor.objects.filter((o) => o.type === 'quest');
      const first = markers().length;
      markers()[0].action();
      clickFirst(); // Fabriikki: en lapp
      markers()[0].action();
      clickFirst(); // Virastotalo: cykeln
      const waiting = questMark('ossi');
      const money = state.money;
      questChatButtons([...characters, ...extra].find((c) => c.id === 'ossi'))[0].run();
      const reward = state.money - money;
      const done = state.quests.done.includes('ossis-cykel');
      close();
      // Kaffeuppdraget går vidare när man köper kaffe i rätt hus.
      acceptQuest(questById('lumberjacks-kaffe'));
      world = worlds.w33;
      drinkCoffee(false);
      const wrongHouse = state.quests.active['lumberjacks-kaffe'].step;
      world = worlds.tech;
      drinkCoffee(false);
      const rightHouse = state.quests.active['lumberjacks-kaffe'].step;
      world = worlds[state.world];
      // Bullarna går bara att köpa torsdag 10–14.
      acceptQuest(questById('korvapuusti'));
      const bun = worlds.outdoor.objects.find((o) => o.quest === 'korvapuusti');
      state.hour = 20;
      const closedLabel = bun.label;
      return {
        unreachable,
        offer,
        mark,
        goal,
        first,
        waiting,
        reward,
        done,
        wrongHouse,
        rightHouse,
        closedLabel,
      };
    });
    assert.deepEqual(quests.unreachable, [], 'alla uppdragsplatser går att gå till');
    assert.equal(quests.offer, 'ossis-cykel');
    assert.equal(quests.mark, '! ', 'utropstecken vid namnet när någon har ett uppdrag');
    assert.ok(quests.goal.includes('Ossis borttappade cykel'), 'uppdraget syns i målrutan');
    assert.equal(quests.first, 1, 'en markering för steget');
    assert.equal(quests.waiting, '? ', 'frågetecken när personen väntar på dig');
    assert.equal(quests.reward, 15, 'belöningen betalas ut');
    assert.ok(quests.done);
    assert.equal(quests.wrongHouse, 0, 'kaffe i fel hus räknas inte');
    assert.equal(quests.rightHouse, 1, 'kaffe i rätt hus räknas');
    assert.ok(quests.closedLabel.includes('tor'), 'stängt utanför tiden');
    step('sidouppdrag');

    // Kaffeautomater i alla hus: varje kopp ger mindre, sent kaffe ger sämre sömn.
    const coffee = await arvid.evaluate(() => {
      const machines = ['w33', 'tech', 'gym'].map((id) =>
        worlds[id].objects.find((o) => o.type === 'coffee'),
      );
      Object.assign(state, { money: 10, hour: 10 });
      state.stats.energy = 40;
      state.coffee = null;
      const gains = [];
      for (let i = 0; i < 4; i++) {
        const before = state.stats.energy;
        machines[0].action();
        gains.push(Math.round(state.stats.energy - before)); // fem minuter kostar lite energi
      }
      const label = machines[1].label;
      state.hour = 21;
      const before = restBonus();
      drinkCoffee(true);
      return {
        found: machines.map((m, i) => {
          const w = worlds[['w33', 'tech', 'gym'][i]];
          // På golvet, och inte där man kommer in genom dörren.
          return !!m && walkable(w, m.x, m.y, 0.1) && Math.hypot(m.x - w.spawn.x, m.y - w.spawn.y) >= 2.5;
        }),
        gains,
        money: state.money,
        label,
        sleepAfter: restBonus() / before,
      };
    });
    assert.deepEqual(coffee.found, [true, true, true], 'en automat i varje hus, på golvet och inte vid dörren');
    assert.deepEqual(coffee.gains, [18, 12, 7, 3], 'varje kopp ger mindre');
    assert.equal(coffee.money, 2, 'fyra koppar à 2 €, hemma gratis');
    assert.ok(coffee.label.includes('ger inget mer'), 'etiketten visar vad nästa kopp ger');
    assert.ok(coffee.sleepAfter < 1, 'sent kaffe ger sämre sömn');
    step('kaffeautomater i alla hus');

    // Mobil: pekskärm och liten skärm.
    const phone = await open('Mobil', {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await phone.evaluate(() => start(fresh('ida')));
    await waitFor(phone, () => active, 'mobilspelet');
    const touchUi = await phone.evaluate(() => document.body.classList.contains('touch'));
    assert.ok(touchUi, 'pekstyrningen visas på mobil');
    step('spelet startar på mobil');

    // Tummen på vänstra sidan blir en styrspak där den landar, ett kort tryck till höger är E.
    const thumbs = await phone.evaluate(async () => {
      close();
      const v = $('view'),
        ev = (type, x, y, id) =>
          v.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              pointerId: id,
              pointerType: 'touch',
              clientX: x,
              clientY: y,
            }),
          );
      ev('pointerdown', 80, 600, 7);
      const stick = $('stick').getBoundingClientRect();
      ev('pointermove', 80, 560, 7);
      const forward = touch.y;
      ev('pointerup', 80, 560, 7);
      const after = touch.y;
      let used = 0;
      const real = interact;
      interact = () => used++;
      near = { label: 'test' };
      ev('pointerdown', 300, 400, 8);
      ev('pointerup', 300, 401, 8);
      interact = real;
      return {
        stickAt: Math.round(stick.left + stick.width / 2),
        forward,
        after,
        used,
      };
    });
    assert.equal(thumbs.stickAt, 80, 'styrspaken flyttar sig till tummen');
    assert.ok(thumbs.forward < -0.5, 'dra uppåt är att gå framåt');
    assert.equal(thumbs.after, 0, 'släpper man stannar man');
    assert.equal(thumbs.used, 1, 'ett kort tryck är som E');
    step('styrspak och tryck på mobil');

    // Går det långsamt sänks upplösningen.
    const scale = await phone.evaluate(() => {
      close(); // mätningen pausar medan en dialogruta är öppen
      QUALITY.since = 0;
      qualityTick(1000);
      for (let i = 1; i <= 20; i++) qualityTick(1000 + i * 105); // cirka 10 bilder per sekund
      return QUALITY.scale;
    });
    assert.ok(scale < 1, 'lägre upplösning när det går långsamt');
    step('upplösningen anpassar sig');

    await sleep(1000);
    assert.deepEqual(errors, [], 'inga fel i webbläsaren');
    step('inga fel i webbläsaren');
    console.log('\nAllt gick bra (' + steps.length + ' steg).');
  } catch (e) {
    failed = true;
    console.error('\nMISSLYCKADES efter "' + (steps[steps.length - 1] || 'start') + '":', e.message);
    if (errors.length) console.error('Fel i webbläsaren:\n' + errors.join('\n'));
  } finally {
    await browser.close();
    game.kill();
    aiServer.close();
    // Servern kan hinna skriva en sista gång medan den stängs.
    await sleep(300);
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {}
  }
  process.exit(failed ? 1 : 0);
})();
