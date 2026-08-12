import type { CatKey } from './theme';
import type { Job, Party, PartyKind, Task, Who } from './types';
import { addDays } from './lib/dates';

/**
 * Starter plan. Dates are stored as an offset in days from the moving day, so the
 * whole plan slides to whatever moving date a household picks during onboarding.
 */
interface SeedTask {
  off: number;
  title: string;
  cat: CatKey;
  who: Who;
  time?: string;
  note?: string;
  amount?: number;
  vendor?: string;
  job?: string;
  /** slug into SEED_PARTIES — who actually carries this out */
  party?: string;
}

/** The third parties a typical Dutch move involves, matched to the starter plan. */
export const SEED_PARTIES: {
  slug: string;
  name: string;
  kind: PartyKind;
  phone?: string;
  note?: string;
}[] = [
  { slug: 'bakker', name: 'Bouwbedrijf Bakker', kind: 'aannemer', phone: '06 24 11 89 02', note: 'Ivo Bakker · verbouwing badkamer, stucwerk en oplevering.' },
  { slug: 'vandijk', name: 'Van Dijk Elektro', kind: 'installateur', note: 'Groepenkast naar 8 groepen + 2 aardlekken.' },
  { slug: 'keuken', name: 'Keukenstudio Zeist', kind: 'leverancier', note: 'Ontwerp, levering en montage van de keuken.' },
  { slug: 'devries', name: 'De Vries Verhuizingen', kind: 'verhuizer', note: '3 man + bakwagen. Parkeervergunning aangevraagd.' },
  { slug: 'rijn', name: 'Houthandel Rijn', kind: 'leverancier', note: 'Eiken vloerdelen, ondervloer en gereedschapsverhuur.' },
  { slug: 'huurpunt', name: 'Huurpunt Utrecht-Oost', kind: 'verhuur', note: 'Gereedschapsverhuur · 2,4 km · open tot 17:30.' },
  { slug: 'lageweide', name: 'Vloerverhuur Lage Weide', kind: 'verhuur', note: 'Schuurmachines incl. stofafzuiging. Ruim vooruit reserveren.' },
  { slug: 'verfhuis', name: 'Verfhuis Oudenoord', kind: 'leverancier', note: 'Mengt je kleur binnen 20 min. Lege bussen retour = € 1.' },
  { slug: 'notaris', name: 'Notaris', kind: 'dienst', note: 'Sleuteloverdracht en akte.' },
];

