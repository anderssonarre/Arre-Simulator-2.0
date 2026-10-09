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

Hem och extrajobb är privata. Online följer alla serverns klocka (en sekund är en
spelminut), så veckodag och tid är samma för alla. Sömn ger energi men spolar inte fram
tiden när man är online.

Natten (23–07) går sex gånger fortare för alla. Fredagar 20–22 finsk tid blir det fest på
Filicia Castle för alla som är online.

### AI-samtal (valfritt)

Sätt miljövariabeln `ANTHROPIC_API_KEY` på servern (Render: Environment) så svarar personerna
med Claude Haiku och minns vad ni pratat om. Nyckeln finns bara på servern. Taket styrs med
`AI_DAILY_LIMIT` (samtal per dygn, standard 1500) och `AI_HOURLY_LIMIT` (per spelare och timme,
standard 60). Taket räknas per konto, eller per webbläsare för den som inte är inloggad, så att
alla på samma skolnät inte delar på det. Per IP-adress gäller ett lösare tak (`AI_IP_FACTOR`
gånger större, standard 8). Utan nyckel, eller när taket är nått, används de färdiga replikerna.

### Levande vardag

En gång per speldag får personerna något att tänka på, egna sätt att hälsa på dig, och vänner
som ses får något att prata om (`js/game/life.js`). Med `ANTHROPIC_API_KEY` skriver Haiku
tankarna och samtalen i ett enda anrop per speldag för hela servern (`/api/day`), så alla som
spelar online hör samma samtal, och samtalen kan handla om er som spelar. Hur personerna hälsar
på just dig skrivs i ett eget, mindre anrop per spelare (`/api/greet`), utifrån vad de tycker om
dig och minns. Utan nyckel används raderna `tanke`, `samtal` och `ropar` i
`js/data/dialogue.js`. Personerna vinkar, gestikulerar när de pratar och hänger med huvudet när
de är nere.

### Campustidningen och AI-uppdrag

Spelet berättar för servern vad som händer (femmor, nya vänner, klarade uppdrag, sitz, den som
däckade ...) som korta strukturerade händelser, aldrig fritext. Varje måndag ges ett nummer
om förra veckan ut (`server/paper.js`), skrivet av Haiku i ett anrop, annars som rubriker.
Det läses vid tidningsstället i W33 eller i menyn.

En gång per dygn skriver Haiku några nya sidouppdrag i samma format som
`js/data/quests.js`, utifrån personernas drag och platserna på campus (`server/quests.js`).
De är samma för alla, servern och spelet kontrollerar dem mot de personer, platser och
handlingar som finns, och belöningarna har tak. Ett uppdrag man har tagit sparas i
sparningen och finns kvar när nästa dags uppdrag kommer.

### Statistik och "Tyck till"

Spelet skickar anonyma siffror till servern (sessionslängd, tentaresultat, skuld per vecka och hur
långt nya spelare kommer under första dagen). De visas på `/stats` jämfört med balansmålen. Svaren
från "Tyck till" i menyn visas också där. Sätt `STATS_KEY` för att kräva `/stats?key=...` för svaren.

### Tester

`node --test tests/*.test.js` kör de snabba testerna. GitHub kör dem också vid varje push,
tillsammans med ett webbläsartest (`tests/e2e/spela.js`) som startar servern med en låtsas-Claude
och spelar i två webbläsare och en mobil samtidigt. Lokalt:
`cd tests/e2e && npm install && npx playwright install chromium && node spela.js`.

Render bygger inte om av sig självt när repot ägs av någon annan. Efter en push:
Manual Deploy → Deploy latest commit.

### Konton och sparning på servern

När spelet körs från servern kan man logga in på startskärmen. Då sparas spelet även på
servern och kan fortsättas från andra datorer. Utan inloggning sparas allt i webbläsaren.

- Lokalt och med Docker sparas konton i en fil (`DATA_DIR`, standard `server/data`).
- På Render försvinner filer vid omstart. Sätt därför miljövariabeln `DATABASE_URL` till en
  Postgres-databas, så skapar servern tabellerna själv.

## Sparfilen

Sparningen har en version (`js/shared/savefile.js`). När något i sparfilen ändras höjer man
versionen och skriver ett uppgraderingssteg, så att gamla sparningar alltid går att fortsätta.
Instruktionerna står överst i filen. Det som inte finns längre, t.ex. en borttagen person eller
ett klädesplagg, lagas i stället för att hela sparningen kastas, och en kopia av den gamla
sparningen sparas först i webbläsaren. Servern tar inte emot en sparning från en äldre version
än den den redan har, så en gammal flik kan inte skriva över ett nyare spel.

## Skriva innehåll utan kod

De här filerna är rena innehållsfiler som vem som helst kan redigera:

- `js/data/events.js`: händelser med val och effekter. Berättaren väljer bland dem efter läget
  (taggar som `chans`, `kris` och `följd`), och `följs` gör kedjor där något händer några dagar senare.
