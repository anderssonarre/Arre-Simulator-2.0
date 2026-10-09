// Meny, karta och export/import av sparning
'use strict';
function menu() {
  if (!active) return;
  paused = true;
  const p = profile(),
    out = outfits.find((o) => o.id === state.outfit);
  const portrait = npcSprite({ ...p, color: out.color || p.color }).toDataURL();
  dialog(
    'Ditt campusliv',
    '<div class="row"><div><strong>' +
      esc(p.name) +
      '</strong><p class="sub">' +
      esc(out.name) +
      ' · ' +
      state.runs +
      ' arbetspass · ' +
      state.lunches +
      ' luncher</p></div><img src="' +
      portrait +
      '" alt="Din karaktär" style="height:85px"></div><div class="keys">WASD: gå eller kör · pilar: gå och vrid · Shift: spring<br>Klicka i bilden och styr med musen · dra på skärmen på mobil<br>E: interagera · Esc: meny · känslighet och synfält under Kontroller<br>Behov och klocka pausas medan menyer är öppna.</div>',
    [
      {
        label: 'Fortsätt spela',
        primary: true,
        run: () => {
          paused = false;
          if (job?.type === 'challenge') showChallenge();
          else close();
        },
      },
      ...(tutorialStep() ? [{ label: 'Hoppa över introduktionen', run: skipTutorial }] : []),
      { label: 'Veckoschema', run: showWeek },
      { label: 'Studieplan och betyg', run: showCourses },
      { label: 'Färdigheter och ekonomi', run: showProgress },
      { label: 'Framtid: praktik och examensarbete', run: careerOverview },
      { label: 'Campus och vänner', run: showMap },
      { label: 'Sidouppdrag', run: showQuests },
      { label: 'Väskan', run: showBag },
      { label: 'Kontroller', run: showControls },
      { label: 'Spelarnamn: ' + playerName() + ' · byt', run: renameDialog },
      ...(accountsAvailable()
        ? [
            {
              label: account.token
                ? 'Konto: ' + account.name + ' · logga ut'
                : 'Logga in och spara online',
              run: () => (account.token ? logout().then(menu) : accountDialog()),
            },
          ]
        : []),
      ...(net.status === 'online'
        ? [{ label: 'Spelare, lappar och topplistor', run: showPlayers }]
        : []),
      ...(serverInfo ? [{ label: 'Tyck till om spelet', run: feedbackDialog }] : []),
      { label: 'Platsbilder och ritningsunderlag', run: showSources },
      ...(R3.ok || typeof THREE !== 'undefined'
        ? [
            {
              label: 'Grafik: ' + (use3d() ? 'realistisk 3D' : 'klassisk') + ' · byt',
              run: () => {
                setGfx3d(!use3d());
                menu();
              },
            },
          ]
        : []),
      {
        label: 'Kvalitet: ' + (highDetail ? 'hög' : 'mobil') + ' · byt',
        run: () => {
          highDetail = !highDetail;
          resize();
          resize3d();
          menu();
        },
      },
      {
        label: 'Spara nu',
        run: () => {
          toast(save() ? 'Spelet är sparat.' : 'Exportera för att spara en kopia.');
        },
      },
      { label: 'Exportera sparning', run: exportSave },
      { label: 'Importera sparning', run: () => $('importFile').click() },
      {
        label: muted ? 'Slå på ljud' : 'Stäng av ljud',
        run: () => {
          muted = !muted;
          menu();
        },
      },
      ...(job ? [{ label: 'Avbryt extrajobbet', run: confirmAbort }] : []),
      {
        label: 'Börja om',
        run: () =>
          dialog(
            'Börja om?',
            '<p>Exportera din sparning om du vill behålla den. Ett nytt liv startar med din nuvarande karaktär.</p>',
            [
              { label: 'Starta nytt liv', run: () => start(fresh(state.character)) },
              { label: 'Tillbaka till menyn', run: menu },
            ],
          ),
      },
    ],
    'Pausad',
  );
}
function showMap() {
  const society = state.society ? societyHtml() : '';
  const people = [...characters, ...extra].filter((p) => p.id !== state.character);
  dialog(
    'Hitta på campus',
    '<div class="info"><strong>Hemmet:</strong> säng, skrivbord och garderob.<br><strong>W33:</strong> programmering, restaurang och Filicia Castle.<br><strong>Technobothnia:</strong> matematik och konstruktion.<br><strong>WSC:</strong> tidigare träningsbana; planritning saknas.<br><strong>Ute:</strong> extrajobb hos Ossi och vägen hem.<br>På kartan: gul punkt = du · mint = aktivitet · blå = person.</div><h3>Campusfolk</h3>' +
      people
        .map(
          (p) =>
            '<div class="course"><span>' +
            esc(p.name) +
            '<br><small style="color:var(--muted)">' +
            esc(whereIs(p.id)?.text || '') +
            '</small></span><span class="badge">' +
            relationName(relation(p)) +
            '</span></div>',
        )
        .join('') +
      society,
    [{ label: 'Tillbaka till menyn', run: menu }],
    'Campusguide',
  );
}
function downloadState(s) {
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = 'Arre_simulator_2_sparning.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Din sparning har exporterats.');
}
function exportSave() {
  save();
  downloadState(state);
}
function exportSaved() {
  try {
    downloadState(validate(JSON.parse(safeStorage())));
  } catch {
    toast('Sparningen kunde inte exporteras.');
  }
}
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    if (file.size > 200000) throw Error('Sparfilen är för stor.');
    const imported = validate(JSON.parse(await file.text()));
    dialog(
      'Importera ' + characters.find((c) => c.id === imported.character).name + '?',
      '<p>Termin ' +
        imported.term +
        ' · dag ' +
        imported.day +
        ' · ' +
        imported.money +
        ' €. Nuvarande sparning ersätts.</p>',
      [
        { label: 'Importera och fortsätt', primary: true, run: () => start(imported) },
        { label: 'Avbryt', run: () => (active ? menu() : close()) },
      ],
      'Säkerhetskopia',
    );
  } catch (err) {
    toast('Import misslyckades: ' + err.message);
  }
});
$('menuButton').onclick = () => (modal && paused ? close() : menu());
$('bagButton').onclick = () => {
  if (active && !modal) showBag();
};
$('fullButton').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast('Helskärm stöds inte i den här webbläsaren.');
  }
};

function renameDialog() {
  dialog(
    'Spelarnamn',
    '<p>Namnet syns för andra när ni spelar online.</p><label class="field"><span>Namn</span><input id="renameInput" maxlength="20" value="' +
      esc(playerName()) +
      '"></label>',
    [
      {
        label: 'Spara',
        primary: true,
        run: () => {
          state.nickname = cleanNick($('renameInput').value);
          $('nickInput').value = state.nickname;
          save();
          onlineConnect();
          menu();
        },
      },
      { label: 'Avbryt', run: menu },
    ],
    'Inställningar',
  );
  setTimeout(() => $('renameInput')?.select(), 50);
}
