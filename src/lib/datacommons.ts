import { supabase } from "@/integrations/supabase/client";

export interface DataCommonsParams {
  endpoint: 'observation' | 'node' | 'resolve' | 'sparql' | 'nl';
  params: Record<string, unknown>;
}

export async function queryDataCommons(request: DataCommonsParams) {
  const { data, error } = await supabase.functions.invoke('data-commons', {
    body: request,
  });

  if (error) throw new Error(error.message || 'Failed to query Data Commons');
  if (data?.error) throw new Error(data.error);
  return data;
}

// Convenience helpers
export async function getObservation(
  variableDcids: string[],
  entityDcids: string[],
  date: string = 'LATEST'
) {
  return queryDataCommons({
    endpoint: 'observation',
    params: {
      date,
      variable: { dcids: variableDcids },
      entity: { dcids: entityDcids },
      select: ['variable', 'entity', 'value', 'date'],
    },
  });
}

export async function getTimeSeries(
  variableDcids: string[],
  entityDcids: string[]
) {
  return queryDataCommons({
    endpoint: 'observation',
    params: {
      date: '',
      variable: { dcids: variableDcids },
      entity: { dcids: entityDcids },
      select: ['variable', 'entity', 'value', 'date'],
    },
  });
}

export async function naturalLanguageQuery(query: string) {
  return queryDataCommons({
    endpoint: 'nl',
    params: { query },
  });
}

export async function getNodeInfo(dcids: string[], expression: string) {
  return queryDataCommons({
    endpoint: 'node',
    params: { nodes: dcids, property: expression },
  });
}

// Nigerian states DCIDs
export const NIGERIA_DCID = 'country/NGA';

export const NIGERIAN_STATES: Record<string, string> = {
  'Abia': 'wikidataId/Q320588',
  'Adamawa': 'wikidataId/Q317109',
  'Akwa Ibom': 'wikidataId/Q320476',
  'Anambra': 'wikidataId/Q320485',
  'Bauchi': 'wikidataId/Q319175',
  'Bayelsa': 'wikidataId/Q320491',
  'Benue': 'wikidataId/Q319195',
  'Borno': 'wikidataId/Q319157',
  'Cross River': 'wikidataId/Q320470',
  'Delta': 'wikidataId/Q319182',
  'Ebonyi': 'wikidataId/Q320505',
  'Edo': 'wikidataId/Q319173',
  'Ekiti': 'wikidataId/Q317106',
  'Enugu': 'wikidataId/Q320523',
  'FCT': 'wikidataId/Q320057',
  'Gombe': 'wikidataId/Q319168',
  'Imo': 'wikidataId/Q320534',
  'Jigawa': 'wikidataId/Q317115',
  'Kaduna': 'wikidataId/Q317108',
  'Kano': 'wikidataId/Q319145',
  'Katsina': 'wikidataId/Q319162',
  'Kebbi': 'wikidataId/Q317113',
  'Kogi': 'wikidataId/Q319187',
  'Kwara': 'wikidataId/Q317110',
  'Lagos': 'wikidataId/Q319176',
  'Nasarawa': 'wikidataId/Q319192',
  'Niger': 'wikidataId/Q317111',
  'Ogun': 'wikidataId/Q319204',
  'Ondo': 'wikidataId/Q319200',
  'Osun': 'wikidataId/Q319197',
  'Oyo': 'wikidataId/Q319207',
  'Plateau': 'wikidataId/Q319165',
  'Rivers': 'wikidataId/Q319155',
  'Sokoto': 'wikidataId/Q317112',
  'Taraba': 'wikidataId/Q319152',
  'Yobe': 'wikidataId/Q319148',
  'Zamfara': 'wikidataId/Q317114',
};

// Key statistical variables for Nigeria
export const STAT_VARIABLES = {
  population: { dcid: 'Count_Person', label: 'Population', unit: '' },
  lifeExpectancy: { dcid: 'LifeExpectancy_Person', label: 'Life Expectancy', unit: 'years' },
  gdp: { dcid: 'Amount_EconomicActivity_GrossDomesticProduction_Nominal', label: 'GDP (Nominal)', unit: 'USD' },
  gdpPerCapita: { dcid: 'Amount_EconomicActivity_GrossDomesticProduction_Nominal_PerCapita', label: 'GDP Per Capita', unit: 'USD' },
  literacy: { dcid: 'Count_Person_LiteracyStatus_Literate_AsAFractionOfCount_Person_Age15Onwards', label: 'Literacy Rate', unit: '%' },
  co2Emissions: { dcid: 'Amount_Emissions_CarbonDioxide_PerCapita', label: 'CO₂ Emissions Per Capita', unit: 'tonnes' },
  unemployment: { dcid: 'UnemploymentRate_Person', label: 'Unemployment Rate', unit: '%' },
  infantMortality: { dcid: 'Count_Death_0Years_AsFractionOf_Count_BirthEvent_LiveBirth', label: 'Infant Mortality', unit: 'per 1,000' },
  electricityAccess: { dcid: 'Count_Person_IsInternetUser_PerCapita', label: 'Internet Users Per Capita', unit: '' },
  fertility: { dcid: 'FertilityRate_Person_Female', label: 'Fertility Rate', unit: 'births per woman' },
};

// Peer countries for comparison
export const PEER_COUNTRIES: Record<string, string> = {
  'Nigeria': 'country/NGA',
  'Ghana': 'country/GHA',
  'Kenya': 'country/KEN',
  'South Africa': 'country/ZAF',
  'Egypt': 'country/EGY',
  'Ethiopia': 'country/ETH',
  'Tanzania': 'country/TZA',
  'Senegal': 'country/SEN',
};
