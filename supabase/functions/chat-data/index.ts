import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const DATA_COMMONS_API = 'https://api.datacommons.org/v2/observation'

// Key indicators the AI can request
const AVAILABLE_INDICATORS: Record<string, { dcid: string; label: string }[]> = {
  economics: [
    { dcid: 'Amount_EconomicActivity_GrossDomesticProduction_Nominal_PerCapita', label: 'GDP Per Capita (USD)' },
    { dcid: 'UnemploymentRate_Person', label: 'Unemployment Rate (%)' },
    { dcid: 'Amount_EconomicActivity_GrossDomesticProduction_Nominal', label: 'GDP Nominal (USD)' },
  ],
  demographics: [
    { dcid: 'Count_Person', label: 'Total Population' },
    { dcid: 'FertilityRate_Person_Female', label: 'Fertility Rate' },
    { dcid: 'GrowthRate_Count_Person', label: 'Population Growth Rate' },
  ],
  health: [
    { dcid: 'LifeExpectancy_Person', label: 'Life Expectancy (years)' },
    { dcid: 'Count_Death_0Years_AsFractionOf_Count_BirthEvent_LiveBirth', label: 'Infant Mortality Rate' },
  ],
  education: [
    { dcid: 'Count_Person_EnrolledInSchool', label: 'School Enrollment' },
  ],
  agriculture: [
    { dcid: 'Area_Farm', label: 'Agricultural Land (hectares)' },
  ],
  environment: [
    { dcid: 'Amount_Emissions_CarbonDioxide_PerCapita', label: 'CO2 Emissions Per Capita (tonnes)' },
  ],
  infrastructure: [
    { dcid: 'Count_Person_IsInternetUser_PerCapita', label: 'Internet Users (% of population)' },
  ],
}

async function fetchDataCommons(apiKey: string, dcids: string[]): Promise<Record<string, { value: number; date: string }>> {
  const resp = await fetch(DATA_COMMONS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({
      date: 'LATEST',
      variable: { dcids },
      entity: { dcids: ['country/NGA'] },
      select: ['variable', 'entity', 'value', 'date'],
    }),
  })

  if (!resp.ok) return {}
  const data = await resp.json()

  const results: Record<string, { value: number; date: string }> = {}
  for (const dcid of dcids) {
    try {
      const facets = data?.byVariable?.[dcid]?.byEntity?.['country/NGA']?.orderedFacets
      if (!facets?.length || !facets[0].observations?.length) continue
      const obs = facets[0].observations
      const latest = obs[obs.length - 1]
      results[dcid] = { value: latest.value, date: latest.date }
    } catch { /* skip */ }
  }
  return results
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const AZURE_KEY = Deno.env.get('AZURE_OPENAI_API_KEY')
  const AZURE_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT')
  const DC_API_KEY = Deno.env.get('DATA_COMMONS_API_KEY') || ''

  if (!AZURE_KEY || !AZURE_ENDPOINT) {
    return new Response(JSON.stringify({ error: 'AI not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { messages } = await req.json()
    if (!messages?.length) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 1: Determine which indicators are relevant to the conversation
    const userQuery = messages[messages.length - 1]?.content || ''
    const allDcids: string[] = []
    const dcidLabelMap: Record<string, string> = {}

    // Collect all available indicators
    for (const indicators of Object.values(AVAILABLE_INDICATORS)) {
      for (const ind of indicators) {
        allDcids.push(ind.dcid)
        dcidLabelMap[ind.dcid] = ind.label
      }
    }

    // Step 2: Fetch all Nigeria data from Data Commons
    const dcData = await fetchDataCommons(DC_API_KEY, [...new Set(allDcids)])

    // Build data context string
    const dataLines: string[] = []
    for (const [dcid, obs] of Object.entries(dcData)) {
      const label = dcidLabelMap[dcid] || dcid
      dataLines.push(`${label}: ${obs.value} (as of ${obs.date})`)
    }
    const dataContext = dataLines.length > 0
      ? `\n\nLIVE NIGERIA DATA (from official sources via Data Commons — World Bank, UN, WHO):\n${dataLines.join('\n')}`
      : '\n\n[No live data available at this moment]'

    const today = new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    const systemPrompt = `You are **NDIP Intelligence**, the AI analyst for the Nigeria Data Intelligence Platform (ndip.ng). Today is ${today}.

You have access to live, official Nigeria data from the World Bank, United Nations, and WHO (provided below). Use this data to ground every response.

YOUR ROLE:
- Answer questions about Nigeria's economy, health, education, demographics, infrastructure, agriculture, environment, security, and governance
- Contextualize raw data with current affairs, trends, policy implications, and real-world relevance
- Compare Nigeria to regional peers (Ghana, Kenya, South Africa, Egypt) and global benchmarks
- Write like a Bloomberg/Economist intelligence analyst — confident, data-driven, insightful
- Flag risks, opportunities, and what to watch
- When the data supports it, note historical trends and trajectory

FORMATTING:
- Use markdown for structure (headers, bold, lists) to make responses scannable
- Lead with the most important insight
- Include specific numbers from the data provided
- Keep responses focused and actionable (3-6 paragraphs unless asked for more)

${dataContext}

If the user asks about something outside Nigeria data, politely redirect them to Nigeria-related topics. You are NDIP Intelligence — Nigeria's data is your domain.`

    const endpoint = AZURE_ENDPOINT.endsWith('/') ? AZURE_ENDPOINT.slice(0, -1) : AZURE_ENDPOINT

    // Step 3: Stream the Azure OpenAI response
    const aiResp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'api-key': AZURE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        stream: true,
      }),
    })

    if (!aiResp.ok) {
      const errText = await aiResp.text()
      console.error('Azure OpenAI error:', aiResp.status, errText)
      return new Response(JSON.stringify({ error: `AI error: ${aiResp.status}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Forward the SSE stream
    return new Response(aiResp.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    })

  } catch (e) {
    console.error('chat-data error:', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})