- `js/data/dialogue.js`: allt personerna säger.
- `js/data/schedules.js`: vem som går på vilka föreläsningar och vad alla gör på dagarna.
- `js/data/curriculum.js`: kurser och tentafrågor.
- `js/data/society.js`: vem som är vän med vem från början, och skvallret folk sprider om dig.
- `js/data/furniture.js`: möbler att köpa och lägenheter att flytta till.
- `js/data/career.js`: praktikplatser, examensarbete och vad man kan bli.
- `js/data/quests.js`: sidouppdrag som personerna ger dig (inte skolan), med platser på campus,
  steg och belöningar. Instruktionerna står överst.
- `js/data/items.js`: varor i väskan, kiosken och baren, och tillstånden (berusning, illamående,
  koncentration) med gränser och hur fort de avtar.
- `js/data/traits.js`: personlighetsdrag (nattuggla, festprisse, grinig ...) som personerna får
  slumpat två av, med egna rutiner, humör, repliker och hur fort man blir vän.
- `js/data/jobs.js`: extrajobben på jobbtavlan, med lön, energi, arbetstider, krav,
  intervjufrågor och vad man gör under passet.
- `js/data/weather.js`: vädret. Vädertyper (sol, halvklart, mulet, dimma, duggregn, regn och
  åska, som blir snö när det är kallt), hur vanliga de är varje månad, temperaturen i Vasa och
  hur fort man blir blöt. Dygnet har fyra perioder som skiftar mjukt, och alla online har samma väder.
- `js/data/play.js`: spela tillsammans. Gesterna (G), snöbollar (F på vintern), kubb på
  sommaren och pubquizen på Filicia på fredagar.
- `js/data/centrum-platser.js`: Vasa centrum. Bussen dit, butikerna (torgkiosken,
  Hesburger, Saluhallen, puben), Oliver's Inn ("Ollis") med öppettider och billig öl på
  tisdagar, ställena att göra saker på (bio, teater, buffé, fik, bokhandel, spelbutik, loppis,
  kyrkan) och platserna för sidouppdrag.
- `js/data/bilar.js`: bilarna hos bilhandlaren i centrum (pris, toppfart, acceleration, färg)
  och billånet (handpenning, ränta, antal veckor).
- `js/game/traffic.js`: bilarna på gatorna (antal, fart och färger överst i filen). Själva kartan byggs från
  OpenStreetMap med `tools/centrum/bygg_karta.py`.
- `js/data/evenemang.js`: årets evenemang (nollning, halloween, fackeltåg, lucia, lillajul,
  Runebergsdagen, midsommar) med datum, tider, platser och val. Bastun på WSC och pulkabacken.
- `js/data/progress.js`: färdigheter, vilken färdighet varje kurs hör till, erfarenhet,
  hyra och studiestöd.

Instruktionerna står överst i varje fil. Skriver man fel visar webbläsarens konsol en varning.

## Mobil

På pekskärm visas ett kompakt läge. Vänster tumme styr (styrspaken hamnar där tummen landar),
höger tumme vrider blicken, och ett kort tryck i bilden gör samma sak som E. Bildkvaliteten
anpassar sig efter enheten (`js/render/quality.js`): går det långsammare än cirka 26 bilder per
sekund sänks upplösningen, och i 3D stängs skuggorna av.

## Grafik

Spelet ritas i riktig 3D med three.js (`js/render3d/render3d.js`, biblioteket ligger i
`js/vendor/`): solen ger skuggor efter tid på dygnet, himlen och dimman ändrar färg, gatlampor och
fönster lyser på kvällen och spegeln hemma speglar på riktigt. Datorer utan grafikkort, och den som
väljer det i menyn, får den klassiska motorn (`js/render/render.js`). `?gfx=3d` eller `?gfx=classic`
i adressen tvingar fram den ena eller den andra.

## Utomhuskartan

Campus utomhus (W33, Technobothnia, Fabriikki, Myndigheten, WSC och gatorna runt) är
byggd i verklig skala från OpenStreetMap. Kartdata © OpenStreetMaps bidragsgivare,
licens ODbL (https://www.openstreetmap.org/copyright).

- `tools/campus/osm-utdrag.json` är utdraget, vridet så att Wolffskavägen går nord–syd.
- `tools/campus/bygg_karta.py` gör om det till `js/data/campus.js` (kör `python3 tools/campus/bygg_karta.py`).
  Där bestäms också vilka hus som får vilken fasad och höjd.
- `js/world/campus.js` bygger världen av datan: dörrar, skyltar, lampor och träd.
- `js/render/segments.js` ritar väggar i valfri vinkel och fasaderna.

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
  world/campus.js     Utomhuskartan från OpenStreetMap
  world/home.js       Hemmet: möbler, ljus, fönster, spegel och vad man kan göra där
  game/               Spellogik: kalender, personernas scheman (people.js), rörelse,
                      studier, samtal, jobb, händelser m.m.
  ui/                 Meny, karta, bildvisare
  render/geometry.js  3D-möbler, ljuskarta, dörrar och spegel
  render/segments.js  Sneda väggar och fasader utomhus
  render/render.js    Ritar 3D-vyn och minikartan
  game/life.js        Levande vardag: dagens tankar, hälsningar och samtal
  shared/savefile.js  Sparfilens version och uppgradering
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
