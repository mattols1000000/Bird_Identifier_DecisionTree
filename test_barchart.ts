import { initEBird, fetchBarchartPrior } from "./ebirdBarchart.js";
import { GoogleGenAI } from "@google/genai";

async function main() {
  await initEBird();
  const data = await fetchBarchartPrior("New York, NY", "2026-05-15");
  console.log("Returned data length for frequencies:", Object.keys(data.frequencies || {}).length);
}

main().catch(console.error);
