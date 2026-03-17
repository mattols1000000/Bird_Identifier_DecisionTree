import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import path from "path";
import { pipeline, env } from "@xenova/transformers";

// Disable local models to fetch from Hugging Face
env.allowLocalModels = false;

// In-memory store for the BIRDBASE dataset
let birdbaseData: any[] = [];
let extractor: any = null;

async function loadBirdbaseDataset() {
  try {
    const csvPath = path.join(process.cwd(), 'birdbase.csv');
    // We will parse this CSV later when you provide it locally
    const fileContent = await fs.readFile(csvPath, 'utf-8');
    console.log(`Successfully loaded birdbase.csv (${fileContent.length} bytes)`);
    // TODO: Parse CSV into birdbaseData array
  } catch (error) {
    console.log("birdbase.csv not found yet. Please add it to the root directory.");
  }
}

async function initML() {
  console.log("Initializing ML model (this may take a moment to download the first time)...");
  try {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log("ML model loaded successfully.");
  } catch (error) {
    console.error("Failed to load ML model:", error);
  }
}

async function startServer() {
  await loadBirdbaseDataset();
  await initML();
  
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/ebird-credentials", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      const renvironContent = `EBIRD_USER="${username}"\nEBIRD_PASS="${password}"\n`;
      await fs.writeFile(path.join(process.cwd(), '.Renviron'), renvironContent);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to write .Renviron", error);
      res.status(500).json({ error: "Failed to save credentials" });
    }
  });

  app.post("/api/embed", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "Text is required" });
      if (!extractor) return res.status(500).json({ error: "ML model not loaded yet" });

      // Generate embedding
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      
      // Convert Float32Array to standard array for JSON
      const embedding = Array.from(output.data);
      
      res.json({ embedding });
    } catch (error) {
      console.error("Embedding failed:", error);
      res.status(500).json({ error: "Failed to generate embedding" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
