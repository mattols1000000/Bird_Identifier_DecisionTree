import fs from 'fs/promises';

async function testParsing() {
  const tsvRes = await fs.readFile('ebird_US-PA-095__1900_2026_1_12_barchart.txt', 'utf8');
  const lines = tsvRes.split("\n");
  
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("Species") || lines[i].startsWith("ComName")) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) headerIndex = 13;
  console.log(`Header index: ${headerIndex}`);
  
  const headers = lines[headerIndex].split("\t");
  console.log(`Headers length: ${headers.length}`);
  console.log(`Headers: `, headers);
  
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let expectedHeaders = ["Species"];
  for (const m of months) {
      for (let w = 1; w <= 4; w++) expectedHeaders.push(`${m}W${w}`);
  }
  
  const targetWeekColName = "AprW4";
  let targetColIndex = -1;
  
  if (headers.length >= 49) {
      targetColIndex = expectedHeaders.indexOf(targetWeekColName);
  } else {
      targetColIndex = headers.indexOf(targetWeekColName);
  }
  
  console.log(`Target week col name: ${targetWeekColName}`);
  console.log(`Target col index: ${targetColIndex}`);
  
  let maxFreq = 0;
  let count = 0;
  for (let i = headerIndex + 1; i < lines.length; i++) {
      const parts = lines[i].split("\t");
      if (parts.length < targetColIndex) continue;
      
      let species = parts[0].trim();
      if (species.startsWith("Sample Size") || !species) continue;
      
      const freqStr = parts[targetColIndex];
      const freq = parseFloat(freqStr);
      if (!isNaN(freq)) {
          count++;
          if (freq > maxFreq) maxFreq = freq;
      }
  }
  console.log(`Parsed ${count} species. Max freq: ${maxFreq}`);
}

testParsing();
