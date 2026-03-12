import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DATA_COMMONS_API = 'https://api.datacommons.org/v2/observation';

const INDICATORS = [
  { dcid: 'Count_Person', label: 'Population', format: (v: number) => `${(v / 1_000_000).toFixed(1)}M` },
  { dcid: 'LifeExpectancy_Person', label: 'Life Expectancy', format: (v: number) => `${v.toFixed(1)} years` },
  { dcid: 'Amount_EconomicActivity_GrossDomesticProduction_Nominal_PerCapita', label: 'GDP Per Capita', format: (v: number) => `$${v.toLocaleString()}` },
  { dcid: 'UnemploymentRate_Person', label: 'Unemployment Rate', format: (v: number) => `${v.toFixed(1)}%` },
  { dcid: 'FertilityRate_Person_Female', label: 'Fertility Rate', format: (v: number) => `${v.toFixed(2)} births/woman` },
  { dcid: 'Count_Death_0Years_AsFractionOf_Count_BirthEvent_LiveBirth', label: 'Infant Mortality', format: (v: number) => `${v.toFixed(1)} per 1,000` },
];

async function fetchIndicators(apiKey: string) {
  const dcids = INDICATORS.map(i => i.dcid);
  const resp = await fetch(DATA_COMMONS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({
      date: 'LATEST',
      variable: { dcids },
      entity: { dcids: ['country/NGA'] },
      select: ['variable', 'entity', 'value', 'date'],
    }),
  });

  if (!resp.ok) throw new Error(`Data Commons API error: ${resp.status}`);
  const data = await resp.json();

  const results: { label: string; value: string; date: string }[] = [];
  for (const indicator of INDICATORS) {
    try {
      const facets = data?.byVariable?.[indicator.dcid]?.byEntity?.['country/NGA']?.orderedFacets;
      if (!facets?.length || !facets[0].observations?.length) continue;
      const obs = facets[0].observations;
      const latest = obs[obs.length - 1];
      results.push({
        label: indicator.label,
        value: indicator.format(latest.value),
        date: latest.date,
      });
    } catch { /* skip indicator */ }
  }
  return results;
}

function buildReportHTML(indicators: { label: string; value: string; date: string }[]) {
  const date = new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  const rows = indicators.map(i => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e5e5; font-weight: 500; color: #1a1a2e;">${i.label}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e5e5; font-weight: 700; color: #0A6847; text-align: right;">${i.value}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e5e5; color: #666; text-align: right; font-size: 13px;">${i.date}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 20px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background: #0A6847; color: white; font-weight: bold; padding: 8px 14px; border-radius: 8px; font-size: 14px; margin-bottom: 12px;">NIP</div>
      <h1 style="margin: 8px 0 4px; font-size: 22px; color: #1a1a2e;">Nigeria Daily Intelligence Report</h1>
      <p style="margin: 0; color: #666; font-size: 14px;">${date}</p>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; background: #fafaf8; border-radius: 12px; overflow: hidden;">
      <thead>
        <tr style="background: #0A6847;">
          <th style="padding: 12px 16px; text-align: left; color: white; font-size: 13px; font-weight: 600;">Indicator</th>
          <th style="padding: 12px 16px; text-align: right; color: white; font-size: 13px; font-weight: 600;">Value</th>
          <th style="padding: 12px 16px; text-align: right; color: white; font-size: 13px; font-weight: 600;">As Of</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    
    <p style="margin-top: 24px; font-size: 13px; color: #999; text-align: center;">
      Data sourced from Google Data Commons (World Bank, UN, WHO).<br/>
      <a href="#" style="color: #0A6847;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const dataCommonsKey = Deno.env.get('DATA_COMMONS_API_KEY') || '';
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active subscribers
    const { data: subscribers, error: subError } = await supabase
      .from('subscribers')
      .select('email')
      .eq('is_active', true);

    if (subError) throw subError;
    if (!subscribers?.length) {
      return new Response(JSON.stringify({ message: 'No active subscribers', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch latest indicators
    const indicators = await fetchIndicators(dataCommonsKey);
    const html = buildReportHTML(indicators);

    // For now, store the generated report. Email sending will be added when email domain is configured.
    // When email is set up, this will send via the transactional email system.
    const report = {
      generated_at: new Date().toISOString(),
      subscriber_count: subscribers.length,
      indicators,
      html_preview: html,
      status: 'generated', // will be 'sent' once email is configured
    };

    console.log(`Report generated for ${subscribers.length} subscribers with ${indicators.length} indicators`);

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Daily report error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
