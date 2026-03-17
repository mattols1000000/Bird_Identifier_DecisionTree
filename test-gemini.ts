import { identifyBird } from './src/services/birdbaseService';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  try {
    const res = await identifyBird(
      "New York",
      "Today",
      "amateur",
      "",
      "Medium",
      "Flying",
      "Forest",
      "",
      [{ question: "What was the overall color?", answer: "Black and White" }]
    );
    console.log("SUCCESS:", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("ERROR:", err);
    if (err.response) {
      console.error("RESPONSE:", err.response);
    }
  }
}

test();
