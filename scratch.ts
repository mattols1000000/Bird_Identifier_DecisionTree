import fs from "fs/promises";
import path from "path";

function resolveWeekColName(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "JanW1";

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = months[d.getUTCMonth()];
  const day = d.getUTCDate();

  let w = 4;
  if (day <= 7) w = 1;
  else if (day <= 14) w = 2;
  else if (day <= 21) w = 3;

  return `${m}W${w}`;
}

async function test() {
  const tsv = await fs.readFile(path.join(process.cwd(), "ebird_US-PA-095__1900_2026_1_12_barchart.txt"), "utf-8");
  const lines = tsv.split("\n");

  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("Species") || lines[i].startsWith("ComName")) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) headerIndex = 13; 
  console.log("Header index:", headerIndex);
  
  const headers = lines[headerIndex].split("\t");
  console.log("Headers length:", headers.length);
  console.log("Headers sample:", headers.slice(0, 5));

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let expectedHeaders = ["Species"];
  for (const m of months) {
    for (let w = 1; w <= 4; w++) expectedHeaders.push(`${m}W${w}`);
  }

  const targetWeekColName = resolveWeekColName("2024-01-05");
  let targetColIndex = -1;

  if (headers.length >= 49) {
    targetColIndex = expectedHeaders.indexOf(targetWeekColName);
  } else {
    targetColIndex = headers.indexOf(targetWeekColName);
  }
  console.log("Target col index:", targetColIndex);
  
  // Data extraction
  for (let i = headerIndex + 1; i < headerIndex + 5; i++) {
     const parts = lines[i].split("\t");
     console.log("Line parts length:", parts.length);
     console.log("Species:", parts[0]);
     console.log("Value:", parts[targetColIndex]);
  }
}
test();
