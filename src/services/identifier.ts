import { dataLoader, BirdBaseRecord, ColorRecord } from './dataLoader';
import { extractBirdFeatures } from './qwen';
import { fetchBarchartPrior } from '../../ebirdBarchart';

export interface BirdResult {
  commonName: string;
  scientificName: string;
  description: string;
  prior: number;
  likelihood: number;
  posterior?: number;
  ebirdCode?: string;
  colorScore?: number;
  shapeScore?: number;
  behaviorScore?: number;
  habitatScore?: number;
}

export interface AIResponse {
  type: "question" | "result";
  question?: string;
  anatomyTerm?: string;
  birds?: BirdResult[];
  expandedFamilies?: string[]; // For Pro birders
  allPoolBirds?: BirdResult[];
  ebirdRegionCode?: string;
  ebirdRegionName?: string;
}

const STANDARD_HABITATS = [
  "Forest or Woodland",
  "Ocean or Beach",
  "Lake, Pond, or River",
  "Marsh or Swamp",
  "Grassland or Prairie",
  "Desert or Scrub",
  "Urban or Suburban",
  "Agricultural or Farm",
  "Mountains or Alpine"
];

const HABITAT_FIELD_MAP: Record<string, string[]> = {
  "Forest or Woodland": [
    "forest_habitat_rank",
    "woodland_habitat_rank",
    "bushland_or_mosaic_habitat_rank"
  ],
  "Ocean or Beach": [
    "coastal_habitat_rank",
    "seabird_marine_habitat_rank",
    "wetland_habitat_rank"
  ],
  "Lake, Pond, or River": [
    "riparian_habitat_rank",
    "wetland_habitat_rank"
  ],
  "Marsh or Swamp": [
    "wetland_habitat_rank",
    "riparian_habitat_rank"
  ],
  "Grassland or Prairie": [
    "grassland_habitat_rank",
    "plains_habitat_rank",
    "savanna_habitat_rank"
  ],
  "Desert or Scrub": [
    "desert_habitat_rank",
    "shrubland_habitat_rank",
    "bushland_or_mosaic_habitat_rank"
  ],
  "Urban or Suburban": [
    "artificial_habitat_rank"
  ],
  "Agricultural or Farm": [
    "artificial_habitat_rank",
    "grassland_habitat_rank",
    "plains_habitat_rank"
  ],
  "Mountains or Alpine": [
    "rocky_habitat_rank"
  ]
};

