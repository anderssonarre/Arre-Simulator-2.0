// Kurser och frågor per termin
'use strict';
// Question banks are indexed by term and course; answers are shuffled when shown.
const curriculum = [
  [
    [
      'Programmering',
      'Vad betyder en loop?',
      'En instruktion som upprepas',
      'Ett filnamn',
      'En bild',
    ],
    ['Matematik I', 'Vad är x om 4x + 6 = 30?', '6', '4', '8'],
    ['Konstruktion I', 'Vad mäter man i newton?', 'Kraft', 'Längd', 'Temperatur'],
  ],
  [
    [
      'Webbutveckling',
      'Vad beskriver HTML främst?',
      'Sidans struktur',
      'Motorns effekt',
      'Databasens lösenord',
    ],
    ['Diskret matematik', 'Hur många delmängder har {a,b}?', '4', '2', '3'],
    [
      'Maskinritning',
      'Vad visar en snittvy?',
      'Detaljens inre',
      'Bara dess färg',
      'Bara ytans temperatur',
    ],
  ],
  [
    [
      'Databaser',
      'Vad är en primärnyckel?',
      'Ett unikt ID för en rad',
      'En reservkopia',
      'Den första kolumnens färg',
    ],
    ['Statistik', 'Medelvärdet av 2, 4 och 6?', '4', '3', '6'],
    [
      'Hållfasthetslära',
      'Normalspänning beräknas som …',
      'Kraft / area',
      'Kraft × area',
      'Area / längd',
    ],
  ],
  [
    [
      'Objektorienterad design',
      'Vad är inkapsling?',
      'Dölja intern implementation',
      'Kopiera all kod',
      'Ta bort alla klasser',
    ],
    ['Linjär algebra', 'Determinanten av enhetsmatrisen 2×2?', '1', '0', '2'],
    [
      'CAD-modellering',
      'Vad innebär extrudering?',
      'Ge en profil djup',
      'Ändra bara färgen',
      'Radera en skiss',
    ],
  ],
  [
    [
      'Inbyggda system',
      'Vad gör en sensor?',
      'Mäter en fysisk storhet',
      'Förbrukar alla data',
      'Lagrar bara filmer',
    ],
    [
      'Reglerteknik',
      'Vad är återkoppling?',
      'Mäta utgången och korrigera',
      'Ignorera utgången',
      'Alltid öka effekten',
    ],
    [
      'Produktionsplanering',
      'Vad är en flaskhals?',
      'Det steg som begränsar flödet',
      'Den snabbaste stationen',
      'En ledig maskin',
    ],
  ],
  [
    [
      'Backendprojekt',
      'Var hör en hemlig API-nyckel hemma?',
      'På servern',
      'I publik HTML',
      'I ett offentligt repo',
    ],
    [
      'Numeriska metoder',
      'Vad används numeriska metoder till?',
      'Beräkna approximativa lösningar',
      'Byta enheter slumpmässigt',
      'Undvika alla beräkningar',
    ],
    [
      'Energisystem',
      'Verkningsgrad är …',
      'Nyttig energi / tillförd energi',
      'Tillförd / nyttig energi',
      'Energi × tid',
    ],
  ],
  [
    [
      'Automation',
      'Vad gör en PLC?',
      'Styr processer med ett program',
      'Mäter bara vikt',
      'Ritar webbsidor',
    ],
    [
      'Optimering',
      'Vad är målfunktionen?',
      'Det som maximeras eller minimeras',
      'En godtycklig siffra',
      'En grafisk knapp',
    ],
    [
      'Hållbar konstruktion',
      'Vad underlättar återvinning?',
      'Material som kan separeras',
      'Limma ihop allt permanent',
      'Undvika materialmärkning',
    ],
  ],
  [
    [
      'Systemintegration',
      'Vad gör ett API?',
      'Låter system kommunicera',
      'Ersätter all hårdvara',
      'Är en sorts skruv',
    ],
    ['Tillämpad analys', 'Integralen av 2x är …', 'x² + C', '2 + C', 'x + C'],
    [
      'Avancerad konstruktion',
      'Varför använder man säkerhetsfaktor?',
      'För att hantera osäkerheter',
      'För att slippa beräkna',
      'För att göra ritningen snygg',
    ],
  ],
];
