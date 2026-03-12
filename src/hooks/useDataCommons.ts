import { useQuery } from "@tanstack/react-query";
import { getObservation, getTimeSeries, naturalLanguageQuery, NIGERIA_DCID, STAT_VARIABLES, PEER_COUNTRIES } from "@/lib/datacommons";

export function useNigeriaOverview() {
  return useQuery({
    queryKey: ["nigeria-overview"],
    queryFn: async () => {
      const variables = [
        STAT_VARIABLES.population.dcid,
        STAT_VARIABLES.lifeExpectancy.dcid,
        STAT_VARIABLES.gdpPerCapita.dcid,
        STAT_VARIABLES.unemployment.dcid,
        STAT_VARIABLES.fertility.dcid,
        STAT_VARIABLES.co2Emissions.dcid,
        STAT_VARIABLES.infantMortality.dcid,
      ];
      
      const data = await getObservation(variables, [NIGERIA_DCID]);
      return data;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useTimeSeries(variableDcid: string, entityDcids: string[]) {
  return useQuery({
    queryKey: ["timeseries", variableDcid, entityDcids],
    queryFn: () => getTimeSeries([variableDcid], entityDcids),
    staleTime: 1000 * 60 * 30,
    enabled: entityDcids.length > 0 && !!variableDcid,
  });
}

export function useNLQuery(query: string) {
  return useQuery({
    queryKey: ["nl-query", query],
    queryFn: () => naturalLanguageQuery(query),
    enabled: !!query,
    staleTime: 1000 * 60 * 10,
  });
}

export function useCountryComparison(variableDcid: string, countryDcids: string[]) {
  return useQuery({
    queryKey: ["country-comparison", variableDcid, countryDcids],
    queryFn: () => getObservation([variableDcid], countryDcids),
    staleTime: 1000 * 60 * 30,
    enabled: countryDcids.length > 0 && !!variableDcid,
  });
}

// Parse observation response into a simple value
export function parseLatestValue(data: any, variableDcid: string, entityDcid: string): { value: number; date: string } | null {
  try {
    const facets = data?.byVariable?.[variableDcid]?.byEntity?.[entityDcid]?.orderedFacets;
    if (!facets || facets.length === 0) return null;
    const obs = facets[0].observations;
    if (!obs || obs.length === 0) return null;
    return { value: obs[0].value, date: obs[0].date };
  } catch {
    return null;
  }
}

// Parse time series into chart-friendly format
export function parseTimeSeries(data: any, variableDcid: string, entityDcid: string): { date: string; value: number }[] {
  try {
    const facets = data?.byVariable?.[variableDcid]?.byEntity?.[entityDcid]?.orderedFacets;
    if (!facets || facets.length === 0) return [];
    // Find the facet with most data points
    const bestFacet = facets.reduce((best: any, f: any) => 
      (f.obsCount || 0) > (best.obsCount || 0) ? f : best, facets[0]);
    return (bestFacet.observations || [])
      .map((o: any) => ({ date: o.date, value: o.value }))
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}
