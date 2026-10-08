// Bildvisare och info om campusmodellen
'use strict';
function showPhotos(index = 1) {
  index = (index + referencePhotos.length) % referencePhotos.length;
  const labels = [
    'W33 · sidogatan',
    'W33 · entré och trapphus',
    'W33 · fasaden mot Wolffskavägen',
    'Wolffskavägen · övergångsställe',
    'Grönområdet vid korsningen',
    'Wolffskavägen',
    'Technobothnia · tegel och sågtak',
    'Infarten vid Puuvillakuja',
    'Fabriksområdet och skorstenarna',
    'Campus · byggnader och tak ovanifrån',
  ];
  dialog(
    labels[index],
    '<img alt="' +
      labels[index] +
      '" src="' +
      referencePhotos[index].src +
      '" style="display:block;max-height:57dvh;max-width:100%;margin:auto;border-radius:12px"><p class="sub">Din referensbild ' +
      (index + 1) +
      ' / ' +
      referencePhotos.length +
      ' · ' +
      referencePhotos[index].name +
      ' · kartvyn är kvar i originalbilden.</p>',
    [
      { label: '← Föregående', run: () => showPhotos(index - 1) },
      { label: 'Nästa →', run: () => showPhotos(index + 1) },
      { label: 'Tillbaka till spelet', primary: true, run: close },
    ],
    'Platsbilder',
  );
}
function showSources() {
  dialog(
    'Om campusmodellen',
    '<p>Fasader, gatumiljö och vegetation bygger på dina platsbilder och den nya flygbilden. Originalbilderna finns här i spelet.</p><div class="info"><b>W33:</b> L-formad plan efter figur 33 i Novias EPS-rapport 2023, kompletterad med befintlig restaurangplan från 2017 (inte ombyggnadsförslaget).<br><b>Technobothnia:</b> labbblock, tvärgång och norra flygeln efter VAMK:s besöksplan från 2014.<br><b>Wasa Sports Club:</b> placeringen följer kartbilden. Den tidigare träningsbanan är kvar; invändig ritning saknas.</div><p><b>Texturpaket:</b> Campus Vasa HD – egna inbyggda material för tegel, puts, asfalt, gräs och golv. Inga externa nedladdningar krävs.</p><p>Det här är en förenklad spelmodell av historiska underlag. Avstånd och väggar är anpassade till spelets rutnät. Kurser, personer och aktiviteter är spelinnehåll; modellen är inte en aktuell orienterings- eller utrymningskarta.</p><p><a style="color:var(--mint)" target="_blank" rel="noopener" href="https://www.novia.fi/assets/Projectsites/EPS/projects/EPS-2023/Spring-2023-Sustainable-Development-Goals.pdf">W33 · EPS 2023, figur 33</a><br><a style="color:var(--mint)" target="_blank" rel="noopener" href="https://www.novia.fi/assets/Projectsites/EPS/projects/EPS-2017/W33.pdf">W33 · EPS 2017, bilaga VII</a><br><a style="color:var(--mint)" target="_blank" rel="noopener" href="https://www.vamk.fi/old/fi/news/liite_lukiopaiva2014.pdf">Technobothnia · VAMK 2014, sida 2</a></p>',
    [
      { label: 'Se dina tio referensbilder', primary: true, run: () => showPhotos() },
      { label: 'Tillbaka', run: menu },
    ],
    'Underlag',
  );
}
