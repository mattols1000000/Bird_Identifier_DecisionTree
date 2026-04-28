import fs from "fs/promises";
import path from "path";
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

let ebirdUser = "";
let ebirdPass = "";
let regionList: Array<{ name: string; code: string; type: string }> = [];

export async function initEBird() {
  try {
    const content = await fs.readFile(path.join(process.cwd(), ".Renviron"), "utf-8");
    const mUser = content.match(/EBIRD_USER="([^"]+)"/);
    const mPass = content.match(/EBIRD_PASS="([^"]+)"/);
    if (mUser) ebirdUser = mUser[1];
    if (mPass) ebirdPass = mPass[1];
  } catch (e) {
    console.log("No .Renviron found or failed to parse credentials.");
  }

  try {
    const csvT = await fs.readFile(path.join(process.cwd(), "subnational2_name_code.csv"), "utf-8");
    const lines = csvT.split("\n").slice(1); // skip header
    for (const line of lines) {
      if (!line.trim()) continue;
      // Handle quoted names safely e.g. "San Mateo, CO",US-CO-...
      let name = "";
      let code = "";
      let type = "";
      if (line.startsWith('"')) {
        const quoteEnd = line.indexOf('"', 1);
        name = line.substring(1, quoteEnd).replace(/""/g, '"');
        const rest = line.substring(quoteEnd + 2).split(",");
        code = rest[0];
        type = rest[1];
      } else {
        const parts = line.split(",");
        name = parts[0];
        code = parts[1];
        type = parts[2];
      }
      regionList.push({ name, code, type });
    }
  } catch (e) {
    console.log("subnational2_name_code.csv not found.");
  }
}

async function loginToEBird() {
  if (!ebirdUser || !ebirdPass) {
    throw new Error("Missing eBird credentials. Please save them first.");
  }
  console.log("Logging into eBird (Cassso)...");

  // 1. Get login page to grab csrf/tokens if needed, but Cassso typically works with a form POST
  try {
    const loginUrl = "https://secure.birds.cornell.edu/cassso/login?service=https%3A%2F%2Febird.org%2Flogin%2Fcas%2Fcheck";

    // We get the form page first to establish JSESSIONID or similar
    const getRes = await client.get(loginUrl, { headers: { "User-Agent": "Mozilla/5.0" } });

    // Extract hidden form inputs, especially execution
    const executionMatch = getRes.data.match(/name="execution" value="([^"]+)"/);
    const execution = executionMatch ? executionMatch[1] : "e1s1";

    const params = new URLSearchParams();
    params.append("username", ebirdUser);
    params.append("password", ebirdPass);
    params.append("execution", execution);
    params.append("_eventId", "submit");

    const postRes = await client.post(loginUrl, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0"
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 500 // Allow 404 from CAS redirect
    });

    // As long as the request didn't throw a 5xx and we have a session cookie, it's fine.

    console.log("Login successful.");
  } catch (err) {
    console.error("Login failed:", err);
    throw err;
  }
}

function resolveWeekColName(dateStr: string): string {
  // eBird uses JanW1, JanW2, JanW3, JanW4
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "JanW1"; // fallback

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = months[d.getUTCMonth()];
  const day = d.getUTCDate();

  let w = 4;
  if (day <= 7) w = 1;
  else if (day <= 14) w = 2;
  else if (day <= 21) w = 3;

  return `${m}W${w}`;
}

