import type { Job } from './types';

/**
 * Catalogue of DIY jobs and the tools/materials they need. This is reference
 * content, identical for every household, so it lives in the app rather than
 * the database — only your picks and reservations are stored per household.
 */
export const JOBS: Job[] = [
  {
    id: 'j1',
    title: 'Behang verwijderen',
    where: 'Slaapkamer + hal · 34 m²',
    level: 'Makkelijk',
    hours: '1 dag',
    depot: 'Huurpunt Utrecht-Oost',
    depotLine: '2,4 km · open tot 17:30 · gereserveerd gereedschap ligt klaar vanaf 07:00',
    note: 'Oud behang met een stomer los weken gaat drie keer sneller dan schrapen. Dek de vloer af: het wordt nat en plakkerig.',
    mats: [
      { name: 'Behangstomer', mode: 'HUUR', price: '€ 18/dag', src: 'Huurpunt Utrecht-Oost' },
      { name: 'Behangkrabber + brede spatel', mode: 'KOOP', price: '€ 9', src: 'Bouwmarkt · op voorraad' },
      { name: 'Afdekfolie 25 m²', mode: 'KOOP', price: '€ 7', src: 'Bouwmarkt · op voorraad' },
      { name: 'Emmer, spons en handschoenen', mode: 'IN HUIS', price: '—', src: 'Staat in de schuur' },
    ],
  },
  {
    id: 'j2',
    title: 'Plinten verwijderen',
    where: 'Begane grond · 28 m',
    level: 'Makkelijk',
    hours: '3 uur',
    depot: 'Bouwmarkt Cartesiusweg',
    depotLine: '3,1 km · alles op voorraad · vandaag besteld, morgen op te halen',
    note: 'Werk met een breekbeitel achter een stukje hout, dan blijft het stucwerk heel. Hergebruik alleen de plinten die zonder splinters loskomen.',
    mats: [
      { name: 'Breekbeitel + rubberhamer', mode: 'KOOP', price: '€ 21', src: 'Bouwmarkt · op voorraad' },
      { name: 'Multitool met zaagblad', mode: 'HUUR', price: '€ 14/dag', src: 'Huurpunt Utrecht-Oost' },
      { name: 'Nijptang', mode: 'KOOP', price: '€ 12', src: 'Bouwmarkt · op voorraad' },
      { name: 'Bouwstofzuiger', mode: 'HUUR', price: '€ 16/dag', src: 'Huurpunt Utrecht-Oost' },
    ],
  },
  {
    id: 'j3',
    title: 'Vloer schuren',
    where: 'Woonkamer · 41 m²',
    level: 'Pittig',
    hours: '2 dagen',
    depot: 'Vloerverhuur Lage Weide',
    depotLine: '5,6 km · machine incl. stofafzuiging · reserveren minimaal 3 dagen vooruit',
    note: 'Reserveer de bandschuurmachine ruim op tijd — in september zijn ze vaak weg. Randschuurmachine erbij, anders kom je niet langs de plinten.',
    mats: [
      { name: 'Bandschuurmachine', mode: 'HUUR', price: '€ 45/dag', src: 'Vloerverhuur Lage Weide' },
      { name: 'Randschuurmachine', mode: 'HUUR', price: '€ 29/dag', src: 'Vloerverhuur Lage Weide' },
      { name: 'Schuurpapier korrel 40/80/120', mode: 'KOOP', price: '€ 34', src: 'Bij verhuur · afrekenen per gebruikt vel' },
      { name: 'Stofmasker FFP2 + gehoorbescherming', mode: 'KOOP', price: '€ 15', src: 'Bouwmarkt · op voorraad' },
    ],
  },
  {
    id: 'j4',
    title: 'Vloer leggen',
    where: 'Woonkamer · 41 m²',
    level: 'Gemiddeld',
    hours: '1,5 dag',
    depot: 'Houthandel Rijn',
    depotLine: '4,2 km · levert vrijdag tussen 08:00 en 12:00 · gereedschap huren kan erbij',
    note: 'Laat de planken 48 uur in de kamer liggen voor je begint. Leg de eerste rij strak langs de langste muur, niet langs de deur.',
    mats: [
      { name: 'Verstekzaag op onderstel', mode: 'HUUR', price: '€ 28/dag', src: 'Houthandel Rijn' },
      { name: 'Legset (trekijzer, wiggen, slagblok)', mode: 'HUUR', price: '€ 9/dag', src: 'Houthandel Rijn' },
      { name: 'Ondervloer 45 m² incl. tape', mode: 'KOOP', price: '€ 96', src: 'Houthandel Rijn · op voorraad' },
      { name: 'Kniebeschermers', mode: 'KOOP', price: '€ 14', src: 'Bouwmarkt · op voorraad' },
    ],
  },
  {
    id: 'j5',
    title: 'Muren sausen',
    where: 'Hele benedenverdieping',
    level: 'Makkelijk',
    hours: '2 dagen',
    depot: 'Verfhuis Oudenoord',
    depotLine: '1,8 km · mengt je kleur binnen 20 min · lege bussen retour = € 1 per stuk',
    note: 'Eerst de plafonds, dan de wanden. Latex twee lagen; met een verfspuit ben je sneller maar afplakken kost dan meer tijd.',
    mats: [
      { name: 'Muurverf latex 10 L', mode: 'KOOP', price: '€ 62', src: 'Verfhuis Oudenoord' },
      { name: 'Rollerset + telescoopsteel', mode: 'KOOP', price: '€ 16', src: 'Verfhuis Oudenoord' },
      { name: 'Afplaktape + folie', mode: 'KOOP', price: '€ 11', src: 'Bouwmarkt · op voorraad' },
      { name: 'Kamersteiger 2 m', mode: 'HUUR', price: '€ 24/dag', src: 'Huurpunt Utrecht-Oost' },
    ],
  },
];
