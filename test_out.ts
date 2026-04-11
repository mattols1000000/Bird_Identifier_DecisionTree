import { initEBird, fetchBarchartPrior } from "./ebirdBarchart.js";
async function main() {
  await initEBird();
  const data = await fetchBarchartPrior("New York, NY", "2026-05-15");
  const freqs = data.frequencies || {};
  const sorted = Object.entries(freqs).sort((a, b) => b[1] - a[1]);
  console.log(sorted.slice(0, 5));
}
main().catch(console.error);