export const SEED_TASKS: SeedTask[] = [
  { off: -33, title: 'Huur opzeggen bij verhuurder', cat: 'admin', who: 'a', note: 'Opzegtermijn 1 maand, bevestiging binnen.' },
  { off: -32, title: 'Meterstanden doorgeven oude woning', cat: 'admin', who: 'b', note: 'Foto van de meterkast in de gedeelde map.' },
  { off: -31, title: 'Verzekering nieuwe woning afsluiten', cat: 'admin', who: 'a', note: 'Opstal + inboedel. Offerte ligt al klaar in de mail.' },
  { off: -31, title: 'Bellen met hypotheekadviseur', cat: 'afspraak', who: 'a', time: '16:00', note: 'Laatste check op de verbouwingsdepot-aanvraag.' },
  { off: -30, title: 'Offertes verhuisbedrijven vergelijken', cat: 'admin', who: 'a', note: 'Drie offertes binnen: De Vries, Mondiaal, Klaassen.' },
  { off: -29, title: 'Aannemer komt opmeten', cat: 'afspraak', who: 'samen', time: '09:00', note: 'Ivo Bakker · 06 24 11 89 02. Neem de bouwtekening mee.', party: 'bakker' },
  { off: -28, title: 'Vloer uitzoeken bij Houthandel Rijn', cat: 'klus', who: 'samen', note: 'Eiken rustiek, geolied. Monsters meenemen naar de woning.', party: 'rijn' },
  { off: -26, title: 'Aanbetaling aannemer 30%', cat: 'betaling', who: 'a', amount: 4200, vendor: 'Bouwbedrijf Bakker', note: 'Factuur 2026-118. Betalen vóór start werkzaamheden.', party: 'bakker' },
  { off: -23, title: 'Internet & tv laten verhuizen', cat: 'admin', who: 'a', note: 'Minimaal 3 weken van tevoren melden, anders geen internet op dag 1.' },
  { off: -22, title: 'Keukenontwerp bespreken', cat: 'afspraak', who: 'samen', time: '13:30', note: 'Showroom Zeist. Maten van de nieuwe muur meenemen.', party: 'keuken' },
  { off: -19, title: 'Verhuisdozen bestellen (30 stuks)', cat: 'inpakken', who: 'b', note: 'Inclusief tape, stickers en 2 rollen noppenfolie.' },
  { off: -17, title: 'Adreswijziging gemeente doorgeven', cat: 'admin', who: 'samen', note: 'Kan pas ná de sleuteloverdracht definitief worden gemaakt.' },
  { off: -15, title: 'Zolder uitzoeken en wegbrengen', cat: 'inpakken', who: 'samen', note: 'Aanhanger geleend van Mark, milieustraat sluit om 16:00.' },
  { off: -14, title: 'Behang verwijderen slaapkamer + hal', cat: 'klus', who: 'samen', job: 'j1', note: 'Vóór de stukadoor komt. Reken op een lange zaterdag.', party: 'huurpunt' },
  { off: -13, title: 'Plinten verwijderen begane grond', cat: 'klus', who: 'a', job: 'j2', note: 'Voorzichtig: de plinten in de woonkamer willen we hergebruiken.', party: 'huurpunt' },
  { off: -11, title: 'Start verbouwing: badkamer', cat: 'klus', who: 'samen', time: '08:00', note: 'Bakker start met slopen. Sleutel ligt in de sleutelkluis.', party: 'bakker' },
  { off: -10, title: 'Extra groepen laten trekken', cat: 'klus', who: 'a', note: 'Van Dijk Elektro. Groepenkast naar 8 groepen + 2 aardlekken.', party: 'vandijk' },
  { off: -9, title: 'Vloer schuren', cat: 'klus', who: 'a', job: 'j3', note: 'Grondlaag eraf in drie gangen: grof, midden, fijn.', party: 'lageweide' },
  { off: -8, title: 'Factuur elektricien', cat: 'betaling', who: 'a', amount: 780, vendor: 'Van Dijk Elektro', note: 'Betaaltermijn 14 dagen.', party: 'vandijk' },
  { off: -7, title: 'Muren sausen', cat: 'klus', who: 'samen', job: 'j5', note: 'Twee lagen. Eerst plafonds, dan wanden.', party: 'verfhuis' },
  { off: -6, title: 'Vloer leggen woonkamer', cat: 'klus', who: 'samen', job: 'j4', note: 'Vloer moet 48 uur acclimatiseren in de kamer.', party: 'rijn' },
  { off: -5, title: 'Keuken geleverd en gemonteerd', cat: 'afspraak', who: 'a', time: '07:30', note: 'Levering tussen 07:30 en 12:00, iemand moet aanwezig zijn.', party: 'keuken' },
  { off: -4, title: 'Restant keuken betalen', cat: 'betaling', who: 'a', amount: 5900, vendor: 'Keukenstudio Zeist', note: 'Betaling bij levering, pas na controle van de order.', party: 'keuken' },
  { off: -2, title: 'Alles inpakken behalve de keuken', cat: 'inpakken', who: 'samen', note: 'Label elke doos met kamer + inhoud.' },
  { off: -1, title: 'Koelkast leegeten en ontdooien', cat: 'inpakken', who: 'b', note: 'Minimaal 12 uur van tevoren uitzetten.' },
  { off: 0, title: 'Verhuizers komen', cat: 'afspraak', who: 'samen', time: '08:00', note: 'De Vries Verhuizingen, 3 man + bakwagen. Parkeervergunning is aangevraagd.', party: 'devries' },
  { off: 0, title: 'Sleuteloverdracht bij de notaris', cat: 'afspraak', who: 'a', time: '10:00', note: 'Legitimatie meenemen. Eindinspectie om 09:15 in de woning.', party: 'notaris' },
  { off: 0, title: 'Verhuisbedrijf betalen', cat: 'betaling', who: 'a', amount: 1850, vendor: 'De Vries Verhuizingen', note: 'Op de dag zelf, pinnen kan ter plekke.', party: 'devries' },
  { off: 2, title: 'Oude woning opleveren', cat: 'afspraak', who: 'samen', time: '11:00', note: 'Bezemschoon, meterstanden noteren, sleutels inleveren.' },
  { off: 4, title: 'Post laten doorsturen', cat: 'admin', who: 'b', note: 'Verhuisservice, 3 maanden.' },
  { off: 6, title: 'Restant aannemer betalen', cat: 'betaling', who: 'a', amount: 9800, vendor: 'Bouwbedrijf Bakker', note: 'Pas na oplevering en controle van de opleverpunten.', party: 'bakker' },
  { off: 14, title: 'Buren uitnodigen voor een borrel', cat: 'admin', who: 'samen', note: 'Briefje in de bus bij nummer 12 en 16.' },
];

/** Turn the starter plan into real rows for a household with a given moving date. */
export function buildSeedPlan(
  householdId: string,
  moveDate: string,
): { parties: Party[]; tasks: Task[] } {
  const now = Date.now();
  const parties: Party[] = SEED_PARTIES.map((p) => ({
    id: crypto.randomUUID(),
    household_id: householdId,
    name: p.name,
    kind: p.kind,
    phone: p.phone ?? null,
    email: null,
    note: p.note ?? null,
    created_at: new Date(now).toISOString(),
  }));
  const bySlug = new Map(SEED_PARTIES.map((p, i) => [p.slug, parties[i].id]));

  const tasks: Task[] = SEED_TASKS.map((s, i) => ({
    id: crypto.randomUUID(),
    household_id: householdId,
    title: s.title,
    cat: s.cat,
    who: s.who,
    party_id: s.party ? (bySlug.get(s.party) ?? null) : null,
    date: addDays(moveDate, s.off),
    time: s.time ?? null,
    note: s.note ?? null,
    amount: s.amount ?? null,
    vendor: s.vendor ?? null,
    job_id: s.job ?? null,
    done: false,
    done_by: null,
    updated_at: new Date(now + i).toISOString(),
  }));

  return { parties, tasks };
}

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
