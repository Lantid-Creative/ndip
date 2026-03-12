import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const API_KEY = Deno.env.get('DATA_COMMONS_API_KEY');
  const API_SECRET = Deno.env.get('DATA_COMMONS_API_SECRET');

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'DATA_COMMONS_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { endpoint, params } = await req.json();

    let url: string;
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    let fetchOptions: RequestInit;

    if (endpoint === 'nl') {
      // Natural Language API - query goes as URL param 'q', context in body
      const q = encodeURIComponent(String(params.query));
      url = `https://nl.datacommons.org/api/explore/detect-and-fulfill?q=${q}`;
      headers['X-API-Key'] = API_KEY;
      fetchOptions = {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contextHistory: [],
          dc: '',
        }),
      };
    } else if (endpoint === 'observation') {
      url = 'https://api.datacommons.org/v2/observation';
      headers['X-API-Key'] = API_KEY;
      fetchOptions = {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      };
    } else if (endpoint === 'node') {
      url = 'https://api.datacommons.org/v2/node';
      headers['X-API-Key'] = API_KEY;
      fetchOptions = {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      };
    } else if (endpoint === 'resolve') {
      url = 'https://api.datacommons.org/v2/resolve';
      headers['X-API-Key'] = API_KEY;
      fetchOptions = {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      };
    } else if (endpoint === 'sparql') {
      url = 'https://api.datacommons.org/v2/sparql';
      headers['X-API-Key'] = API_KEY;
      fetchOptions = {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      };
    } else {
      return new Response(JSON.stringify({ error: `Unknown endpoint: ${endpoint}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Calling Data Commons ${endpoint}: ${url}`);
    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`Data Commons returned non-JSON (${response.status}): ${text.substring(0, 200)}`);
      return new Response(JSON.stringify({ error: `Data Commons returned non-JSON response (${response.status}). The API may be unavailable for this query.` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    if (!response.ok) {
      console.error(`Data Commons API error [${response.status}]:`, JSON.stringify(data));
      return new Response(JSON.stringify({ error: `Data Commons API error`, status: response.status, details: data }), {
        status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Edge function error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
