import axios from 'axios';

async function testPublicBarchart() {
  const barchartUrl = `https://ebird.org/barchart?r=US-NY-109&bmo=1&emo=12&byr=1900&eyr=2026`;
  try {
    const res = await axios.get(barchartUrl, { 
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      } 
    });
    console.log(`Success, status: ${res.status}, length: ${res.data.length}`);
    if (res.data.includes("barchartData")) {
       console.log("HTML contains barchart data!");
    }
  } catch (e: any) {
    console.log(`Failed, status: ${e.response?.status}`);
    console.log(`Error message: ${e.message}`);
  }
}

testPublicBarchart();
