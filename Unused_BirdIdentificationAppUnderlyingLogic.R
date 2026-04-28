##### Bird ID Application logic

### General Notes
# The last few columns at the end of the dataframe that begin wint "inferred_" followed by a column name state
# if the measurement in that column is inferred (1) or not (0). When we use these measurements, we should apply more generous bounds (25% more generous to the bin edges)
# for every time we use that measurement in our following identification logic

### Overview (Our Approach for replacing Gemini API for a mainly offline species Bird Identifier)
# Connect to a dataset that contains much information about every bird species in the world.
# Have Qwen 2.5 downloaded to do the interpretation of our natural language using the "NLP_Translation_....csv"s 
# to have a more robust understanding of what the user may be saying
# Directly use the data in the large dataset, and the county level data from eBird (contains the species frequency (hence probability) data for a location)
# the county level data from ebird will tell us what birds to initially have in our pool, and the large dataset
# will tell us all of the features of the birds we use for identification

## Qwen 2.5's Role
# Qwen's job is to read the user's physical description and output a JSON object with standard keys that match with our csvs information format:
# {"extracted_colors": [{"body_part": "Patch_Breast", "color": "rufous"}], "extracted_shape": "long_beak",
# "extracted_behaviors": ["Movement: Trunk-creeping"]}

## The similarity score, and the math associated with calculating it
'''
Colors (100pts)
- [ ] Excluding dissimilar birds: First, we go through the bird species in our master dataset with colors = 1. If the user’s description for the selected bodypart(s) does not match with any of the color descriptions for the bird in any color dataset, we can eliminate the bird species from our possible pool of birds
- [ ] If colors = -1, we give the bird species 0 points.
- [ ] For the remaining birds in the pool, if colors = 0 or 1, then for each color and corresponding body part that the user gives, we determine a percentage of matching color descriptions. For the color descriptions to match, the colors themselves to not actually have to be the same. Similar colors to the user’s description, like “light red” to “red”, will be treated as a match. If the color matching is not greater than or equal to 0.5, then we eliminate the bird species from our pool if colors = 1. If colors = 0, and the color matching ratio is less than 0.5, then we do not eliminate the bird species, but we do give 0 points out of 100 for the bird species in this section. If the color matching ratio is greater than or equal to 0.5, then we give ratio*100 total points to the bird species.

Shape (100pts)
- [ ] For each of these categories, of all of the non-NA values in each category, we find the upperh and lowerth percentiles for each. These act as soft bounds, such that “had a stout beak” means that the beak stoutness value must be greater than the upperth percentile value for beak stoutness, and a not very stout beak means the beak stoutness value is less than lowerth percentile. For the birds in our remaining pool, if the user states the bird of their interest is on one end of the extrema, we give 100/(number of shape descriptions that have a match in our dataset) for each of these bird species. If between lowerth and upperth percentile for that measurement, then we give 50/(number of shape descriptions that have a match in our dataset) for each of these bird species. The opposite should be true if the user believes the bird is on the lower end of the extrema. If the bird has an “average” or “middling” measurement in a category, then lowerth to upperth percentile get 100/(number of shape descriptions that have a match in our dataset) for each of these bird species, and all other bird species are eliminated from our pool of remaining bird species.
- [ ] Now, instead of using upperth and lowerth percentile for the extrema, we will use these:
  - [ ] Beak Length vs. Tarsus (BeakL_Div_Tarsus)
- [ ] "Short Beak" (e.g., Pigeons, Swallows): < 0.5
- [ ] "Average Beak" (e.g., Robins, Sparrows): 0.5 to 1.2
- [ ] "Long Beak" (e.g., Kingfishers, Herons, Hummingbirds): > 1.2
- [ ] Tail-to-Wing Ratio (Prop_Tail_Length)
- [ ] "Short Tail / No Tail" (e.g., Ducks, Starlings, Wrens): < 0.55
- [ ] "Average Tail" (e.g., Warblers, Finches): 0.55 to 0.85
- [ ] "Long Tail" (e.g., Magpies, Mockingbirds, Roadrunners): > 0.85
- [ ] Leg-to-Wing Ratio (Prop_Leg_Length)
- [ ] "Short Legs" (e.g., Swifts, Swallows, Kingfishers): < 0.15
- [ ] "Average Legs" (e.g., Crows, Songbirds): 0.15 to 0.35
- [ ] "Long Legs" (e.g., Herons, Cranes, Shorebirds): > 0.35
- [ ] Beak Stoutness (Beak_Length / Beak_Depth)
- [ ] Note: Because this is Length divided by Depth, a LOWER number means a stouter beak.
- [ ] "Stubby / Stout Beak" (e.g., Parrots, Grosbeaks, Finches): < 1.6
- [ ] "Average Beak": 1.6 to 3.0
- [ ] "Needle / Spear Beak" (e.g., Sandpipers, Hummingbirds): > 3.0
- [ ] Beak Cross-Section (Beak_Depth / Beak_Width)
- [ ] "Flat / Wide Beak" (e.g., Flycatchers, Ducks, Nightjars): < 0.95
- [ ] "Cone Beak" (e.g., Sparrows, Warblers): 0.95 to 1.3
- [ ] "Tall / Knife Beak" (e.g., Puffins, Hornbills, Cuckoos): > 1.3
- [ ] Hand-Wing Index (HWI)
- [ ] "Short / Rounded Wings" (e.g., Grouse, Wrens, Antpittas): < 20
- [ ] "Average Wings": 20 to 40
- [ ] "Long / Pointed Wings" (e.g., Falcons, Swallows, Terns): > 40


Behavior (100pts)
- [ ] Excluding birds from the pool of possible bird species- reference the Incompatible_Behaviors.csv. If a user gives a behavior description that includes a behavior that matches with a behavior that is incompatible with other behaviors according to the csv, then remove bird species in the pool which have the behavior(s) that are incompatible with those listed.
- [ ] Let’s say that Qwen extracts N behaviors from the user’s behavior description
- [ ] For each remaining bird species in our pool of birds we try to find the number of behaviors that the user has stated which match with a behavior for each species in the dataset
- [ ] For every matched behavior we add 100/(number of behaviors in dataset for the species) to our point total
'''