function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSpeciesName(value: unknown): string {
  return normalizeText(value);
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function splitListText(value: unknown): string[] {
  return String(value || '')
    .split(/[,;\/|]+/)
    .map(v => normalizeText(v))
    .filter(Boolean);
}

function phraseInText(raw: string, phrase: string): boolean {
  return normalizeText(raw).includes(normalizeText(phrase));
}

function buildRequestedColors(extractedColors: { body_part: string; color: string }[], rawColors: string): string[] {
  const requested = extractedColors
    .map(c => normalizeText(c.color))
    .filter(Boolean);

  const raw = normalizeText(rawColors);
  if (raw) {
    for (const row of dataLoader.nlpColors) {
      const standard = normalizeText(row.Standard_Term);
      const alternatives = splitListText(row.Alternative_Descriptions);
      if (standard && (raw.includes(standard) || alternatives.some(alt => alt && raw.includes(alt)))) {
        requested.push(standard);
      }
    }

    // Fallback for simple comma-separated color entries even if the translation table misses something.
    requested.push(...splitListText(rawColors));
  }

  return uniq(requested);
}

function getColorEntriesForBird(bird: BirdBaseRecord): ColorRecord[] {
  const birdSci = normalizeSpeciesName(bird.scientific_name);
  const birdCommon = normalizeText(bird.common_name);

  return dataLoader.colorsOverall.filter(c =>
    normalizeSpeciesName(c.Scientific_name) === birdSci ||
    normalizeText(c.Common_name) === birdCommon
  );
}

function colorGroups(color: string): string[] {
  const c = normalizeText(color);
  const groups: string[] = [];

  if (/white|whitish|cream|ivory|milky|snow/.test(c)) groups.push('white');
  if (/black|ebony|raven|inky/.test(c)) groups.push('black');
  if (/gray|grey|slate|silver|charcoal|gunmetal|lead|ashy/.test(c)) groups.push('gray');
  if (/blue|navy|cyan|azure|sapphire|indigo/.test(c)) groups.push('blue');
  if (/brown|tan|buff|rufous|rust|chestnut|mahogany|tawny|khaki|beige/.test(c)) groups.push('brown');
  if (/green|olive|moss/.test(c)) groups.push('green');
  if (/yellow|gold|canary|lemon/.test(c)) groups.push('yellow');
  if (/orange|peach|apricot|tangerine/.test(c)) groups.push('orange');
  if (/red|maroon|burgundy|crimson|scarlet|ruby/.test(c)) groups.push('red');
  if (/pink|rose|rosy|salmon/.test(c)) groups.push('pink');
  if (/purple|violet|plum|lilac/.test(c)) groups.push('purple');

  return uniq(groups);
}

function colorAffinity(requestedColor: string, availableColor: string): number {
  const req = normalizeText(requestedColor);
  const avail = normalizeText(availableColor);
  if (!req || !avail) return 0;

  // Exact-ish match, including entries such as "medium-dark brown" for "brown".
  if (req === avail || avail.includes(req) || req.includes(avail)) return 1;

  const reqGroups = colorGroups(req);
  const availGroups = colorGroups(avail);
  if (reqGroups.some(g => availGroups.includes(g))) return 0.9;

  // Bird-color friendly near matches. These catch cases like Great Blue Heron,
  // where the measured color table says gray/pale gray but a birder describes it as blue/white.
  if (reqGroups.includes('blue') && availGroups.includes('gray')) return 0.72;
  if (reqGroups.includes('gray') && availGroups.includes('blue')) return 0.72;

  if (reqGroups.includes('white') && availGroups.includes('gray')) {
    if (/pale|light|silver|whitish/.test(avail)) return 0.8;
    return 0.55;
  }
  if (reqGroups.includes('gray') && availGroups.includes('white')) return 0.75;

  if (reqGroups.includes('white') && availGroups.includes('brown')) {
    if (/pale|buff|cream|tan|light/.test(avail)) return 0.55;
  }
  if (reqGroups.includes('yellow') && (availGroups.includes('brown') || availGroups.includes('orange'))) {
    if (/buff|cream|tan|orange/.test(avail)) return 0.55;
  }
  if (reqGroups.includes('orange') && (availGroups.includes('brown') || availGroups.includes('red'))) return 0.65;
  if (reqGroups.includes('red') && availGroups.includes('brown')) return 0.65;
  if (reqGroups.includes('black') && availGroups.includes('gray') && /dark|charcoal|slate/.test(avail)) return 0.75;

  return 0;
}

function scoreColors(bird: BirdBaseRecord, requestedColors: string[]): number {
  if (requestedColors.length === 0) return 100;
  if (bird.Colors === -1) return 100; // dataset says color cannot be evaluated

  const entries = getColorEntriesForBird(bird);
  const availableColors = entries.flatMap(entry => splitListText(entry.all_color));

  // If a species is missing from the color table, do not eliminate it outright.
  // This keeps missing data from overpowering behavior/habitat/eBird evidence.
  if (availableColors.length === 0) return 60;

  let total = 0;
  for (const requested of requestedColors) {
    const best = Math.max(...availableColors.map(available => colorAffinity(requested, available)), 0);
    total += best;
  }

  return (total / requestedColors.length) * 100;
}

function rankToScore(rank: unknown): number {
  const numericRank = typeof rank === 'number' ? rank : Number(rank);
  if (!Number.isFinite(numericRank)) return 0;

  // In BIRDBASE habitat ranks, 1 is strongest/primary, larger ranks are weaker.
  if (numericRank <= 1) return 1;
  if (numericRank === 2) return 0.85;
  if (numericRank === 3) return 0.65;
  if (numericRank === 4) return 0.45;
  return 0.25;
}

function selectedHabitatsFromInput(rawHabitat: string, extractedHabitat: string | null | undefined): string[] {
  const selected: string[] = [];
  const raw = String(rawHabitat || '');
  const normalizedRaw = normalizeText(raw);
  const normalizedExtracted = normalizeText(extractedHabitat);
  const combined = `${normalizedRaw} ${normalizedExtracted}`.trim();

  for (const habitat of STANDARD_HABITATS) {
    if (phraseInText(raw, habitat) || phraseInText(extractedHabitat || '', habitat)) {
      selected.push(habitat);
    }
  }

  // Keyword fallback for custom habitat descriptions and NLP output.
  if (/forest|woods|woodland|tree/.test(combined)) selected.push("Forest or Woodland");
  if (/ocean|sea|beach|shore|coast|marine|bay/.test(combined)) selected.push("Ocean or Beach");
  if (/river|stream|creek|lake|pond|water|riparian/.test(combined)) selected.push("Lake, Pond, or River");
  if (/marsh|swamp|wetland|bog/.test(combined)) selected.push("Marsh or Swamp");
  if (/grassland|prairie|field|meadow|savanna|plain/.test(combined)) selected.push("Grassland or Prairie");
  if (/desert|scrub|shrub|chaparral|arid/.test(combined)) selected.push("Desert or Scrub");
  if (/urban|suburban|city|town|yard|park|neighborhood/.test(combined)) selected.push("Urban or Suburban");
  if (/farm|agricultural|crop|pasture|orchard/.test(combined)) selected.push("Agricultural or Farm");
  if (/mountain|alpine|cliff|rocky/.test(combined)) selected.push("Mountains or Alpine");

  return uniq(selected);
}

function scoreHabitat(bird: BirdBaseRecord, rawHabitat: string, extractedHabitat?: string | null): number {
  const selectedHabitats = selectedHabitatsFromInput(rawHabitat, extractedHabitat);
  if (selectedHabitats.length === 0) return 100;

  let total = 0;
  for (const habitat of selectedHabitats) {
    const fields = HABITAT_FIELD_MAP[habitat] || [];
    const best = Math.max(...fields.map(field => rankToScore(bird[field])), 0);

    // A primary habitat text match is useful when rank columns are sparse.
    const primary = normalizeText(bird.primary_habitat);
    const habitatText = normalizeText(habitat);
    const textBoost = primary && (habitatText.includes(primary) || primary.includes(habitatText.split(' ')[0])) ? 0.75 : 0;

    total += Math.max(best, textBoost);
  }

  return (total / selectedHabitats.length) * 100;
}

function behaviorPairScore(requestedBehavior: string, birdBehavior: string): number {
  const requested = normalizeText(requestedBehavior);
  const actual = normalizeText(birdBehavior);
  if (!requested || !actual) return 0;
  if (requested === actual) return 1;

  const requestedCategory = requested.split(' ')[0];
  const actualCategory = actual.split(' ')[0];
  if (requestedCategory && requestedCategory === actualCategory) {
    if (requestedCategory === 'water') return 0.7;
    if (requestedCategory === 'foraging') return 0.65;
    return 0.5;
  }

  // Cross-category links that are often described together by users.
  if (requested.includes('fish') && (actual.includes('wading') || actual.includes('diving') || actual.includes('probing'))) return 0.7;
  if (requested.includes('catch') && (actual.includes('foraging') || actual.includes('wading') || actual.includes('sallying'))) return 0.6;
  if (requested.includes('wading') && actual.includes('probing')) return 0.6;
  if (requested.includes('probing') && actual.includes('wading')) return 0.6;

  return 0;
}

function behaviorHintsFromRaw(rawBehavior: string): string[] {
  const raw = normalizeText(rawBehavior);
  const hints: string[] = [];
  if (!raw) return hints;

  if (/wading|standing in shallow|walking in water|shallows|stalking/.test(raw)) hints.push('Water: Wading');
  if (/fish|catching fish|caught fish|spearing|stabbing/.test(raw)) hints.push('Foraging: Probing');
  if (/diving|plunging|underwater|submerged/.test(raw)) hints.push('Water: Diving/Plunging');
  if (/swimming|floating|paddling/.test(raw)) hints.push('Water: Surface-swimming');
  if (/soaring|gliding|thermal/.test(raw)) hints.push('Flight: Soaring/Gliding');
  if (/hovering|kiting/.test(raw)) hints.push('Flight: Hovering/Kiting');
  if (/hopping/.test(raw)) hints.push('Movement: Ground-hopping');
  if (/walking|running/.test(raw)) hints.push('Movement: Ground-walking/running');
  if (/picking|gleaning|leaves|branches/.test(raw)) hints.push('Foraging: Gleaning');

  return hints;
}

function scoreBehavior(bird: BirdBaseRecord, extractedBehaviors: string[], rawBehavior: string): number {
  const requestedBehaviors = uniq([
    ...extractedBehaviors.filter(Boolean),
    ...behaviorHintsFromRaw(rawBehavior)
  ]);

  if (requestedBehaviors.length === 0) return 100;

  const birdBehaviors = [bird.Final_Behavior_1, bird.Final_Behavior_2, bird.Final_Behavior_3].filter(Boolean);
  if (birdBehaviors.length === 0) return 60;

  let total = 0;
  for (const requested of requestedBehaviors) {
    const best = Math.max(...birdBehaviors.map(actual => behaviorPairScore(requested, actual)), 0);
    total += best;
  }

  return (total / requestedBehaviors.length) * 100;
}

interface ShapeCriterion {
  key: string;
  field: string;
  label: string;
  min?: number;
  max?: number;
  minExclusive?: boolean;
  maxExclusive?: boolean;
}

function numericValue(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function criterionMatches(value: number, criterion: ShapeCriterion): boolean {
  if (criterion.min !== undefined) {
    if (criterion.minExclusive ? value <= criterion.min : value < criterion.min) return false;
  }
  if (criterion.max !== undefined) {
    if (criterion.maxExclusive ? value >= criterion.max : value > criterion.max) return false;
  }
  return true;
}

function addShapeCriterion(criteria: ShapeCriterion[], criterion: ShapeCriterion) {
  const existingIndex = criteria.findIndex(c => c.key === criterion.key);
  if (existingIndex >= 0) {
    criteria[existingIndex] = criterion;
  } else {
    criteria.push(criterion);
  }
}

function requestedShapeCriteriaFromText(rawShapeDescription: string, extractedShapes: string[]): ShapeCriterion[] {
  const text = normalizeText(`${rawShapeDescription || ''} ${extractedShapes.join(' ')}`);
  const criteria: ShapeCriterion[] = [];
  if (!text) return criteria;

  // Beak Length vs. Tarsus (BeakL_Div_Tarsus)
  if (/(short|small|tiny) (beak|bill)|short billed|short beaked/.test(text)) {
    addShapeCriterion(criteria, { key: 'beak_length', field: 'BeakL_Div_Tarsus', label: 'Short Beak', max: 0.5, maxExclusive: true });
  }
  if (/(average|medium|normal) (beak|bill)|average billed|medium billed/.test(text)) {
    addShapeCriterion(criteria, { key: 'beak_length', field: 'BeakL_Div_Tarsus', label: 'Average Beak', min: 0.5, max: 1.2 });
  }
  if (/(long|large|very long) (beak|bill)|long billed|long beaked/.test(text)) {
    addShapeCriterion(criteria, { key: 'beak_length', field: 'BeakL_Div_Tarsus', label: 'Long Beak', min: 1.2, minExclusive: true });
  }

  // Tail-to-Wing Ratio (Prop_Tail_Length)
  if (/(short|stubby|tiny) tail|no tail|tailless/.test(text)) {
    addShapeCriterion(criteria, { key: 'tail_length', field: 'Prop_Tail_Length', label: 'Short Tail / No Tail', max: 0.55, maxExclusive: true });
  }
  if (/(average|medium|normal) tail/.test(text)) {
    addShapeCriterion(criteria, { key: 'tail_length', field: 'Prop_Tail_Length', label: 'Average Tail', min: 0.55, max: 0.85 });
  }
  if (/long tail|very long tail|elongated tail/.test(text)) {
    addShapeCriterion(criteria, { key: 'tail_length', field: 'Prop_Tail_Length', label: 'Long Tail', min: 0.85, minExclusive: true });
  }

  // Leg-to-Wing Ratio (Prop_Leg_Length)
  if (/(short|small|tiny) legs|short legged/.test(text)) {
    addShapeCriterion(criteria, { key: 'leg_length', field: 'Prop_Leg_Length', label: 'Short Legs', max: 0.15, maxExclusive: true });
  }
  if (/(average|medium|normal) legs|average legged|medium legged/.test(text)) {
    addShapeCriterion(criteria, { key: 'leg_length', field: 'Prop_Leg_Length', label: 'Average Legs', min: 0.15, max: 0.35 });
  }
  if (/(long|tall|very long) legs|long legged|stilt legged/.test(text)) {
    addShapeCriterion(criteria, { key: 'leg_length', field: 'Prop_Leg_Length', label: 'Long Legs', min: 0.35, minExclusive: true });
  }

  // Beak Stoutness = Beak_Length / Beak_Depth. Lower means stouter.
  if (/stubby (beak|bill)|stout (beak|bill)|thick (beak|bill)|heavy (beak|bill)|chunky (beak|bill)|grosbeak|finch like beak/.test(text)) {
    addShapeCriterion(criteria, { key: 'beak_stoutness', field: 'Beak_Stoutness', label: 'Stubby / Stout Beak', max: 1.6, maxExclusive: true });
  }
  if (/(average|medium|normal) (beak|bill) shape|average stoutness/.test(text)) {
    addShapeCriterion(criteria, { key: 'beak_stoutness', field: 'Beak_Stoutness', label: 'Average Beak Stoutness', min: 1.6, max: 3.0 });
  }
  if (/needle (beak|bill)|spear (beak|bill)|spear like (beak|bill)|thin (beak|bill)|slender (beak|bill)|very pointed (beak|bill)/.test(text)) {
    addShapeCriterion(criteria, { key: 'beak_stoutness', field: 'Beak_Stoutness', label: 'Needle / Spear Beak', min: 3.0, minExclusive: true });
  }

  // Beak Cross-Section = Beak_Depth / Beak_Width.
  if (/flat (beak|bill)|wide (beak|bill)|broad (beak|bill)|duck like (beak|bill)/.test(text)) {
    addShapeCriterion(criteria, { key: 'beak_cross_section', field: 'Beak_CrossSect', label: 'Flat / Wide Beak', max: 0.95, maxExclusive: true });
  }
  if (/cone (beak|bill)|conical (beak|bill)|cone shaped (beak|bill)/.test(text)) {
    addShapeCriterion(criteria, { key: 'beak_cross_section', field: 'Beak_CrossSect', label: 'Cone Beak', min: 0.95, max: 1.3 });
  }
  if (/tall (beak|bill)|knife (beak|bill)|deep (beak|bill)|narrow deep (beak|bill)/.test(text)) {
    addShapeCriterion(criteria, { key: 'beak_cross_section', field: 'Beak_CrossSect', label: 'Tall / Knife Beak', min: 1.3, minExclusive: true });
  }

  // Hand-Wing Index (HWI)
  if (/short wings|rounded wings|broad rounded wings|stubby wings/.test(text)) {
    addShapeCriterion(criteria, { key: 'wing_shape', field: 'HWI', label: 'Short / Rounded Wings', max: 20, maxExclusive: true });
  }
  if (/average wings|medium wings|normal wings/.test(text)) {
    addShapeCriterion(criteria, { key: 'wing_shape', field: 'HWI', label: 'Average Wings', min: 20, max: 40 });
  }
  if (/long wings|pointed wings|long pointed wings|falcon like wings|swallow like wings/.test(text)) {
    addShapeCriterion(criteria, { key: 'wing_shape', field: 'HWI', label: 'Long / Pointed Wings', min: 40, minExclusive: true });
  }

  return criteria;
}

function scoreShape(bird: BirdBaseRecord, rawShapeDescription: string, extractedShapes: string[]): number {
  const criteria = requestedShapeCriteriaFromText(rawShapeDescription, extractedShapes);
  if (criteria.length === 0) return 100;

  let total = 0;
  for (const criterion of criteria) {
    const value = numericValue(bird[criterion.field]);
    if (value === null) {
      // Missing measurement data should be mildly neutral, not a hard failure.
      total += 0.6;
      continue;
    }
    total += criterionMatches(value, criterion) ? 1 : 0;
  }

  return (total / criteria.length) * 100;
}

function matchesEbirdName(freqName: string, birdCommonName: string): boolean {
  const freq = normalizeText(freqName);
  const bird = normalizeText(birdCommonName);
  return freq === bird || freq.includes(bird) || bird.includes(freq);
}

// Port of R logic
export async function identifyBirdLocal(
  location: string,
  regionCode: string | undefined,
  date: string,
  experience: "pro" | "amateur",
  family: string | string[],
  size: string,
  behavior: string,
  habitat: string,
  colors: string,
  shapeDescription: string,
  qna: { question: string; answer: string }[],
  expandedFamilies?: string[]
): Promise<AIResponse> {
  // Combine user input for NLP
  const combinedInput = `
Colors and Markings: ${colors}
${experience === 'amateur' ? `Shape Description: ${shapeDescription || ''}\n` : ''}Habitat: ${habitat}
${experience === 'pro' ? `Family: ${family}\nBehaviors: ${behavior}` : `Size: ${size}\nBehaviors: ${behavior}`}
`;

  console.log("Calling Qwen 2.5 for NLP extraction...");
  const extracted = await extractBirdFeatures(combinedInput);
  console.log("Extracted:", extracted);

  const requestedColors = buildRequestedColors(extracted.extracted_colors || [], colors);

  // Get Barchart Prior
  let freqs: Record<string, number> = {};
  let regionCodeStr = "";
  let regionNameStr = "";
  let maxFreq = 0;
  
  const barchartData = await fetchBarchartPrior(location, date, regionCode);
  freqs = barchartData.frequencies || {};
  regionCodeStr = barchartData.regionCode || "";
  regionNameStr = barchartData.regionName || "";
  maxFreq = barchartData.maxFreqOriginal || 0;

  // Pool of birds
  let pool = [...dataLoader.birdBase];

  // 1. Pro Family Filter
  if (experience === 'pro' && family && (!expandedFamilies || expandedFamilies.length === 0)) {
    const familyArray = Array.isArray(family) ? family : [family];
    if (familyArray.length > 0) {
      pool = pool.filter(b => {
        const familyLatin = b.family_clements_ebird2024?.toLowerCase() || "";
        const taxonomyEntry = dataLoader.taxonomyMap.get(b.family_clements_ebird2024);
        const familyGroup = taxonomyEntry?.group.toLowerCase() || "";
        const familyFull = taxonomyEntry?.family.toLowerCase() || "";
        
        return familyArray.some(f => {
          const searchStr = f.toLowerCase();
          return familyLatin.includes(searchStr) || familyGroup.includes(searchStr) || familyFull.includes(searchStr);
        });
      });
    }
  }

  // Expanded Families filter (if user clicked "See results with these families")
  if (expandedFamilies && expandedFamilies.length > 0) {
    pool = pool.filter(b => expandedFamilies.includes(b.family_clements_ebird2024));
  }

  // 2. Amateur Size Filter
  if (experience === 'amateur' && size) {
    // Basic bin filtering based on avg_mass
    // Sizes: "Sparrow-sized or smaller": <= 27, "Between Sparrow and Robin": 27-80, "Robin-sized": 80, "Between Robin and Crow": 80-456, "Crow-sized": 456, "Between Crow and Goose": 456-4907, "Goose-sized": >= 4907
    let minM = 0; let maxM = 999999;
    if (size === "Sparrow-sized or smaller") { maxM = 35; }
    else if (size === "Between Sparrow and Robin") { minM = 20; maxM = 100; }
    else if (size === "Robin-sized") { minM = 60; maxM = 120; }
    else if (size === "Between Robin and Crow") { minM = 75; maxM = 500; }
    else if (size === "Crow-sized") { minM = 250; maxM = 700; }
    else if (size === "Between Crow and Goose") { minM = 400; maxM = 5000; }
    else if (size === "Goose-sized") { minM = 1250; }
    
    // Expand bounds by adjacent bins for "soft" bounds
    pool = pool.filter(b => {
      const m = b.avg_mass || b.Avonet_Mass;
      if (!m) return true; // keep if no data
      return m >= minM && m <= maxM;
    });
  }

  // Scoring
  const results: BirdResult[] = [];
  const topFamiliesSet = new Set<string>();

  for (const bird of pool) {
    let score = 0;
    
    // Colors (100pts)
    const colorScore = scoreColors(bird, requestedColors);
    score += colorScore;

    // Shape (100pts)
    const extractedShapes = extracted.extracted_shape_and_size || [];
    const shapeScore = scoreShape(bird, experience === 'amateur' ? (shapeDescription || '') : '', extractedShapes);
    score += shapeScore;

    // Behavior (100pts)
    const behaviorScore = scoreBehavior(bird, extracted.extracted_behaviors || [], behavior);
    score += behaviorScore;

    // Habitat (100pts)
    const habitatScore = scoreHabitat(bird, habitat, extracted.extracted_habitat?.standard_habitat_match);
    score += habitatScore;

    // Normalize max score to 1.0 likelihood
    let likelihood = score / 400;
    likelihood = Math.max(0.01, likelihood); // Ensure non-zero

    // Prior
    let ebirdPrior = 0;
    if (freqs[bird.common_name] !== undefined) {
      ebirdPrior = freqs[bird.common_name];
    } else {
      const match = Object.keys(freqs).find(k => matchesEbirdName(k, bird.common_name));
      if (match) {
        ebirdPrior = freqs[match];
      }
    }
    
    // If data is available but bird not found or 0 freq, prior remains 0.0. 
    // If data is unavailable, prior is -1.
    if (ebirdPrior > 1) {
      ebirdPrior = ebirdPrior / 100;
    }
    const priorDataAvailable = Object.keys(freqs).length > 0;
    let normalizedPrior = priorDataAvailable ? Math.max(0, Math.min(1, ebirdPrior)) : -1;

    if (likelihood > 0.3) {
      topFamiliesSet.add(bird.family_clements_ebird2024);
    }

    results.push({
      commonName: bird.common_name,
      scientificName: bird.scientific_name,
      description: `Matched with ${Math.round(likelihood * 100)}% visual/habitat similarity.`,
      prior: normalizedPrior,
      likelihood: likelihood,
      ebirdCode: '', // Would need to map if available
      posterior: normalizedPrior === -1 ? likelihood : normalizedPrior * likelihood,
      colorScore: colorScore,
      shapeScore: shapeScore,
      behaviorScore: behaviorScore,
      habitatScore: habitatScore
    });
  }

  results.sort((a, b) => (b.posterior || 0) - (a.posterior || 0));
  
  // Return the top 10 rather than dropping everything under an arbitrary 1% cutoff.
  // Then renormalize only the displayed birds so their posterior percentages sum to 100%.
  const topBirds = results.slice(0, 10);
  let displayedPosteriorTotal = topBirds.reduce((sum, r) => sum + (r.posterior || 0), 0);

  if (displayedPosteriorTotal > 0) {
    topBirds.forEach(r => {
      r.posterior = (r.posterior || 0) / displayedPosteriorTotal;
    });
  } else {
    const displayedLikelihoodTotal = topBirds.reduce((sum, r) => sum + r.likelihood, 0);
    topBirds.forEach(r => {
      r.posterior = displayedLikelihoodTotal > 0 ? r.likelihood / displayedLikelihoodTotal : 0;
    });
  }

  // Sort debug/master pool descending by prior for region-frequency inspection.
  const allPoolBirds = [...results].sort((a, b) => b.prior - a.prior);

  return {
    type: "result",
    birds: topBirds,
    expandedFamilies: Array.from(topFamiliesSet).slice(0, 5), // Return up to 5 matching families
    allPoolBirds,
    ebirdRegionCode: regionCodeStr,
    ebirdRegionName: regionNameStr
  };
}
