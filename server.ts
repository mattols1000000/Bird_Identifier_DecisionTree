import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import path from "path";
import { pipeline, env } from "@xenova/transformers";
import { initEBird, fetchBarchartPrior } from "./ebirdBarchart.js";
import { dataLoader } from "./src/services/dataLoader.js";
import { identifyBirdLocal } from "./src/services/identifier.js";

// Disable local models to fetch from Hugging Face
env.allowLocalModels = false;

// In-memory store for the BIRDBASE dataset
let birdbaseData: any[] = [];
let extractor: any = null;

async function loadBirdbaseDataset() {
  try {
    dataLoader.init();
    console.log("Datasets initialized successfully.");
  } catch (error) {
    console.log("Failed to load datasets:", error);
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
  await initEBird();
  
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
      
      await initEBird();
      
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

  app.post("/api/barchart-prior", async (req, res) => {
    try {
      const { location, date } = req.body;
      if (!location || !date) {
        return res.status(400).json({ error: "location and date are required" });
      }
      const data = await fetchBarchartPrior(location, date);
      
      // Map eBird frequencies to unique SPECIES_GROUP families
      const availableFamiliesSet = new Set<string>();
      if (data.frequencies) {
        for (const ebirdName of Object.keys(data.frequencies)) {
          // Find the corresponding birdBase record
          const bird = dataLoader.birdBase.find(b => 
            b.common_name.toLowerCase() === ebirdName.toLowerCase() || 
            ebirdName.toLowerCase().includes(b.common_name.toLowerCase())
          );
          
          if (bird && bird.family_clements_ebird2024) {
            const taxonomy = dataLoader.taxonomyMap.get(bird.family_clements_ebird2024);
            if (taxonomy && taxonomy.group) {
              availableFamiliesSet.add(taxonomy.group);
            }
          }
        }
      }
      const availableFamilies = Array.from(availableFamiliesSet).sort();
      
      res.json({ ...data, availableFamilies });
    } catch (error: any) {
      console.error("Barchart fetch failed:", error);
      res.status(500).json({ error: error.message || "Failed to fetch barchart data" });
    }
  });

  app.get("/api/all-families", (req, res) => {
    try {
      const allGroups = new Set<string>();
      for (const taxonomy of dataLoader.taxonomyMap.values()) {
        if (taxonomy.group) {
          allGroups.add(taxonomy.group);
        }
      }
      res.json({ availableFamilies: Array.from(allGroups).sort() });
    } catch (error: any) {
      console.error("Failed to fetch all families:", error);
      res.status(500).json({ error: "Failed to fetch families" });
    }
  });

  app.post("/api/identify", async (req, res) => {
    try {
      const { location, date, experience, family, size, behavior, habitat, colors, qna, expandedFamilies } = req.body;
      const result = await identifyBirdLocal(location, date, experience, family, size, behavior, habitat, colors, qna, expandedFamilies);
      res.json(result);
    } catch (error: any) {
      console.error("Identification failed:", error);
      res.status(500).json({ error: error.message || "Failed to identify bird" });
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
