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
  expandedFamilies?: string[];
  allPoolBirds?: BirdResult[];
  ebirdRegionCode?: string;
  ebirdRegionName?: string;
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
  qna: { question: string; answer: string }[],
  expandedFamilies?: string[]
): Promise<AIResponse> {
  const payload = {
    location,
    date,
    experience,
    family,
    size,
    behavior,
    habitat,
    colors,
    qna,
    expandedFamilies
  };

  const response = await fetch('/api/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to identify bird: ${errorText}`);
  }

  const parsed = await response.json() as AIResponse;
  return parsed;
}
