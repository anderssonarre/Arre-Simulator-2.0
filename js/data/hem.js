// HEMADRESSER · innehållsfil
// Var karaktärerna bor. Karaktärer som inte står här bor i det påhittade huset i västra
// kanten av campus. dörr är var ytterdörren sitter på campuskartan (rutor), kontrollerat mot
// Google Maps och ingångarna i OpenStreetMap.
//   värld   kartan dörren sitter på ('outdoor' = campus, 'bron' = kartan över Brändöbron)
//   hiss    { våning, våningar }: man kommer in i ett trapphus och måste ta hissen upp
const HEMADRESSER = {
  zeb: {
    adress: 'Fabriksgatan 3 C',
    postnummer: '65200 Vasa',
    våning: 'första våningen',
    dörr: { x: 170.8, y: 81.9 },
  },
  arvid: {
    adress: 'Kyrkoesplanaden 6 / Museigatan 8',
    postnummer: '65100 Vasa',
    våning: 'sjunde våningen',
    värld: 'bron', // hörnhuset ligger på kartan mellan bron och centrum
    dörr: { x: 219.4, y: 379 },
    hiss: { våning: 7, våningar: 8 },
  },
};
