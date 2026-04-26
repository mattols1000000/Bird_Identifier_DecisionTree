import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

async function testEBirdUrls() {
  const ebirdUser = "olsonm";
  const ebirdPass = "Clar1n3tt0man";
  
  const loginUrl = "https://secure.birds.cornell.edu/cassso/login?service=https%3A%2F%2Febird.org%2Flogin%2Fcas%2Fcheck";
  const getRes = await client.get(loginUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  const executionMatch = getRes.data.match(/name="execution" value="([^"]+)"/);
  const execution = executionMatch ? executionMatch[1] : "e1s1";

  const params = new URLSearchParams();
  params.append("username", ebirdUser);
  params.append("password", ebirdPass);
  params.append("execution", execution);
  params.append("_eventId", "submit");

  await client.post(loginUrl, params.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0"
    },
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 500
  });

  const urls = [
    `https://ebird.org/barchartData?r=US-NY-109&bmo=1&emo=12&byr=1900&eyr=2026&fmt=tsv`,
    `https://ebird.org/barchartData?r=US-NY-109&bmo=1&emo=12&byr=1900&eyr=2025&fmt=tsv`,
    `https://ebird.org/barchartData?r=US-NY-109&fmt=tsv`,
    `https://ebird.org/barchartData?r=US-NY-109&bmo=1&emo=12&fmt=tsv`,
    `https://ebird.org/barchartData?r=US-NY-109&bmo=1&emo=12&byr=1900&eyr=2024&fmt=tsv`,
  ];

  for (const url of urls) {
    try {
      const res = await client.get(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      console.log(`Success: ${url} -> status: ${res.status}, length: ${res.data.length}`);
    } catch (e: any) {
      console.log(`Failed: ${url} -> status: ${e.response?.status}`);
    }
  }
}

testEBirdUrls();
