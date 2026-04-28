import { initEBird } from './ebirdBarchart';
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import fs from "fs/promises";

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

async function test() {
    await initEBird();
    const ebirdUser = process.env.EBIRD_USER || "olsonm";
    const ebirdPass = process.env.EBIRD_PASS || "Clar1n3tt0man";

    console.log("Logging into eBird (Cassso)...");
    const loginUrl = "https://secure.birds.cornell.edu/cassso/login?service=https%3A%2F%2Febird.org%2Flogin%2Fcas%2Fcheck";
    
    let getRes;
    try {
        getRes = await client.get(loginUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    } catch (e) {
        console.error("GET loginUrl failed", e);
        return;
    }

    const executionMatch = getRes.data.match(/name="execution" value="([^"]+)"/);
    const execution = executionMatch ? executionMatch[1] : "e1s1";

    const params = new URLSearchParams();
    params.append("username", ebirdUser);
    params.append("password", ebirdPass);
    params.append("execution", execution);
    params.append("_eventId", "submit");

    try {
        await client.post(loginUrl, params.toString(), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0"
            },
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 500
        });
        console.log("Login successful.");
    } catch (e) {
        console.error("POST loginUrl failed", e);
        return;
    }

    const ebirdUrl = `https://ebird.org/barchartData?r=US-PA-095&bmo=1&emo=12&byr=1900&eyr=2026&fmt=tsv`;
    try {
        const response = await client.get(ebirdUrl, {
            headers: { "User-Agent": "Mozilla/5.0" },
            maxRedirects: 5
        });
        
        const tsv = response.data;
        if (tsv.includes("<html") || tsv.trim().startsWith("<!DOCTYPE")) {
             console.log("Failed! eBird returned HTML instead of TSV.");
             await fs.writeFile("failed_response.html", tsv);
        } else {
             console.log("Success! eBird returned TSV. Length:", tsv.length);
        }
    } catch (err: any) {
        console.error("Download failed:", err);
    }
}

test();
