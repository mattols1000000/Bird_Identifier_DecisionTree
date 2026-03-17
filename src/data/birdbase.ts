export interface BirdFeature {
  commonName: string;
  scientificName: string;
  description: string;
  size: string;
  habitat: string;
  overallColor: string;
  billColor: string;
  bellyColor: string;
  headColor: string;
}

export const birdbase: BirdFeature[] = [
  {
    commonName: "Northern Cardinal",
    scientificName: "Cardinalis cardinalis",
    description: "A fairly large, long-tailed bunting with a short, very thick bill and a prominent crest.",
    size: "Medium",
    habitat: "Forest",
    overallColor: "Red",
    billColor: "Orange",
    bellyColor: "Red",
    headColor: "Red"
  },
  {
    commonName: "Blue Jay",
    scientificName: "Cyanocitta cristata",
    description: "A large, crested songbird with broad, rounded wings.",
    size: "Medium",
    habitat: "Forest",
    overallColor: "Blue",
    billColor: "Black",
    bellyColor: "White",
    headColor: "Blue"
  },
  {
    commonName: "American Robin",
    scientificName: "Turdus migratorius",
    description: "A large, round-bodied thrush with long legs and a fairly long tail.",
    size: "Medium",
    habitat: "Urban",
    overallColor: "Gray",
    billColor: "Yellow",
    bellyColor: "Orange",
    headColor: "Black"
  },
  {
    commonName: "European Starling",
    scientificName: "Sturnus vulgaris",
    description: "Chunky and blackbird-sized, but with short tails and long, slender beaks.",
    size: "Small",
    habitat: "Urban",
    overallColor: "Black",
    billColor: "Yellow",
    bellyColor: "Black",
    headColor: "Black"
  },
  {
    commonName: "House Sparrow",
    scientificName: "Passer domesticus",
    description: "A chunky bird, fuller in the chest and with a larger, rounded head.",
    size: "Small",
    habitat: "Urban",
    overallColor: "Brown",
    billColor: "Black",
    bellyColor: "Gray",
    headColor: "Brown"
  },
  {
    commonName: "Downy Woodpecker",
    scientificName: "Dryobates pubescens",
    description: "A small version of the classic woodpecker body plan.",
    size: "Small",
    habitat: "Forest",
    overallColor: "Black and White",
    billColor: "Black",
    bellyColor: "White",
    headColor: "Black and White"
  },
  {
    commonName: "Hairy Woodpecker",
    scientificName: "Dryobates villosus",
    description: "A medium-sized woodpecker with a fairly square head, a long, straight, chisel-like bill, and stiff, long tail feathers.",
    size: "Medium",
    habitat: "Forest",
    overallColor: "Black and White",
    billColor: "Black",
    bellyColor: "White",
    headColor: "Black and White"
  }
];
