import { initEBird, fetchBarchartPrior } from "./ebirdBarchart.js";
import fs from "fs/promises";
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
async function main() {
  await initEBird();
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));
  
  const content = await fs.readFile(".Renviron", "utf-8");
  const ebirdUser = content.match(/EBIRD_USER="([^"]+)"/)[1];
  const ebirdPass = content.match(/EBIRD_PASS="([^"]+)"/)[1];
  
  const loginUrl = "https://secure.birds.cornell.edu/cassso/login?service=https%3A%2F%2Febird.org%2Flogin%2Fcas%2Fcheck";
  const getRes = await client.get(loginUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  const execution = getRes.data.match(/name="execution" value="([^"]+)"/)[1];
  const params = new URLSearchParams();
  params.append("username", ebirdUser);
  params.append("password", ebirdPass);
  params.append("execution", execution);
  params.append("_eventId", "submit");
  await client.post(loginUrl, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" },
    maxRedirects: 5, validateStatus: (s) => s >= 200 && s < 500
  });

  const barchartUrl = `https://ebird.org/barchartData?r=US-NY-061&bmo=1&emo=12&byr=1900&eyr=2026&fmt=tsv`;
  const tsvRes = await client.get(barchartUrl);
  const lines = (tsvRes.data).split("\n");
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("Species") || lines[i].startsWith("ComName")) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) headerIndex = 13;
  const headers = lines[headerIndex].split("\t");
  console.log("Headers length:", headers.length);
  console.log("Headers preview:", headers.slice(0, 5));
  console.log("Sample First Row Data:", lines[headerIndex+1].split("\t").slice(0,5));
}
main().catch(console.error);
