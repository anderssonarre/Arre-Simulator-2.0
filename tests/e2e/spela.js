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
      ARRE_TEST: '1',
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
      for (let i = 0; i < 100 && said.length < t.lines.length; i++) {
        talkTick();
        // Bara samtalets egna repliker: en hälsning till dig kan komma emellan.
        for (const o of [a, b])
          if (o.bubbleUntil > performance.now() && t.lines.includes(o.bubble) && !said.includes(o.bubble))
            said.push(o.bubble);
        // Ingen hälsning får skriva över en replik innan den hunnit synas.
        for (const o of [a, b]) o.greetedAt = state.day * 24 + state.hour;
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

    // AI-skrivna uppdrag: samma för alla, kontrollerade, och de man tagit finns kvar.
    for (const p of [zeb, arvid]) await waitFor(p, () => QUESTS.some((q) => q.ai), 'dagens AI-uppdrag');
    const aiq = await arvid.evaluate(() => {
      const list = QUESTS.filter((q) => q.ai);
      state.quests = null;
      const q = list[0];
      acceptQuest(q);
      const kept = !!state.quests.custom[q.id];
      // Uppdraget finns kvar även om dagens lista byts ut.
      QUESTS.splice(QUESTS.indexOf(q), 1);
      ensureQuests();
      const stillActive = !!state.quests.active[q.id];
      worlds.outdoor.objects.find((o) => o.quest === q.id).action();
      $('dialogActions').querySelector('button').click();
      const money = state.money;
      questChatButtons(characters.find((c) => c.id === 'ida') || extra.find((c) => c.id === 'ida'))[0].run();
      close();
      return {
        n: list.length,
        titel: q.titel,
        kept,
        stillActive,
        done: state.quests.done.includes(q.id),
        reward: state.money - money,
      };
    });
    const zebAi = await zeb.evaluate(() => QUESTS.filter((q) => q.ai).map((q) => q.titel));
    assert.equal(aiq.n, 1, 'det ogiltiga uppdraget togs bort');
    assert.deepEqual(zebAi, [aiq.titel], 'samma AI-uppdrag för alla');
    assert.ok(aiq.kept && aiq.stillActive, 'ett taget AI-uppdrag finns kvar');
    assert.ok(aiq.done, 'AI-uppdraget går att klara');
    assert.equal(aiq.reward, 7);
    const aiCalls = await (await fetch('http://localhost:' + AI_PORT + '/calls')).json();
    assert.equal(aiCalls.uppdrag, 1, 'ett anrop per dag för alla');
    step('AI-skrivna uppdrag');

    // Campustidningen: händelser blir ett nummer som alla kan läsa.
    await zeb.evaluate(() => reportHappening('femma', { kurs: 'Matematik', betyg: '5' }));
    await arvid.evaluate(() => reportHappening('van', { person: 'Axel' }));
    // En påhittad händelsetyp tas inte emot.
    const bad = await fetch('http://localhost:' + PORT + '/api/happening', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'hack', namn: 'x', text: 'fritext' }),
    });
    assert.equal(bad.status, 400, 'okänd händelse avvisas');
    await sleep(400);
    const issue = await zeb.evaluate(async () => (await fetchPaper(true))?.issue);
    assert.equal(issue?.rubrik, 'TEST-RUBRIK', 'numret skrivs av AI: ' + JSON.stringify(issue));
    assert.ok(issue.artiklar[0].text.includes('Zeb fick en femma i Matematik'));
    assert.ok(issue.artiklar[0].text.includes('Arvid och Axel är numera vänner'));
    assert.ok(!issue.artiklar[0].text.includes('fritext'), 'okända händelser kommer inte med');
    const again = await arvid.evaluate(async () => (await fetchPaper(true))?.issue);
    assert.deepEqual(again, issue, 'samma nummer för alla');
    const stand = await zeb.evaluate(() => worlds.w33.objects.some((o) => o.type === 'paper'));
    assert.ok(stand, 'tidningsställ i W33');
    step('campustidningen');

    // Personligheter: samma för alla online, olika mellan personer, och de styr vad folk gör.
    const traitsOf2 = (p) =>
      p.evaluate(() => Object.fromEntries([...characters, ...extra].map((c) => [c.id, traitsOf(c.id)])));
    const [tz, ta] = [await traitsOf2(zeb), await traitsOf2(arvid)];
    assert.deepEqual(tz, ta, 'samma personligheter för alla online');
    const traits = await arvid.evaluate(() => {
      const all = [...characters, ...extra];
      const pairs = all.map((c) => traitsOf(c.id));
      const clash = pairs.some(([a, b]) => DRAG[a].motsats === b || DRAG[b].motsats === a);
      const distinct = new Set(pairs.flat()).size;
      // Dragens rutiner syns i schemat en vanlig måndag.
      let followed = 0;
      for (const c of all)
        for (let h = 7; h < 23; h += 0.5) {
          const own = traitPlan(c.id, 1, h);
          if (!own || [0, 1, 2].some((i) => lectureNow(i, 1, h))) continue;
          const plan = planFor(c.id, 1, h);
          if (plan.where === own.where && plan.activity == own.activity) followed++;
        }
      // Man upptäcker dragen när man pratar.
      const p = all.find((c) => c.id === 'rasmus');
      state.histories.rasmus = [];
      state.relations.rasmus = 0;
      const before = revealedTraits(p).length;
      chat(p);
      close();
      const after = revealedTraits(p).length;
      state.relations.rasmus = 20;
      const friends = revealedTraits(p).length;
      return { twoEach: pairs.every((x) => x.length === 2), clash, distinct, followed, before, after, friends, seed: serverInfo.seed };
    });
    assert.ok(traits.twoEach, 'två drag per person');
    assert.equal(traits.clash, false, 'inga motsatta drag hos samma person');
    assert.ok(traits.distinct >= 6, 'många olika drag på campus');
    assert.ok(traits.followed > 0, 'dragen styr schemat');
    assert.deepEqual([traits.before, traits.after, traits.friends], [0, 1, 2], 'dragen upptäcks steg för steg');
    assert.ok(Number.isFinite(traits.seed), 'servern delar ett slumpfrö');
    step('personligheter');

    // Väskan, butikerna och tillstånden.
    const bag = await arvid.evaluate(() => {
      close();
      const shops = worlds.w33.objects.filter((o) => o.type === 'shop');
      const reachable = shops.every((s) => findPath(worlds.w33, 37.5, 27.5, s.x, s.y));
      state.money = 60;
      state.bag = {};
      state.cond = null;
      const hour = state.hour;
      state.hour = 20;
      const kioskOpen = shopOpen(BUTIKER.kiosk),
        barOpen = shopOpen(BUTIKER.bar);
      for (let i = 0; i < 4; i++) buy('bar', 'öl');
      buy('bar', 'vatten');
      close();
      const inBag = bagCount();
      for (let i = 0; i < 3; i++) useItem('öl');
      const drunk = { level: condLevel('berusning')?.namn, problem: focusProblem(), sway: drunkSway(0.1) !== 0 || true };
      startJob();
      const jobStarted = !!job;
      const before = cond('berusning');
      useItem('vatten');
      const water = before - cond('berusning');
      // Bjud Axel på öl: ni blir närmare vänner.
      const axel = characters.find((c) => c.id === 'axel');
      const relBefore = state.relations.axel || 0;
      const canTreat = treatButtons(axel).length === 1;
      treat(axel, 'öl');
      close();
      const treated = (state.relations.axel || 0) > relBefore;
      // Tio timmar senare: ruset har gått över och bakfyllan kommer.
      condClock = state.day * 1440 + state.hour * 60 - 600;
      conditionsTick();
      const hangover = { berusning: cond('berusning'), illamående: cond('illamående') };
      const moneyBefore = state.money;
      lunch();
      const lunchBlocked = state.money === moneyBefore;
      // Fokuserad ger ett högre betyg.
      state.cond = null;
      const normal = examGrade(0, 3, 3);
      changeCond({ koncentration: 30 });
      const focused = examGrade(0, 3, 3);
      state.cond = null;
      state.hour = hour;
      return {
        shops: shops.length,
        reachable,
        kioskOpen,
        barOpen,
        inBag,
        drunk,
        jobStarted,
        water,
        canTreat,
        treated,
        hangover,
        lunchBlocked,
        normal,
        focused,
      };
    });
    assert.equal(bag.shops, 2, 'kiosk och bar i W33');
    assert.ok(bag.reachable, 'butikerna går att gå till');
    assert.equal(bag.kioskOpen, false, 'kiosken är stängd på kvällen');
    assert.equal(bag.barOpen, true, 'baren är öppen på kvällen');
    assert.equal(bag.inBag, 5, 'fyra öl och ett vatten i väskan');
    assert.equal(bag.drunk.level, 'Full', 'tre öl gör en full');
    assert.equal(bag.drunk.problem, 'full', 'full kan man inte plugga');
    assert.equal(bag.jobStarted, false, 'full kan man inte jobba');
    assert.ok(bag.water > 0, 'vatten minskar ruset');
    assert.ok(bag.canTreat && bag.treated, 'bjuda en kompis ger bättre relation');
    assert.equal(bag.hangover.berusning, 0, 'ruset går över med tiden');
    assert.ok(bag.hangover.illamående >= 35, 'bakfylla efter en blöt kväll');
    assert.ok(bag.lunchBlocked, 'ingen lunch när man mår illa');
    assert.equal(bag.focused, bag.normal + 1, 'fokuserad ger ett betyg högre');
    step('väska, butiker och tillstånd');

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

    // Statistiken som JSON, för speltestaren.
    const st = await (await fetch('http://localhost:' + PORT + '/stats.json')).json();
    assert.ok(Array.isArray(st.mått) && st.mått.length >= 5, 'stats.json har balansmåtten');
    assert.ok(st.tidning?.rubrik, 'stats.json visar senaste tidningen');
    step('statistik för speltestaren');

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
