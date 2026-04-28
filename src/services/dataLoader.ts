import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// Define interfaces for our loaded data
export interface BirdBaseRecord {
  ioc151_species_id: string;
  common_name: string;
  scientific_name: string;
  family_clements_ebird2024: string;
  avg_mass: number;
  wing_length: number;
  BeakL_Div_Tarsus: number;
  Prop_Tail_Length: number;
  Prop_Leg_Length: number;
  Beak_Stoutness: number;
  Beak_CrossSect: number;
  HWI: number;
  Colors: number;
  Final_Behavior_1: string;
  Final_Behavior_2: string;
  Final_Behavior_3: string;
  behavior_colonial: number;
  behavior_social: number;
  behavior_pairs_or_family: number;
  behavior_singly_and_pairs: number;
  other_habitat_rank: number;
  other_habitat_description: string;
  [key: string]: any; // for habitat ranks and other columns
}

export interface ColorRecord {
  Common_name: string;
  Scientific_name: string;
  Sex: string;
  all_color: string;
  [key: string]: string; // for specific patches
}

export interface IncompatibleBehavior {
  Behavior_A: string;
  Behavior_B: string;
  Incompatible: number;
}

export interface NLPTranslation {
  Standard_Term: string;
  Alternative_Descriptions: string;
}

export interface TaxonomyRecord {
  TAXON_ORDER: number;
  CATEGORY: string;
  SPECIES_CODE: string;
  TAXON_CONCEPT_ID: string;
  PRIMARY_COM_NAME: string;
  SCI_NAME: string;
  ORDER: string;
  FAMILY: string;
  SPECIES_GROUP: string;
  REPORT_AS: string;
}

export class DataLoader {
  public birdBase: BirdBaseRecord[] = [];
  public colorsBasic: ColorRecord[] = [];
  public colorsOverall: ColorRecord[] = [];
  public colorsProfessional: ColorRecord[] = [];
  public incompatibleBehaviors: IncompatibleBehavior[] = [];
  public nlpBehaviors: NLPTranslation[] = [];
  public nlpBodyParts: NLPTranslation[] = [];
  public nlpColors: NLPTranslation[] = [];
  
  // Mapping of family string (e.g. "Struthionidae") to its common group (e.g. "Ostriches")
  public taxonomyMap: Map<string, { family: string; group: string }> = new Map();
  
  private basePath = path.resolve(process.cwd());

  private loadCsv<T>(filename: string): T[] {
    const filePath = path.join(this.basePath, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      return [];
    }
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        if (value === 'NA' || value === '') return null;
        // Try to cast to number if it looks like one, but only for certain headers
        if (!isNaN(Number(value))) {
           return Number(value);
        }
        return value;
      }
    });
    return records as T[];
  }

  public init() {
    console.log("Loading datasets into memory...");
    this.birdBase = this.loadCsv<BirdBaseRecord>('BIRDBASE_cleaned_Final_Behaviors_Imputed.csv');
    this.colorsBasic = this.loadCsv<ColorRecord>('ColorsBy_Species_Sex_BasicBodyparts.csv');
    this.colorsOverall = this.loadCsv<ColorRecord>('ColorsBy_Species_Sex_OverallColor.csv');
    this.colorsProfessional = this.loadCsv<ColorRecord>('ColorsBy_Species_Sex_Professional.csv');
    this.incompatibleBehaviors = this.loadCsv<IncompatibleBehavior>('Incompatible_Behaviors.csv');
    this.nlpBehaviors = this.loadCsv<NLPTranslation>('NLP_Translation_Behaviors.csv');
    this.nlpBodyParts = this.loadCsv<NLPTranslation>('NLP_Translation_BodyParts.csv');
    this.nlpColors = this.loadCsv<NLPTranslation>('NLP_Translation_Colors.csv');
    
    // Load and build taxonomy map
    const taxonomyRecords = this.loadCsv<TaxonomyRecord>('eBird_taxonomy_v2024.csv');
    for (const record of taxonomyRecords) {
      if (!record.FAMILY) continue;
      
      // The dataset often looks like: FAMILY="Struthionidae (Ostriches)", SPECIES_GROUP="Ostriches"
      // we extract the latin part "Struthionidae" to match `family_clements_ebird2024`
      const familyLatin = record.FAMILY.split(' (')[0].trim();
      
      if (!this.taxonomyMap.has(familyLatin)) {
        this.taxonomyMap.set(familyLatin, {
          family: record.FAMILY,
          group: record.SPECIES_GROUP || ''
        });
      }
    }
    
    console.log("Datasets loaded successfully.");
  }
}

export const dataLoader = new DataLoader();
// Call init later in server.ts
