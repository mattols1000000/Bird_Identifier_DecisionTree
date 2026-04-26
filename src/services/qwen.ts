import fs from 'fs';
import path from 'path';

export interface QwenExtractedData {
  extracted_colors: { body_part: string; color: string }[];
  extracted_shape_and_size: string[];
  extracted_behaviors: string[];
  extracted_habitat: {
    standard_habitat_match: string | null;
    habitat_raw_description: string | null;
  };
}

export async function extractBirdFeatures(userInput: string): Promise<QwenExtractedData> {
  const promptPath = path.resolve(process.cwd(), 'Bird_ID_Qwen2.5_Prompt.md');
  const systemPrompt = fs.readFileSync(promptPath, 'utf-8');

  // We append the user's input to the system prompt
  const fullPrompt = `${systemPrompt}\n\nUser Description:\n${userInput}\n\nPlease output the JSON object now:`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen2.5',
        prompt: fullPrompt,
        stream: false,
        format: 'json',
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const resultText = data.response;
    
    // Parse the JSON
    const parsed = JSON.parse(resultText) as QwenExtractedData;
    return parsed;
  } catch (error) {
    console.error("Error communicating with Ollama Qwen2.5:", error);
    // Return empty fallback on error
    return {
      extracted_colors: [],
      extracted_shape_and_size: [],
      extracted_behaviors: [],
      extracted_habitat: { standard_habitat_match: null, habitat_raw_description: null }
    };
  }
}
