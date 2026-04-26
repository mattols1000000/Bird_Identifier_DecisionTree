import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import fs from 'fs/promises';

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

async function testEBird(eyr: number) {
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

  const barchartUrl = `https://ebird.org/barchartData?r=US-NY-109&bmo=1&emo=12&byr=1900&eyr=${eyr}&fmt=tsv`;
  try {
    const res = await client.get(barchartUrl);
    console.log(`Success for eyr=${eyr}, status:`, res.status, `length:`, res.data.length);
  } catch (e: any) {
    console.log(`Failed for eyr=${eyr}, status:`, e.response?.status);
  }
}

async function run() {
  await testEBird(2025);
  await testEBird(2026);
}
run();
