##### Strict TypeScript Bayesian Logic Mapping

### 1. Data Collection & Pre-processing
# 1a. User Location -> eBird Data
# The user enters a location and date. The app resolves this to a county-level `subnational2` code (e.g., "US-PA-095").
# A backend script fetches the historic eBird barchart TSV data for that specific county and parses it.
# It extracts the observation frequencies (e.g., 0.809) for all species present in that region during the specific week the user's date falls into.
# The maximum frequency observed among all species in that week is stored as `maxFreq` for normalization.

# 1b. NLP Extraction via Gemini
# The user provides unstructured text about the bird's size, behavior, habitat, and colors.
# Gemini parses this string and returns a JSON object mapping to exact categories:
# {"extracted_colors": [...], "extracted_shape_and_size": [...], "extracted_behaviors": [...]}

### 2. Filtering the Master Pool
# The entire BIRDBASE dataset is loaded into memory as `pool`.

# 2a. Professional Birder Family Filter
# If the user selects the "Pro" track, they select one or multiple Bird Families (SPECIES_GROUP names like "Ostriches").
# The pool is filtered by checking if the user's selected families match (via substring):
# - The master dataset's `family_clements_ebird2024` Latin string
# - The eBird taxonomy's `FAMILY` Latin string
# - The eBird taxonomy's `SPECIES_GROUP` common name
# If the user clicks "See results with these families included?" from a previous search, the pool is explicitly filtered to the `expandedFamilies` array instead.

# 2b. Amateur Birder Size Filter
# If the user selects the "Amateur" track, they choose a mass/size bin.
# We convert their selection into hard `minM` and `maxM` bounds, expanded slightly for overlap:
# "Sparrow-sized or smaller": <= 35
# "Between Sparrow and Robin": 20-100
# "Robin-sized": 60-120
# "Between Robin and Crow": 75-500
# "Crow-sized": 250-700
# "Between Crow and Goose": 400-5000
# "Goose-sized": >= 1250
# The pool is filtered so that `b.avg_mass` (or `b.Avonet_Mass`) falls between these bounds. If a species has NO mass data, it skips filtering and is kept.

### 3. Scoring (Likelihood) Calculation
# Each remaining bird in the pool starts with a score of 0, out of a maximum of 300.

# 3a. Color (100 pts)
# If we have color data for the species (`bird.Colors !== -1`), we look up the `all_color` string for that species.
# For each color extracted by Gemini, we check if it is a substring within the `all_color` data.
# We take the number of matching colors divided by the total extracted colors to get a `ratio`.
# `colorScore = ratio * 100`
# If the user provided no colors, `colorScore = 100`. If data is missing for the bird, `colorScore = 100`.

# 3b. Shape (100 pts)
# We search for each extracted shape descriptor in the bird's `family_clements_ebird2024`, `order_name`, `genus_name`, and `primary_habitat`.
# `ratio = matches / total_extracted_shapes`.
# `shapeScore = ratio * 100`.
# If the user provided no shapes, `shapeScore = 100`.

# 3b. Behavior (100 pts)
# We search for each extracted behavior in the bird's `Final_Behavior_1`, `Final_Behavior_2`, and `Final_Behavior_3`.
# `ratio = matches / total_extracted_behaviors`.
# `behaviorScore = ratio * 100`.
# If the user provided no behaviors, `behaviorScore = 100`.

# Total Likelihood:
# `score = colorScore + shapeScore + behaviorScore`
# `likelihood = score / 300`. A floor of `0.01` is applied to ensure no likelihood is identically zero.

### 4. Bayesian Posterior Calculation
# 4a. Matching eBird Frequencies
# The script attempts to find the bird's `common_name` in the dictionary of frequencies fetched from the eBird TSV.
# If an exact match fails, it searches for a partial substring match.
# If a match is found, that frequency is set as `ebirdPrior`. Otherwise, `ebirdPrior = 0`.

# 4b. Normalizing the Prior
# If the eBird barchart fetch was successful (`maxFreq > 0`), we calculate `normalizedPrior = ebirdPrior / maxFreq`.
# If the eBird barchart fetch failed, `normalizedPrior = -1` to explicitly indicate unavailability.

# 4c. Posterior Product
# `posterior = normalizedPrior * likelihood`. 
# (If data was unavailable, `posterior` simply equals `likelihood`).

### 5. Final Output & Recommendations
# If a bird achieves a `likelihood > 0.3` (30% visual match), its family is logged into a `topFamiliesSet`.
# All birds are sorted in descending order based on their `normalizedPrior`.
# The top 10 birds with a `posterior > 0.01` are returned to the user as the final recommendations.
# The top 5 matched families are returned as suggestions for the user to optionally "Expand" in a follow-up query.
