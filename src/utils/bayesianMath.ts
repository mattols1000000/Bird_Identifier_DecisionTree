export interface BirdCandidate {
  id: string;
  commonName: string;
  scientificName: string;
  prior: number; // P(Species) - Base probability of seeing this bird
  embedding: number[]; // The 384-dimensional vector from the Synthetic Trait String
  imageUrl?: string;
  description?: string;
}

export interface BayesianResult extends BirdCandidate {
  similarity: number; // Cosine similarity [-1, 1]
  likelihood: number; // P(Description | Species)
  unnormalizedPosterior: number; // Likelihood * Prior
  posterior: number; // P(Species | Description) - Final normalized confidence
}

/**
 * Calculates the cosine similarity between two vectors.
 * Returns a value between -1 and 1.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must be of the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Converts cosine similarity to a likelihood probability.
 * We use an exponential function to exaggerate the differences between
 * highly similar and somewhat similar vectors.
 * 
 * @param similarity Cosine similarity [-1, 1]
 * @param temperature Controls the "sharpness" of the likelihood. Higher = sharper.
 */
export function calculateLikelihood(similarity: number, temperature: number = 5): number {
  // If similarity is negative, the likelihood is effectively zero
  if (similarity < 0) return 0;
  
  // Exponential scaling to turn similarity into a strict positive likelihood
  return Math.exp(similarity * temperature);
}

/**
 * Performs the Bayesian update across all candidate birds.
 * 
 * Bayes' Theorem: P(Species | Description) = [ P(Description | Species) * P(Species) ] / P(Description)
 * 
 * @param queryEmbedding The embedding of the user's description
 * @param candidates The list of possible birds with their priors and embeddings
 * @returns Sorted list of birds with their updated posterior probabilities
 */
export function calculatePosteriors(
  queryEmbedding: number[],
  candidates: BirdCandidate[]
): BayesianResult[] {
  let totalUnnormalizedPosterior = 0;

  // Step 1: Calculate Likelihoods and Unnormalized Posteriors
  const results: BayesianResult[] = candidates.map(bird => {
    // P(Description | Species)
    const similarity = cosineSimilarity(queryEmbedding, bird.embedding);
    const likelihood = calculateLikelihood(similarity);
    
    // Numerator of Bayes' Theorem: P(Description | Species) * P(Species)
    const unnormalizedPosterior = likelihood * bird.prior;
    
    totalUnnormalizedPosterior += unnormalizedPosterior;

    return {
      ...bird,
      similarity,
      likelihood,
      unnormalizedPosterior,
      posterior: 0 // Will be set in Step 2
    };
  });

  // Step 2: Normalize (Divide by Evidence / P(Description))
  // This ensures all probabilities sum to 1.0 (100%)
  results.forEach(res => {
    res.posterior = totalUnnormalizedPosterior > 0 
      ? res.unnormalizedPosterior / totalUnnormalizedPosterior 
      : 0;
  });

  // Step 3: Sort by highest posterior probability
  return results.sort((a, b) => b.posterior - a.posterior);
}
