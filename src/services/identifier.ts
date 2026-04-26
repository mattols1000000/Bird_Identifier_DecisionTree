import { dataLoader } from './dataLoader';
import { extractBirdFeatures, QwenExtractedData } from './qwen';

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
}

export interface AIResponse {
  type: "question" | "result";
  question?: string;
  anatomyTerm?: string;
  birds?: BirdResult[];
  expandedFamilies?: string[]; // For Pro birders
  allPoolBirds?: BirdResult[];
}

// Port of R logic
export async function identifyBirdLocal(
  location: string,
  date: string,
  experience: "pro" | "amateur",
  family: string,
  size: string,
  behavior: string,
  habitat: string,
  colors: string,
  qna: { question: string; answer: string }[],
  expandedFamilies?: string[]
): Promise<AIResponse> {
  // Combine user input for NLP
  const combinedInput = `
Colors and Markings: ${colors}
Habitat: ${habitat}
${experience === 'pro' ? `Family: ${family}\nBehaviors: ${behavior}` : `Size: ${size}\nBehaviors: ${behavior}`}
`;

  console.log("Calling Qwen 2.5 for NLP extraction...");
  const extracted = await extractBirdFeatures(combinedInput);
  console.log("Extracted:", extracted);

  // Get Barchart Prior
  let freqs: Record<string, number> = {};
  let regionCodeStr = "";
  let regionNameStr = "";
  try {
    const barchartRes = await fetch("http://localhost:3000/api/barchart-prior", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location, date })
    });
    if (barchartRes.ok) {
      const barchartData = await barchartRes.json();
      freqs = barchartData.frequencies || {};
      regionCodeStr = barchartData.regionCode || "";
      regionNameStr = barchartData.regionName || "";
    }
  } catch (e) {
    console.error("Error fetching barchart prior", e);
  }

  // Find max frequency for normalization
  let maxFreq = 0;
  for (const f of Object.values(freqs)) {
    if (f > maxFreq) maxFreq = f;
  }

  // Pool of birds
  let pool = [...dataLoader.birdBase];

  // 1. Pro Family Filter
  if (experience === 'pro' && family && (!expandedFamilies || expandedFamilies.length === 0)) {
    pool = pool.filter(b => b.family_clements_ebird2024?.toLowerCase().includes(family.toLowerCase()));
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
    // If Colors = 1 and no match, we can eliminate, but for simplicity here we just score
    let colorScore = 0;
    if (bird.Colors !== -1) {
       // Look up color in basic or overall
       const colorEntry = dataLoader.colorsOverall.find(c => c.Scientific_name === bird.scientific_name);
       if (colorEntry && extracted.extracted_colors.length > 0) {
         let matches = 0;
         extracted.extracted_colors.forEach(c => {
            if (colorEntry.all_color?.includes(c.color.toLowerCase())) {
               matches++;
            }
         });
         const ratio = matches / extracted.extracted_colors.length;
         colorScore = ratio * 100;
       } else if (extracted.extracted_colors.length === 0) {
         colorScore = 100; // No color specified
       }
    } else {
       colorScore = 100; // Can't evaluate
    }
    score += colorScore;

    // Shape (100pts)
    let shapeScore = 0;
    if (extracted.extracted_shape_and_size.length > 0) {
       let matches = 0;
       // Simplified shape matching for prototype
       extracted.extracted_shape_and_size.forEach(shape => {
          if (shape.includes('long_beak') && bird.BeakL_Div_Tarsus > 1.2) matches++;
          if (shape.includes('stout_beak') && bird.Beak_Stoutness < 1.6) matches++;
          // add more shapes as needed
       });
       shapeScore = (matches / extracted.extracted_shape_and_size.length) * 100;
    } else {
       shapeScore = 100;
    }
    score += shapeScore;

    // Behavior (100pts)
    let behaviorScore = 0;
    if (extracted.extracted_behaviors.length > 0) {
      let matches = 0;
      extracted.extracted_behaviors.forEach(beh => {
         if (bird.Final_Behavior_1 === beh || bird.Final_Behavior_2 === beh || bird.Final_Behavior_3 === beh) {
            matches++;
         }
      });
      behaviorScore = (matches / extracted.extracted_behaviors.length) * 100;
    } else {
      behaviorScore = 100;
    }
    score += behaviorScore;

    // Normalize max score to 1.0 likelihood
    let likelihood = score / 300; 
    likelihood = Math.max(0.01, likelihood); // Ensure non-zero

    // Prior
    let ebirdPrior = 0;
    if (freqs[bird.common_name] !== undefined) {
      ebirdPrior = freqs[bird.common_name];
    } else {
      const match = Object.keys(freqs).find(k => k.toLowerCase().includes(bird.common_name.toLowerCase()));
      if (match) ebirdPrior = freqs[match];
    }
    
    let normalizedPrior = maxFreq > 0 ? ebirdPrior / maxFreq : -1;
    if (normalizedPrior !== -1) {
       normalizedPrior = Math.max(0.01, normalizedPrior);
    }

    if (likelihood > 0.3) {
      topFamiliesSet.add(bird.family_clements_ebird2024);
    }

    results.push({
      commonName: bird.common_name,
      scientificName: bird.scientific_name,
      description: `Matched with ${Math.round(likelihood * 100)}% visual similarity.`,
      prior: normalizedPrior,
      likelihood: likelihood,
      ebirdCode: '', // Would need to map if available
      posterior: normalizedPrior === -1 ? likelihood : normalizedPrior * likelihood,
      colorScore: colorScore,
      shapeScore: shapeScore,
      behaviorScore: behaviorScore
    });
  }

  // Normalize posteriors
  let totalPosterior = 0;
  results.forEach(r => totalPosterior += (r.posterior || 0));
  results.forEach(r => {
    r.posterior = totalPosterior > 0 ? (r.posterior! / totalPosterior) : 0;
  });

  results.sort((a, b) => (b.posterior || 0) - (a.posterior || 0));
  
  // Return top 10
  const topBirds = results.slice(0, 10).filter(r => (r.posterior || 0) > 0.01);

  return {
    type: "result",
    birds: topBirds,
    expandedFamilies: Array.from(topFamiliesSet).slice(0, 5), // Return up to 5 matching families
    allPoolBirds: results,
    ebirdRegionCode: regionCodeStr,
    ebirdRegionName: regionNameStr
  };
}
