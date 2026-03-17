import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Please add it to your .env file.");
    }
    if (apiKey === "your_actual_api_key_here" || apiKey.includes("your_actual_api_key_here")) {
      throw new Error("You are using the placeholder API key. Please replace 'your_actual_api_key_here' in your .env file with your real Gemini API key from Google AI Studio.");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export interface BirdResult {
  commonName: string;
  scientificName: string;
  description: string;
  prior: number;
  likelihood: number;
  posterior?: number;
  ebirdCode?: string;
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
  const prompt = `You are an expert ornithologist and bird identification assistant.
The user is trying to identify a bird they saw.

Here is the information gathered so far:
- Location: ${location}
- Date: ${date}
- User Experience Level: ${experience}
${experience === "pro" ? `- Suspected Family: ${family}` : `- Approximate Size: ${size}\n- Observed Behavior: ${behavior}`}
- Habitat: ${habitat}
- Colors/Markings: ${colors}

Previous Follow-up Questions and Answers:
${qna.map((q) => `Q: ${q.question}\nA: ${q.answer}`).join("\n")}

Based on this information, act as a decision tree algorithm.
When determining the size of a bird, you must use the BIRDBASE dataset standards for size comparison.
If the provided information is sufficient to narrow down the possibilities to a set of highly likely bird species, return a "result" with the list of birds. Do not artificially cap the number of birds; include all species that are strong matches based on the evidence.
If there are still many possibilities, return a "question" to ask the user a specific, distinguishing question to narrow down the options (e.g., "Did it have a white eye ring?", "Was the bill thick and conical or thin and pointed?").
If your question refers to a specific bird anatomy term (like "eye ring", "wing bar", "supercilium", "malar stripe", "undertail coverts", "patagials", "primary feathers", "secondary feathers", "outer-tail feathers"), provide that term in the "anatomyTerm" field so we can show a diagram to the user.

For the "result" type, provide a "prior" (a number between 0.01 and 0.99 representing how common the bird is in that location/date) and a "likelihood" (a number between 0.01 and 0.99 representing how well the bird matches the visual description).

Return the response strictly as a JSON object matching this schema.`;

  const aiInstance = getAI();
  const response = await aiInstance.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: "Either 'question' or 'result'",
            enum: ["question", "result"],
          },
          question: {
            type: Type.STRING,
            description: "The follow-up question to ask the user, if type is 'question'.",
          },
          anatomyTerm: {
            type: Type.STRING,
            description: "The specific bird anatomy term used in the question, if any.",
          },
          birds: {
            type: Type.ARRAY,
            description: "The list of all highly likely possible birds, if type is 'result'.",
            items: {
              type: Type.OBJECT,
              properties: {
                commonName: { type: Type.STRING },
                scientificName: { type: Type.STRING },
                description: { type: Type.STRING },
                prior: { type: Type.NUMBER, description: "P(Species) - How common is it (0.01 to 0.99)" },
                likelihood: { type: Type.NUMBER, description: "P(Description|Species) - How well it matches the description (0.01 to 0.99)" },
                ebirdCode: { type: Type.STRING, description: "The 6-letter eBird species code (e.g., 'mallar3' for Mallard). If unknown, provide a best guess or omit." },
              },
              required: ["commonName", "scientificName", "description", "prior", "likelihood"],
            },
          },
        },
        required: ["type"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response from AI");
  }

  const parsed = JSON.parse(text) as AIResponse;
  
  // Calculate Bayesian Posteriors if it's a result
  if (parsed.type === 'result' && parsed.birds) {
    let totalUnnormalized = 0;
    
    // Calculate unnormalized posteriors
    parsed.birds.forEach(bird => {
      const unnormalized = bird.prior * bird.likelihood;
      totalUnnormalized += unnormalized;
      (bird as any)._unnormalized = unnormalized;
    });
    
    // Normalize so they sum to 1.0 (or close to it)
    parsed.birds.forEach(bird => {
      bird.posterior = totalUnnormalized > 0 ? ((bird as any)._unnormalized / totalUnnormalized) : 0;
    });
    
    // Sort by posterior descending
    parsed.birds.sort((a, b) => (b.posterior || 0) - (a.posterior || 0));
  }
  
  return parsed;
}
