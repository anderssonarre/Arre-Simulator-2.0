# Arre simulator 2.0

Ett campusäventyr i 3D som utspelar sig på campus i Vasa.

## Starta spelet

Ensam: öppna `index.html` i webbläsaren. Ingen installation behövs.

Online med andra (multiplayer): starta servern, som också serverar själva spelet.

```
cd server
npm install
npm start
```

Öppna sedan http://localhost:8080. Alla som öppnar samma adress ser varandra och kan
chatta (Enter eller T). Porten ändras med miljövariabeln `PORT`.

Med Docker: `docker build -t arre-simulator .` och `docker run -p 8080:8080 arre-simulator`.

### Lägga ut servern på Render (gratis)

Repot har en `render.yaml`. På render.com: New → Blueprint, välj repot och branchen,
och tryck Deploy. Adressen du får (t.ex. `https://arre-simulator.onrender.com`) är den
alla spelar på. Gratisnivån somnar efter en kvart utan spelare och tar ungefär en minut
att vakna när någon öppnar sidan igen.

Hem och extrajobb är privata.

### Konton och sparning på servern

När spelet körs från servern kan man logga in på startskärmen. Då sparas spelet även på
servern och kan fortsättas från andra datorer. Utan inloggning sparas allt i webbläsaren.

- Lokalt och med Docker sparas konton i en fil (`DATA_DIR`, standard `server/data`).
- På Render försvinner filer vid omstart. Sätt därför miljövariabeln `DATABASE_URL` till en
  Postgres-databas, så skapar servern tabellerna själv.

## Skriva innehåll utan kod

Tre filer är rena innehållsfiler som vem som helst kan redigera:

- `js/data/events.js`: händelser som dyker upp på morgonen, med val och effekter.
- `js/data/dialogue.js`: allt personerna säger.
- `js/data/schedules.js`: vem som går på vilka föreläsningar och vad alla gör på dagarna.
- `js/data/curriculum.js`: kurser och tentafrågor.

Instruktionerna står överst i varje fil. Skriver man fel visar webbläsarens konsol en varning.

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
  game/               Spellogik: kalender, personernas scheman (people.js), rörelse,
                      studier, samtal, jobb, händelser m.m.
  ui/                 Meny, karta, bildvisare
  render/geometry.js  3D-möbler, ljuskarta, dörrar och spegel
  render/render.js    Ritar 3D-vyn och minikartan
  input.js            Tangentbord, mus och touch
  net/online.js       Anslutning till servern, andra spelare och chatt
  net/account.js      Spelarnamn, inloggning och sparning på servern
  main.js             Bygger världarna och startar spelet (laddas sist)
server/server.js      Multiplayerservern (Node + WebSocket) och konton
server/store.js       Lagring av konton och sparningar (fil eller Postgres)
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
