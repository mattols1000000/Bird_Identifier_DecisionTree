import { identifyBird } from "./src/services/gemini.js";
import { initEBird } from "./ebirdBarchart.js";

const originalFetch = global.fetch;
(global as any).fetch = async (url: string, opts: any) => {
    if (url === "/api/barchart-prior") {
        const { fetchBarchartPrior } = await import("./ebirdBarchart.js");
        const body = JSON.parse(opts.body);
        try {
           const data = await fetchBarchartPrior(body.location, body.date, body.regionCode);
           return { ok: true, json: async () => data };
        } catch (e) {
           return { ok: false, text: async () => e.toString() };
        }
    }
    return originalFetch(url, opts);
};

async function main() {
  await initEBird();
  const res = await identifyBird(
    "New York, NY",
    "US-NY-061",
    "2026-05-15",
    "pro",
    "Passeridae",
    "",
    "",
    "Urban",
    "brown and grey, black bib",
    "",
    []
  );
  if (res.type === "result") {
      res.birds?.forEach(b => {
          console.log(b.commonName, "-> prior:", b.prior);
      });
  } else {
      console.log("Got question:", res.question);
  }
}
main().catch(console.error);
