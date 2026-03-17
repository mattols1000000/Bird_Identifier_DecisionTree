import { birdbase, BirdFeature } from '../data/birdbase';

export interface BirdResult {
  commonName: string;
  scientificName: string;
  description: string;
  prior: number;
  likelihood: number;
  posterior?: number;
}

export interface AIResponse {
  type: "question" | "result";
  question?: string;
  anatomyTerm?: string;
  birds?: BirdResult[];
}

export async function identifyBird(
  location: string,
  date: string,
  experience: "pro" | "amateur",
  family: string,
  size: string,
  behavior: string,
  habitat: string,
  colors: string,
  qna: { question: string; answer: string }[]
): Promise<AIResponse> {
  // 1. Start with all birds
  let possibleBirds = [...birdbase];

  // 2. Initial filtering (very basic, case-insensitive)
  if (size) {
    possibleBirds = possibleBirds.filter(b => b.size.toLowerCase().includes(size.toLowerCase()) || size.toLowerCase().includes(b.size.toLowerCase()));
  }
  if (habitat) {
    possibleBirds = possibleBirds.filter(b => b.habitat.toLowerCase().includes(habitat.toLowerCase()) || habitat.toLowerCase().includes(b.habitat.toLowerCase()));
  }
  if (colors) {
    // If user provided colors, try to match overallColor
    possibleBirds = possibleBirds.filter(b => 
      colors.toLowerCase().includes(b.overallColor.toLowerCase()) || 
      b.overallColor.toLowerCase().includes(colors.toLowerCase())
    );
  }

  // If initial filtering removed everything, revert to all birds to avoid dead ends
  if (possibleBirds.length === 0) {
    possibleBirds = [...birdbase];
  }

  // 3. Apply QnA filters
  for (const qa of qna) {
    const q = qa.question.toLowerCase();
    const a = qa.answer.toLowerCase();
    
    // Determine which feature the question was about
    let featureKey: keyof BirdFeature | null = null;
    if (q.includes("overall color")) featureKey = "overallColor";
    else if (q.includes("bill color")) featureKey = "billColor";
    else if (q.includes("belly color")) featureKey = "bellyColor";
    else if (q.includes("head color")) featureKey = "headColor";

    if (featureKey) {
      possibleBirds = possibleBirds.filter(b => {
        const val = String(b[featureKey]).toLowerCase();
        // If the answer matches the feature value
        return a.includes(val) || val.includes(a);
      });
    }
  }

  // If filtering removed everything, just return a generic result or the last known state
  // For simplicity, if 0, we'll just return a fallback
  if (possibleBirds.length === 0) {
    return {
      type: "result",
      birds: [
        {
          commonName: "Unknown Bird",
          scientificName: "Aves sp.",
          description: "We couldn't narrow it down with the given characteristics.",
          prior: 0.5,
          likelihood: 0.5,
          posterior: 1.0
        }
      ]
    };
  }

  // 4. Check if we have separating characteristics
  const featuresToCheck: (keyof BirdFeature)[] = ["overallColor", "billColor", "bellyColor", "headColor"];
  
  let bestFeatureToAsk: keyof BirdFeature | null = null;
  
  for (const feature of featuresToCheck) {
    // Have we already asked about this feature?
    const alreadyAsked = qna.some(qa => qa.question.toLowerCase().includes(feature.replace(/([A-Z])/g, ' $1').toLowerCase()));
    if (alreadyAsked) continue;

    // Check unique values for this feature among possible birds
    const uniqueValues = new Set(possibleBirds.map(b => b[feature]));
    if (uniqueValues.size > 1) {
      bestFeatureToAsk = feature;
      break;
    }
  }

  // 5. If we have a separating characteristic and more than 1 bird, ask a question
  if (bestFeatureToAsk && possibleBirds.length > 1) {
    const featureName = bestFeatureToAsk.replace(/([A-Z])/g, ' $1').toLowerCase(); // e.g., "billColor" -> "bill color"
    const uniqueValues = Array.from(new Set(possibleBirds.map(b => b[bestFeatureToAsk!])));
    
    const anatomyTerm = bestFeatureToAsk === 'overallColor' ? undefined : bestFeatureToAsk.replace('Color', '');
    
    return {
      type: "question",
      question: `What was the ${featureName}? (e.g., ${uniqueValues.join(', ')})`,
      anatomyTerm
    };
  }

  // 6. Otherwise, return the remaining birds as results
  const results: BirdResult[] = possibleBirds.slice(0, 3).map(b => ({
    commonName: b.commonName,
    scientificName: b.scientificName,
    description: b.description,
    prior: 0.5, // Dummy values since we aren't using Gemini's probabilities
    likelihood: 0.8,
    posterior: 1.0 / possibleBirds.length
  }));

  return {
    type: "result",
    birds: results
  };
}
