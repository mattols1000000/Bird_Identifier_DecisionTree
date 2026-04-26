import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import fs from 'fs/promises';

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

async function testEBird() {
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

  const postRes = await client.post(loginUrl, params.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0"
    },
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 500
  });

  console.log("Post status:", postRes.status);
  console.log("Post final URL:", postRes.request?.res?.responseUrl || postRes.request?.res?.url || "Unknown");
  
  const cookies = await jar.getCookies("https://ebird.org");
  console.log("Cookies for ebird.org:");
  cookies.forEach(c => console.log(c.key, "=", c.value));

}

testEBird();
