import { GoogleGenAI } from "@google/genai";
async function main() {
  const ai = new GoogleGenAI();
  const models = await ai.models.list();
  const names = [];
  for await (const m of models) {
    if (m.name.includes("gemini")) {
      names.push(m.name);
    }
  }
  console.log("Available Gemini models:", names);
}
main().catch(console.error);
