import fs from "fs/promises";
import path from "path";

const EBIRD_API_KEY = "8ei1ocpjne6v";
const HOTSPOTS_CSV = path.join(process.cwd(), "..", "SpeciesStatsApp", "ebird_hotspots_world_master.csv");
const OUTPUT_CSV = path.join(process.cwd(), "subnational2_name_code.csv");

async function fetchRegionName(regionCode: string, type: "country" | "subnational1" | "subnational2"): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`https://api.ebird.org/v2/ref/region/info/${regionCode}`, {
          headers: { "X-eBirdApiToken": EBIRD_API_KEY }
      });
      if (response.ok) {
          const data = await response.json() as any;
          return data.result || regionCode;
      }
    } catch (err) {}
    await new Promise(r => setTimeout(r, 100)); // wait before retry
  }
  return regionCode;
}

async function buildRegions() {
  console.log(`Reading hotspots from ${HOTSPOTS_CSV}...`);
  const content = await fs.readFile(HOTSPOTS_CSV, "utf-8");
  const lines = content.split('\n');
  
  const codeTypeMap = new Map<string, "subnational2" | "subnational1" | "country">();
  const countrySet = new Set<string>();
  const sub1Set = new Set<string>();
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (parts.length >= 5) {
      const countryCode = parts[2].trim();
      const sub1Code = parts[3].trim();
      const sub2Code = parts[4].trim();
      
      let bestCode = sub2Code;
      let type: "subnational2" | "subnational1" | "country" = "subnational2";
      if (!bestCode || bestCode === "NA" || bestCode === "null") {
        bestCode = sub1Code;
        type = "subnational1";
      }
      if (!bestCode || bestCode === "NA" || bestCode === "null") {
        bestCode = countryCode;
        type = "country";
      }
      
      if (bestCode && bestCode !== "NA") {
        codeTypeMap.set(bestCode, type);
      }
      
      if (countryCode && countryCode !== 'NA') countrySet.add(countryCode);
      if (sub1Code && sub1Code !== 'NA') sub1Set.add(sub1Code);
    }
  }

  console.log(`Found ${countrySet.size} countries, ${sub1Set.size} sub1s. Will utilize bulk lists to build fast.`);

  const nameMap = new Map<string, string>();

  // 1. Fetch Countries
  const cRes = await fetch("https://api.ebird.org/v2/ref/region/list/country/world", { headers: { "X-eBirdApiToken": EBIRD_API_KEY } });
  if (cRes.ok) {
    const list = await cRes.json() as any[];
    for (const item of list) {
        nameMap.set(item.code, item.name);
    }
  }

  // 2. Fetch Sub1s in parallel batches (max 50 at a time)
  const countries = Array.from(countrySet);
  console.log(`Fetching subnational1 regions for ${countries.length} countries...`);
  
  async function fetchSub1(cCode: string) {
    if (!cCode || cCode === 'NA') return;
    try {
        const res = await fetch(`https://api.ebird.org/v2/ref/region/list/subnational1/${cCode}`, { headers: { "X-eBirdApiToken": EBIRD_API_KEY } });
        if (res.ok) {
            const list = await res.json() as any[];
            for (const item of list) nameMap.set(item.code, item.name);
        }
    } catch(e) {}
  }

  for (let i = 0; i < countries.length; i += 50) {
    const batch = countries.slice(i, i + 50);
    await Promise.all(batch.map(fetchSub1));
  }

  // 3. Fetch Sub2s in parallel batches
  const sub1s = Array.from(sub1Set);
  console.log(`Fetching subnational2 regions for ${sub1s.length} territories...`);

  async function fetchSub2(sCode: string) {
    if (!sCode || sCode === 'NA') return;
    try {
        const res = await fetch(`https://api.ebird.org/v2/ref/region/list/subnational2/${sCode}`, { headers: { "X-eBirdApiToken": EBIRD_API_KEY } });
        if (res.ok) {
            const list = await res.json() as any[];
            for (const item of list) nameMap.set(item.code, item.name);
        }
    } catch(e) {}
  }

  for (let i = 0; i < sub1s.length; i += 50) {
    const batch = sub1s.slice(i, i + 50);
    await Promise.all(batch.map(fetchSub2));
    if ((i+50) % 500 === 0) console.log(`Fetched ${i+50} sub1 lists...`);
  }

  const uniqueCodes = Array.from(codeTypeMap.keys());
  const outputLines: string[] = ["RegionName,RegionCode,RegionType"];
  let missingCount = 0;
  
  for (const code of uniqueCodes) {
    const type = codeTypeMap.get(code)!;
    let name = nameMap.get(code);

    if (!name) {
       // fallback, fetch directly if somehow missing
       name = await fetchRegionName(code, type);
       missingCount++;
    }

    const cleanName = `"${name.replace(/"/g, '""')}"`;
    outputLines.push(`${cleanName},${code},${type}`);
  }
  
  console.log(`Missing count (fallback lookup): ${missingCount}`);
  await fs.writeFile(OUTPUT_CSV, outputLines.join('\n'));
  console.log(`Successfully generated ${OUTPUT_CSV} with ${uniqueCodes.length} entries.`);
}

buildRegions().catch(console.error);