export async function fetchBarchartPrior(location: string, dateStr: string) {
  // Use Gemini to match location to a region name in our CSV list
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const sampleRegions = regionList.slice(0, 100).map(r => r.name).join(", ") + "...";

  const prompt = `The user inputted the following location: "${location}".
Please identify the most specific administrative region name for this location that would likely appear in an eBird global region list. If it is in the US or another country with counties/provinces, output the County Name or Province name. For example, "Denver, CO" -> "Denver", "San Diego, California" -> "San Diego".
Return strictly a JSON object with the 'regionName' property containing your best guess.
{ "regionName": "..." }`;

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  const parsed = JSON.parse(response.text!);
  const regionNameGuess = parsed.regionName || location;

  console.log(`Resolved location "${location}" to region guess "${regionNameGuess}"`);

  // Find in our list
  // Try exact match
  let matchedRegion = regionList.find(r => r.name.toLowerCase() === regionNameGuess.toLowerCase());

  // Try includes match
  if (!matchedRegion) {
    matchedRegion = regionList.find(r => r.name.toLowerCase().includes(regionNameGuess.toLowerCase()) || regionNameGuess.toLowerCase().includes(r.name.toLowerCase()));
  }

  // Try split match (e.g. "Denver County")
  if (!matchedRegion) {
    const parts = regionNameGuess.split(" ");
    for (const p of parts) {
      if (p.length > 3) {
        const m = regionList.find(r => r.name.toLowerCase().includes(p.toLowerCase()));
        if (m) {
          matchedRegion = m;
          break;
        }
      }
    }
  }

  if (!matchedRegion) {
    throw new Error(`Could not resolve region code for location "${location}"`);
  }

  console.log(`Matched to ${matchedRegion.name} (${matchedRegion.code})`);

  await loginToEBird();

  let tsv = "";
  console.log(`Fetching eBird data for ${matchedRegion.name} (${matchedRegion.code})...`);
  const ebirdUrl = `https://ebird.org/barchartData?r=${matchedRegion.code}&bmo=1&emo=12&byr=1900&eyr=2026&fmt=tsv`;
  try {
    const response = await client.get(ebirdUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      maxRedirects: 5
    });
    tsv = response.data;
  } catch (err: any) {
    throw new Error(`Failed to fetch bar chart data from eBird for region ${matchedRegion.code}: ${err.message}`);
  }

  if (tsv.includes("<html") || tsv.trim().startsWith("<!DOCTYPE")) {
    throw new Error("Invalid TSV format: eBird returned an HTML page. This usually indicates your login credentials are not valid or the data is unable to be fetched from eBird.");
  }

  const lines = tsv.split("\n");

  // Find header row
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("Species") || lines[i].startsWith("ComName")) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) headerIndex = 13; // default fallback per SpeciesStatsApp
  if (headerIndex >= lines.length || lines[headerIndex] === undefined) {
    throw new Error("Invalid TSV format from eBird: could not locate the header row. Format may have changed.");
  }

  const headers = lines[headerIndex].split("\t");
  if (headers.length < 48 && !headers.some(h => h.includes("Jan") || h.includes("W1"))) {
    throw new Error(`Invalid TSV format from eBird: headers do not match expected weekly columns. Found ${headers.length} columns.`);
  }

  // Normalizing standard TSV to Weeks
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let expectedHeaders = ["Species"];
  for (const m of months) {
    for (let w = 1; w <= 4; w++) expectedHeaders.push(`${m}W${w}`);
  }

  // Find which column index we want
  const targetWeekColName = resolveWeekColName(dateStr);
  let targetColIndex = -1;

  if (headers.length >= 49) {
    targetColIndex = expectedHeaders.indexOf(targetWeekColName);
  } else {
    targetColIndex = headers.indexOf(targetWeekColName);
  }

  if (targetColIndex === -1) {
    throw new Error(`Could not find column for week ${targetWeekColName}`);
  }

  let maxFreq = 0;
  const frequencyMap: Record<string, number> = {};

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const parts = lines[i].split("\t");
    if (parts.length < targetColIndex) continue;

    let species = parts[0].trim();
    // Remove any Sample Size or taxonomic grouping prefixes
    if (species.startsWith("Sample Size")) continue;

    const freqStr = parts[targetColIndex];
    const freq = parseFloat(freqStr);
    if (!isNaN(freq)) {
      frequencyMap[species] = freq;
      if (freq > maxFreq) maxFreq = freq;
    }
  }

  // Normalize 0 to 100
  const normalized: Record<string, number> = {};
  for (const [spp, freq] of Object.entries(frequencyMap)) {
    if (maxFreq > 0) {
      normalized[spp] = (freq / maxFreq) * 100.0;
    } else {
      normalized[spp] = 0;
    }
  }

  return {
    regionName: matchedRegion.name,
    regionCode: matchedRegion.code,
    targetWeek: targetWeekColName,
    frequencies: normalized,
    maxFreqOriginal: maxFreq
  };
}
