import { fetchBarchartPrior, initEBird } from './ebirdBarchart';

async function test() {
    await initEBird();
    try {
        const data = await fetchBarchartPrior("Northampton, PA", "2024-05-15");
        console.log("Success! Region:", data.regionName);
        console.log("Max Freq:", data.maxFreqOriginal);
        console.log("Top 3 species:", Object.keys(data.frequencies).slice(0, 3));
    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
