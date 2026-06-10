export type Stop = {
  id: string;
  num: number;
  name: string;
  swedishName?: string;
  emoji: string;
  area: string;
  story: string;
  description: string;
  clue: string;
  hours: string;
  price: string;
  mustGo?: boolean;
  /** stylized position on the illustrated map, viewBox 0 0 1000 720 */
  mapX: number;
  mapY: number;
};

export type Team = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  tagline: string;
};

export const teams: Team[] = [
  {
    id: "kanelbulle",
    name: "Team Kanelbulle",
    emoji: "🥐",
    color: "var(--gold)",
    tagline: "powered by cinnamon, slowed by fika",
  },
  {
    id: "raka",
    name: "Team Räka",
    emoji: "🦐",
    color: "var(--coral)",
    tagline: "small, fast, suspiciously good at harbors",
  },
];

/** Hunt day: Thursday 11 June 2026, 08:00–18:00 local time */
export const huntSchedule = {
  dayLabel: "Thursday 11 June",
  start: { year: 2026, month: 5 /* June (0-based) */, day: 11, hour: 8 },
  end: { year: 2026, month: 5, day: 11, hour: 18 },
};

export const stops: Stop[] = [
  {
    id: "orgryte",
    num: 1,
    name: "Örgryte Old Church",
    swedishName: "Örgryte gamla kyrka",
    emoji: "🏡",
    area: "Örgryte — home turf!",
    story: "Chapter 1 · Every great hunt begins at your own doorstep.",
    description:
      "Before you even leave the neighborhood: tucked along Danska vägen stands one of Gothenburg's very oldest buildings — a 13th-century stone church that predates the city itself by 400 years.",
    clue: "If it's open, look UP: rococo ceiling paintings from 1741 by Johan Ross the Elder. Find the dramatic panel of 'weeping and gnashing of teeth' — then march off to town in better spirits.",
    hours: "Exterior always open · interior at services & events",
    price: "Free",
    mapX: 858,
    mapY: 462,
  },
  {
    id: "konstmuseum",
    num: 2,
    name: "Museum of Art",
    swedishName: "Göteborgs konstmuseum",
    emoji: "🎨",
    area: "Götaplatsen, top of Avenyn",
    story: "Chapter 2 · Over the hill from home, the city's grandest square awaits.",
    description:
      "One of northern Europe's finest art collections — Nordic golden age, Rembrandt, Monet, van Gogh and Picasso — crowning the grand boulevard. Your warm-up walk from Örgryte ends in style.",
    clue: "Outside: salute Poseidon, the giant bronze and unofficial city mascot. Inside: find the cheerful toast in 'Hip, Hip, Hurrah!' in the Fürstenberg Gallery.",
    hours: "Tue–Sun from 11 (Wed until 20) · Mon closed",
    price: "75 SEK · free under 20 & students",
    mapX: 664,
    mapY: 468,
  },
  {
    id: "rohsska",
    num: 3,
    name: "Röhsska Museum",
    swedishName: "Röhsska museet",
    emoji: "🪑",
    area: "Vasagatan, Vasastan",
    story: "Chapter 3 · Stroll down leafy Vasagatan, guarded by stone lions.",
    description:
      "Sweden's only museum dedicated to design, fashion and craft — 50,000+ objects in a handsome 1913 red-brick palace.",
    clue: "Two Ming-dynasty marble lions guard the steps (the outdoor ones are copies — hunt down the originals inside!). Then find the glazed-brick lion from Nebuchadnezzar II's Babylon.",
    hours: "Tue–Sun from 11 (Wed until 20) · Mon closed",
    price: "~75 SEK · free under 20 & students",
    mapX: 556,
    mapY: 422,
  },
  {
    id: "palmhuset",
    num: 4,
    name: "The Palm House",
    swedishName: "Trädgårdsföreningen",
    emoji: "🌴",
    area: "Garden Society park",
    story: "Chapter 4 · Cross the moat into a secret garden.",
    description:
      "One of Europe's best-preserved 19th-century pleasure parks, just inside the old moat — home to a glorious rose garden and a giant glasshouse.",
    clue: "The 1878 Palm House is cast iron and glass, modeled on London's Crystal Palace. Step inside and find the camellia room!",
    hours: "Park daily from 07 · Palm House 10–20 (summer)",
    price: "Free!",
    mapX: 628,
    mapY: 290,
  },
  {
    id: "stadsmuseum",
    num: 5,
    name: "Museum of Gothenburg",
    swedishName: "Göteborgs stadsmuseum",
    emoji: "🏛️",
    area: "Inom Vallgraven (old town)",
    story: "Chapter 5 · Into the old town, where the whole saga is kept.",
    description:
      "12,000 years of city history inside the grand 18th-century headquarters of the Swedish East India Company, right on the main canal.",
    clue: "Find the Äskekärr ship — the only original Viking-age ship on display anywhere in Sweden, dredged out of the Göta älv's clay.",
    hours: "Tue–Sun from 10 (Wed until 20) · Mon closed",
    price: "75 SEK · free under 20 & students",
    mapX: 502,
    mapY: 300,
  },
  {
    id: "maritiman",
    num: 6,
    name: "Maritiman Ship Museum",
    swedishName: "Maritiman",
    emoji: "⚓",
    area: "Packhuskajen, inner harbor",
    story: "Chapter 6 · The story spills out of the museum and onto the water.",
    description:
      "One of the world's largest floating ship museums — about 15 vessels moored together at the quay, including the destroyer Småland, the biggest preserved warship in Scandinavia.",
    clue: "Climb down into the submarine Nordkaparen and find the periscope. Bonus points if you spot Sölve, an armored monitor from 1875!",
    hours: "Apr–Oct, roughly daily 10–17 (closed winter)",
    price: "~130–175 SEK · free with Go City pass",
    mapX: 400,
    mapY: 224,
  },
  {
    id: "feskekorka",
    num: 7,
    name: "Feskekôrka",
    swedishName: "the 'Fish Church'",
    emoji: "🐟",
    area: "Rosenlund, on the moat",
    story: "Chapter 7 · Lunch break in a church where the sermon is shrimp.",
    description:
      "The beloved 1874 fish market hall that looks exactly like a Gothic church — freshly reopened after a grand renovation, now full of fish counters and snack bars. Perfect lunch stop!",
    clue: "Step inside and look up: the church-like nave spans the whole hall with not a single supporting pillar — daring 1870s engineering.",
    hours: "Tue–Fri 10–18, Sat 10–15 · Sun–Mon closed",
    price: "Free entry (shrimp sandwich extra 🍤)",
    mapX: 322,
    mapY: 372,
  },
  {
    id: "rodasten",
    num: 8,
    name: "Röda Sten & the Graffiti Wall",
    swedishName: "Röda Sten Konsthall",
    emoji: "🎨",
    area: "Under Älvsborg Bridge",
    story: "Chapter 8 · Follow the river west until the art climbs the walls.",
    mustGo: true,
    description:
      "A raw 1940s boiler house turned contemporary art hall under the mighty Älvsborg Bridge — and right outside stands 'Draken', Gothenburg's only legal graffiti wall: a 41-meter dragon-shaped sculpture repainted by street artists since 2004. Must go!",
    clue: "The dragon never looks the same twice — photograph your favorite piece, it might be gone tomorrow. Inside the konsthall, hunt the walls for surviving graffiti from its 1990s rave era.",
    hours: "Wall always open · konsthall Tue–Thu 12–17, Fri 12–19, Sat–Sun 11–17",
    price: "Wall free · konsthall 60 SEK, free under 26 & Fri after 16",
    mapX: 150,
    mapY: 278,
  },
  {
    id: "haga",
    num: 9,
    name: "Haga & Skansen Kronan",
    swedishName: "Haga Nygata",
    emoji: "🏰",
    area: "Haga, the old wooden quarter",
    story: "Chapter 9 · Back east, the cobblestones smell of cinnamon.",
    description:
      "The city's oldest suburb (1648) — cobbled lanes of wooden-topped houses and cozy cafés, with a 17th-century octagonal fortress keeping watch from the hill above.",
    clue: "Order the plate-sized Hagabulle cinnamon bun at Café Husaren, then climb the hill and spot the gilded crown on the fortress roof — it fits 12 people inside.",
    hours: "Streets & fortress viewpoint always open",
    price: "Free (bun budget: ~70 SEK)",
    mapX: 366,
    mapY: 478,
  },
  {
    id: "naturhistoriska",
    num: 10,
    name: "Natural History Museum",
    swedishName: "Göteborgs naturhistoriska museum",
    emoji: "🐋",
    area: "Slottsskogen park",
    story: "Chapter 10 · Deep in the park, a giant sleeps.",
    description:
      "Gothenburg's oldest museum (1833) with 10 million specimens, at the edge of the city's big free park — where seals and penguins live.",
    clue: "Find the Malm Whale — the only taxidermied blue whale on Earth, beached in 1865, with a furnished lounge built inside its mouth.",
    hours: "Tue–Sun from 11 (Thu until 20) · Mon closed",
    price: "70 SEK · free under 20 & students",
    mapX: 205,
    mapY: 585,
  },
  {
    id: "varldskultur",
    num: 11,
    name: "World Culture Museum",
    swedishName: "Världskulturmuseet",
    emoji: "🌍",
    area: "Korsvägen",
    story: "Chapter 11 · Hop a tram back east — the finale is near, but one treasure remains.",
    description:
      "A striking contemporary glass museum of world cultures at Korsvägen — and next door, Universeum's indoor rainforest if your crew still has energy to burn.",
    clue: "Stand in the atrium and look up the monumental staircase that zigzags the full glass facade — count the floors hanging off it.",
    hours: "Tue–Sun roughly 11–17 · Mon closed",
    price: "160 SEK · free under 19",
    mapX: 728,
    mapY: 508,
  },
  {
    id: "liseberg",
    num: 12,
    name: "Liseberg",
    swedishName: "the grand finale 🎡",
    emoji: "🎢",
    area: "Korsvägen — X marks the spot!",
    story: "Final chapter · As the lights come on, the treasure map ends where the screams of joy begin.",
    description:
      "Scandinavia's most beloved amusement park (since 1923), five minutes from where you started this morning. Ride the wheel, watch the lights, and celebrate — you've earned it.",
    clue: "Find a big green Liseberg rabbit — the park's beloved mascot — and take your victory team photo with it. First team done wins the hunt!",
    hours: "Summer season: typically midday–22 (check the day's calendar)",
    price: "Entry from ~95 SEK online · ride pass extra",
    mapX: 812,
    mapY: 588,
  },
];

export const routeIntro =
  "The story starts at your own doorstep in Örgryte, sweeps over Götaplatsen's art palaces, dives through the old town to the harbor, follows the river west to the graffiti wall at Röda Sten, climbs back through Haga to a sleeping blue whale — and ends in a blaze of Liseberg lights. Roughly 12 km of adventure (trams allowed!). Most museums nap on Mondays, so hunt Tuesday–Saturday.";

export const bonusStop = {
  name: "World of Volvo",
  emoji: "🚗",
  description:
    "The old Volvo Museum was reborn in 2024 as World of Volvo, a spectacular round timber building near Liseberg, held up by three giant glulam 'trees'. It's right by your finale — car-curious hunters should seek out the original 1927 Volvo ÖV4 'Jakob' inside.",
  hours: "Daily, roughly 10–17",
  price: "Building free · exhibition from ~120 SEK",
};
