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
  expandedFamilies?: string[];
  allPoolBirds?: BirdResult[];
  ebirdRegionCode?: string;
  ebirdRegionName?: string;
}

export async function identifyBird(
  location: string,
  regionCode: string | undefined,
  date: string,
  experience: "pro" | "amateur",
  family: string | string[],
  size: string,
  behavior: string,
  habitat: string | string[],
  colors: string,
  shapeDescription: string,
  qna: { question: string; answer: string }[],
  expandedFamilies?: string[]
): Promise<AIResponse> {
  const payload = {
    location,
    regionCode,
    date,
    experience,
    family,
    size,
    behavior,
    habitat: Array.isArray(habitat) ? habitat.join(", ") : habitat,
    colors,
    shapeDescription,
    qna,
    expandedFamilies
  };

  const response = await fetch('/api/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errorMsg = "Failed to identify bird";
    try {
      const errorJson = await response.json();
      if (errorJson.error) {
        errorMsg = errorJson.error;
      }
    } catch {
      errorMsg = await response.text();
    }
    throw new Error(errorMsg);
  }

  const parsed = await response.json() as AIResponse;
  return parsed;
}
