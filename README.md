# Arre simulator 2.0

Ett campusäventyr i 3D som utspelar sig på campus i Vasa.

## Starta spelet

Öppna `index.html` i webbläsaren. Ingen installation eller server behövs.

## Struktur

```
index.html            Sidans HTML och laddar alla skript i rätt ordning
css/style.css         All stil
img/                  Referensbilder och kartbild
js/
  core.js             Hjälpfunktioner
  state.js            Speltillstånd, ljud, sparning, dialogrutor
  data/               Karaktärer, kläder, kursfrågor, bildlista
  graphics/           Figurer, föremål, träd och texturer
  world/build.js      Bygger campus, W33, Technobothnia och gym, dörrar och träd
  world/home.js       Hemmet: möbler, ljus, fönster, spegel och vad man kan göra där
  game/               Spellogik: rörelse och kamera, studier, samtal, jobb, händelser m.m.
  ui/                 Meny, karta, bildvisare
  render/geometry.js  3D-möbler, ljuskarta, dörrar och spegel
  render/render.js    Ritar 3D-vyn och minikartan
  input.js            Tangentbord, mus och touch
  main.js             Bygger världarna och startar spelet (laddas sist)
```

Skripten är vanliga skript som delar samma globala namn. De laddas i ordningen
i `index.html`, så en ny fil ska läggas in där. Kod som körs direkt när filen
laddas (inte inuti en funktion) kan bara använda saker från filer ovanför.
Inuti funktioner går det bra att använda allt.

## Arbetsgång

1. `git pull` innan du börjar.
2. Gör en sak i taget och committa ofta med ett tydligt meddelande.
3. `git pull` igen och sedan `git push` när något fungerar.
4. Större funktioner görs på en egen branch och slås ihop när de är testade.

Redigera filerna här i stället för att generera om hela spelet som en enda fil,
annars försvinner uppdelningen och ändringar krockar igen.
