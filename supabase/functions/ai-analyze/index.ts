import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { query, dataSummary, mode } = await req.json();

    // ─── Suggestions-only mode ─────────────────────────────────────
    if (mode === 'suggestions_only') {
      const suggestResp = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: 'You suggest search queries for a Nigeria data platform powered by Google Data Commons. Return ONLY a JSON array of 6 strings. Each query must be a concrete, measurable statistical question about Nigeria that Data Commons can answer (use indicators like GDP, population, life expectancy, literacy rate, unemployment, CO2 emissions, infant mortality, fertility rate, internet users, etc). Make them relevant to the user\'s original intent.' },
            { role: 'user', content: query },
          ],
          temperature: 0.8,
        }),
      });
      if (!suggestResp.ok) {
        const status = suggestResp.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response('[]', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const suggestResult = await suggestResp.json();
      const content = suggestResult.choices?.[0]?.message?.content || '[]';
      return new Response(content, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── Full analysis mode ────────────────────────────────────────
    const systemPrompt = `You are an expert data analyst for the Nigeria Data Intelligence Platform, specializing in Nigeria's socio-economic landscape. You analyze data from Google's Data Commons and return structured, insightful analysis.

You MUST call the "present_analysis" function with your analysis. Be specific with actual numbers from the data. Be insightful, not generic. Always reference Nigeria specifically.

For comparisons, compare Nigeria's metrics against well-known global/regional benchmarks you know (e.g. world average, Sub-Saharan Africa average, South Africa, Ghana, Kenya, India, etc).`;

    const userPrompt = `User asked: "${query}"

Data from Data Commons:
${dataSummary}

Analyze this data deeply for Nigeria. Use actual numbers.`;

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        tools: [
          {
            type: 'function',
            function: {
              name: 'present_analysis',
              description: 'Present structured data analysis with visual components',
              parameters: {
                type: 'object',
                properties: {
                  headline: {
                    type: 'string',
                    description: 'A punchy one-line headline summarizing the key finding (max 15 words)'
                  },
                  keyMetrics: {
                    type: 'array',
                    description: '2-4 key metrics to highlight visually',
                    items: {
                      type: 'object',
                      properties: {
                        label: { type: 'string', description: 'Metric name (e.g. "Population")' },
                        value: { type: 'string', description: 'Formatted value (e.g. "232.7M")' },
                        context: { type: 'string', description: 'Brief context (e.g. "7th largest globally")' },
                        trend: { type: 'string', enum: ['up', 'down', 'stable'], description: 'Direction of trend' },
                      },
                      required: ['label', 'value', 'context', 'trend'],
                    },
                  },
                  insights: {
                    type: 'array',
                    description: '3-5 deep analytical insights, each with a title and explanation',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', description: 'Insight title (3-6 words)' },
                        text: { type: 'string', description: 'Insightful explanation (2-3 sentences)' },
                        sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral', 'warning'] },
                      },
                      required: ['title', 'text', 'sentiment'],
                    },
                  },
                  comparisons: {
                    type: 'array',
                    description: '2-3 comparisons with other countries or global averages',
                    items: {
                      type: 'object',
                      properties: {
                        metric: { type: 'string', description: 'What is being compared' },
                        nigeria: { type: 'string', description: 'Nigeria value' },
                        other: { type: 'string', description: 'Comparison value' },
                        otherName: { type: 'string', description: 'Name of comparison (e.g. "World Average")' },
                        nigeriaPercent: { type: 'number', description: 'Nigeria as percentage for bar (0-100)' },
                        otherPercent: { type: 'number', description: 'Other as percentage for bar (0-100)' },
                      },
                      required: ['metric', 'nigeria', 'other', 'otherName', 'nigeriaPercent', 'otherPercent'],
                    },
                  },
                  policyNote: {
                    type: 'string',
                    description: 'A brief policy implication or recommendation (2-3 sentences)'
                  },
                  nextQuestions: {
                    type: 'array',
                    description: '3 follow-up questions to explore deeper',
                    items: { type: 'string' },
                  },
                },
                required: ['headline', 'keyMetrics', 'insights', 'comparisons', 'policyNote', 'nextQuestions'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'present_analysis' } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await response.text();
      console.error(`AI gateway error [${status}]:`, errText);
      return new Response(JSON.stringify({ error: `AI analysis failed: ${status}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error('No tool call in response:', JSON.stringify(result));
      return new Response(JSON.stringify({ error: 'AI did not return structured analysis' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(analysis), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('AI analyze error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});