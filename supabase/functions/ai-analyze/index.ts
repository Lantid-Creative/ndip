import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const AZURE_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');
  const AZURE_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');

  if (!AZURE_KEY || !AZURE_ENDPOINT) {
    return new Response(JSON.stringify({ error: 'Azure OpenAI not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { query, dataSummary } = await req.json();

    const systemPrompt = `You are NaijaData AI — an expert data analyst specializing in Nigeria's socio-economic landscape. 

When given a user query and data from Google's Data Commons, you provide:

1. **Key Insights** — 3-5 bullet points highlighting the most important findings from the data
2. **Context & Significance** — Why these numbers matter for Nigeria (compare with regional/global benchmarks when relevant)
3. **Trends & Projections** — What the trajectory suggests about Nigeria's future
4. **Policy Implications** — What decision-makers and policymakers should consider
5. **Questions to Explore Next** — 2-3 follow-up data questions that would deepen understanding

Format your response in clean markdown. Be specific with numbers from the data. Be insightful, not generic. Always reference Nigeria specifically.`;

    const userPrompt = `User asked: "${query}"

Here is the data retrieved from Data Commons:

${dataSummary}

Provide a deep, insightful analysis of this data for Nigeria.`;

    // Ensure endpoint ends properly
    const endpoint = AZURE_ENDPOINT.endsWith('/') ? AZURE_ENDPOINT.slice(0, -1) : AZURE_ENDPOINT;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_KEY,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Azure OpenAI error [${response.status}]:`, errText);
      return new Response(JSON.stringify({ error: `AI analysis failed: ${response.status}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Stream the response back
    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error: unknown) {
    console.error('AI analyze error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
