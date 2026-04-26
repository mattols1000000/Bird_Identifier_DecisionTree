import { initEBird, fetchBarchartPrior } from './ebirdBarchart.js';

async function test() {
  await initEBird();
  try {
    const data = await fetchBarchartPrior("Ithaca, NY", "2026-04-26");
    console.log("Region:", data.regionName, data.regionCode);
    console.log("Max Freq:", data.maxFreqOriginal);
    console.log("Frequencies count:", Object.keys(data.frequencies).length);
    // Print top 5
    const top = Object.entries(data.frequencies).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log("Top 5:", top);
  } catch (e) {
    console.error(e);
  }
}

test();
