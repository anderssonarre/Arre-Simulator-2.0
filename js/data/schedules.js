// SCHEMAN · innehållsfil
// Vem som går på vilka föreläsningar, och vad var och en gör resten av dagen.
// Platser: 'w33', 'tech' (Technobothnia), 'gym', 'outdoor' (ute på campus) och 'hemma'.
// Aktiviteter: 'pluggar', 'lunch', 'tränar', 'fest', 'jobbar', 'paus', 'promenerar', 'föreläsning'.
const PEOPLE_SCHEDULE = {
  // Kurskamrater i terminens tre kurser (0 = W33, 1 och 2 = Technobothnia).
  kurs: [
    ['arvid', 'jennifer', 'ida', 'hannes', 'abbe'],
    ['zeb', 'rasmus', 'philip', 'frassin'],
    ['vilhelm', 'axel', 'otto', 'lumberjack', 'albin'],
  ],
  // Lärare som håller föreläsningarna i respektive kurs.
  lärare: ['niklas', 'mats', 'tobias'],
  // Går på fest på Filicia fredag och lördag kväll.
  festfolk: ['axel', 'otto', 'jennifer', 'lumberjack', 'frassin', 'abbe', 'ida'],
  // Egna rutiner som går före det vanliga dagsschemat.
  // Varje rad: [dagar, från, till, plats, aktivitet]. Dagar: 'vardag', 'helg' eller t.ex. 'mån'.
  egna: {
    // Jennifer jobbar på Wärtsilä i Vasklot på vardagsmornarna.
    jennifer: [['vardag', 7.5, 11.5, 'vasklot', 'jobbar']],
    albin: [
      ['vardag', 16, 18.5, 'gym', 'tränar'],
      ['helg', 11, 13, 'gym', 'tränar'],
    ],
    rasmus: [['vardag', 16, 19, 'tech', 'pluggar']],
    ossi: [['vardag', 8, 17, 'outdoor', 'jobbar']],
    frassin: [['helg', 12, 16, 'outdoor', 'promenerar']],
    lumberjack: [
      ['vardag', 7.5, 9, 'w33', 'paus'],
      ['helg', 13, 15, 'outdoor', 'promenerar'],
    ],
    philip: [
      ['vardag', 14, 16, 'outdoor', 'paus'],
      ['helg', 11, 13, 'outdoor', 'promenerar'],
    ],
    hannes: [['vardag', 16, 17, 'outdoor', 'promenerar']],
    zeb: [['tis', 16, 18, 'gym', 'tränar']],
    vilhelm: [['vardag', 16, 18, 'tech', 'pluggar']],
  },
  // Vanliga tider för alla studerande på vardagar.
  dag: { start: 8, lunchFrån: 11.5, lunchTill: 12.5, slut: 16 },
  // Fest på Filicia: fredag och lördag mellan dessa klockslag (efter midnatt räknas till dagen innan).
  fest: { från: 20, till: 25 },
};