### Location and date
# Use user's eBird login to find the subnational2 (county) level data for their location at that given date in the subnational2 region's barchart data
# The date should be matched up with one checklist frequency value for each bird in the region which corresponds to the week-long period the date is in
# The checklist frequencies should be normalized from 0 through 1, such that the species with the highest frequency now has a normalized frequency of 1
# (for all species, freq_new = 1/freq_highest * freq_old) This forms the prior probability

### Pro birder and Amateur birder split
# The pro birder will be asked what families the bird could be within. There should be an option to select families from a dropdown menu
# Only include families that have freq > 0 for the set week range in the bar chart data
# After the pro birder enters the bird's family, they also are required to enter a physical description of the bird,
# to separate from other members of the same family. There will also be an interesting behaviors text box which is optional.
# This text box will search for bird species with differential behaviors from their family.
# It will not be used to modify the families the professional birder selected. 
# On the possible species page for pro birders, there will be an option at the bottom that asks "See results with these families included?",
# and listed below are bird families that appear in the area that had bird species that had high matching scores with their physical description.
# if this option is selected, present another option that asks if they would like to add more detail to any of the following
# to get a smaller pool of bird species, and below are the Amateur birders only options which they can check, and upon continuing, the amateur birder questions are asked, but the questions they answered were skipped


### How it looks (colors, shape, and size) ID logic
## Bird shape - beak length (BeakL_Div_Tarsus), Tail-to-Wing (Prop_Tail_Length), Leg-to-Wing (Prop_Leg_Length), Beak Stoutness, Beak Cross-Section, and HWI (hand wing index)
# use BeakL_Div_Tarsus for if it is > X, long/large beak/bill, if smaller than Y, short/small beak/bill

## Color
# if user states color data, identify the granularity of their info to determine what color df to reference
# of remaining bird species, look at their "Colors" values to determine if the color data can be used at all
# If Colors is -1, we can't reliably eliminate a bird from the possible species pool with color data
# If Colors is 0, we can't eliminate the species from the possble species pool with the color data, but we can learn if one of the sexes of the bird is a likely match (we only have data for one of the sexes)
# If Colors is 1, we can eliminate species from the possible species pool with the color data the user gives
# if a bird species+sex does not have info on color of bodypart X, move up a layer in granularity to see if there is a broader term with color data
# if not, then observe all_color for color info.
# if we ever have to move up a layer in granularity, this is weighed less than if there is a match for more granular level color data

## Size (Amateur birders only)
# We provide different bins of size for the user to choose from with visual aid.
# These bins are Sparrow-sized or smaller, Between Sparrow and Robin, Robin-sized, Between Robin and Crow, Crow-sized, Between Crow and Goose, Goose-sized or larger.
# These bins refer to very specific species: Sparrow: House Sparrow, Robin = American Robin, Crow = American Crow, Goose = Canada Goose. We will input images of the birds or silhouettes of the birds next to each other for comparison
# We internally reference master dataset's avg_mass and wing_length columns, for these birds. Of the bird remaining in the pool,
# if none of the two measurements is within the selected bin, we remove it from the pool of birds.
# for wing length, the bin sizes are: l<95.5, 75<l<110, 85<l<170, 110<l<300, 250<350, 300<l<425, 319<l
# for average mass, the bin sizes are m<41, 35<m<100, 60<m<120, 75<m<500, 250<m<700, 490<m<5000, 1250<m
# if for a given species the mass doesn't exist in avg_mass, then check the Avonet_Mass field for a non NA value
# these are not hard boundaries. Initially we keep the bin they chose and the adjacent bin(s).
# if a bird species that is only in adjacent bin(s) for each measurement is matching up well with other fields (color, behavior),
# then it should be included in the final possible species list

## Behavior (Amateur birders only)
# Behavior descriptions are matched to possible bird families, and individual bird species with diffeerential behavior(s) from their family
# If the number of birds observed is mentioned, we will use the four "behavior_..." columns in the dataframe:
# If the user states that the sighting was of a group of birds > 2, we remove birds from our possible species pool if all of the following equal 0:
# behavior_colonial, behavior_social, behavior_pairs_or_family


## Habitat (Amateur birders only)
# the user selects one or more of the habitats listed (from the birdbase habitat list) including the "Other" option,
# which requires a short description in a below textbox. If the description of the habitat is similar to a habitat that already exists in our dataset, we match their description with this habitat.
# If not, then we search the remaining pool of birds that have a non-NA value in their other habitat rank, and for those birds we see if there is a match in those species' other_habitat_description column.
# if a species is not in any of the bird species' selected habitats, then they are added to a hidden list of birds excluded from the possible bird list due to habitat
# if a species that was excluded for this reason matches up very well with other fields entered by the user, they are added to the final list of possible bird species

