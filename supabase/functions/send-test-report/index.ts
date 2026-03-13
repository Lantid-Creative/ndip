const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set')

    const date = new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 20px;">
<div style="text-align:center;margin-bottom:24px;">
<div style="display:inline-block;background:linear-gradient(135deg,#0a6b3d,#0f8a4f);color:white;font-weight:bold;padding:10px 18px;border-radius:8px;font-size:15px;margin-bottom:12px;">🇳🇬 NDIP</div>
<h1 style="margin:8px 0 4px;font-size:22px;color:#1a1a2e;">Daily Intelligence Report</h1>
<p style="margin:0 0 8px;color:#666;font-size:14px;">${date}</p>
<div style="margin-top:8px;">
<span style="display:inline-block;background:#e8f5e9;color:#0A6847;padding:4px 10px;border-radius:12px;font-size:12px;margin:2px;">Economics</span>
<span style="display:inline-block;background:#e8f5e9;color:#0A6847;padding:4px 10px;border-radius:12px;font-size:12px;margin:2px;">Technology</span>
<span style="display:inline-block;background:#e8f5e9;color:#0A6847;padding:4px 10px;border-radius:12px;font-size:12px;margin:2px;">Security</span>
</div></div>

<p style="font-size:15px;color:#1a1a2e;margin-bottom:8px;">Hi Damilola,</p>
<p style="font-size:14px;color:#555;margin-bottom:24px;">Here's what's happening across your tracked sectors today, backed by the latest available data.</p>

<div style="margin-top:24px;padding:24px;background:#fafcfa;border-radius:12px;border-left:4px solid #0A6847;">
<h2 style="margin:0 0 4px;font-size:17px;color:#0A6847;">📰 Today's Intelligence Briefing</h2>
<p style="margin:0 0 16px;font-size:12px;color:#999;">AI-generated analysis based on official data sources</p>
<div style="font-size:15px;color:#222;line-height:1.75;">
<p style="margin:12px 0;">Nigeria's internet penetration continues its steady climb, now reaching approximately 35.5% of the population — a figure that, while impressive in absolute terms given Nigeria's 220-million-plus population, still trails regional peer Kenya at roughly 40% and South Africa above 70%. The digital divide remains one of the country's most consequential structural challenges.</p>
<p style="margin:12px 0;">On the economic front, GDP per capita holds at around $2,066, reflecting the persistent squeeze on household purchasing power as the naira's managed float continues to create inflationary pressures. The unemployment picture, officially pegged at 4.2% by ILO methodology, masks significant underemployment — particularly among the youth demographic that dominates Nigeria's population pyramid.</p>
<p style="margin:12px 0;">The security landscape remains a key variable for investor confidence and economic planning. With a population surpassing 220 million and growing at roughly 2.4% annually, the pressure on public services, infrastructure, and security architecture intensifies each year. The government's renewed focus on technology-driven security solutions — including expanded surveillance infrastructure and digital identity systems — represents both an opportunity for the tech sector and a critical test of governance capacity.</p>
<p style="margin:12px 0;">What to Watch: The convergence of Nigeria's technology adoption curve with its security modernization agenda could prove transformative. Keep an eye on how the CBN's fintech regulations evolve alongside the push for greater financial inclusion — the interplay between digital payments growth, cybersecurity investment, and economic formalization will define Nigeria's trajectory through 2025.</p>
</div></div>

<h3 style="margin:28px 0 12px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">📊 Supporting Data</h3>
<table style="width:100%;border-collapse:collapse;background:#fafaf8;border-radius:12px;overflow:hidden;">
<thead><tr style="background:#0A6847;">
<th style="padding:12px 16px;text-align:left;color:white;font-size:13px;font-weight:600;">Indicator</th>
<th style="padding:12px 16px;text-align:right;color:white;font-size:13px;font-weight:600;">Value</th>
<th style="padding:12px 16px;text-align:right;color:white;font-size:13px;font-weight:600;">As Of</th>
</tr></thead>
<tbody>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;font-weight:500;color:#1a1a2e;">GDP Per Capita</td><td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;font-weight:700;color:#0A6847;text-align:right;">$2,066</td><td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;color:#666;text-align:right;font-size:13px;">2023</td></tr>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;font-weight:500;color:#1a1a2e;">Unemployment Rate</td><td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;font-weight:700;color:#0A6847;text-align:right;">4.2%</td><td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;color:#666;text-align:right;font-size:13px;">2023</td></tr>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;font-weight:500;color:#1a1a2e;">Population</td><td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;font-weight:700;color:#0A6847;text-align:right;">223.8M</td><td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;color:#666;text-align:right;font-size:13px;">2023</td></tr>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;font-weight:500;color:#1a1a2e;">Internet Penetration</td><td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;font-weight:700;color:#0A6847;text-align:right;">35.5%</td><td style="padding:12px 16px;border-bottom:1px solid #e5e5e5;color:#666;text-align:right;font-size:13px;">2022</td></tr>
</tbody></table>

<div style="margin-top:24px;text-align:center;">
<a href="https://ndip.lovable.app" style="display:inline-block;background:#0A6847;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Explore the Platform →</a>
</div>
<p style="margin-top:24px;font-size:13px;color:#999;text-align:center;">
Data sourced from Google Data Commons (World Bank, UN, WHO).<br/>
<a href="https://ndip.lovable.app/manage-preferences?email=okikiayoyinusa%40gmail.com" style="color:#0A6847;">Manage preferences</a> · <a href="https://ndip.lovable.app/unsubscribe?email=okikiayoyinusa%40gmail.com" style="color:#0A6847;">Unsubscribe</a>
</p>
<p style="margin-top:16px;font-size:12px;color:#aaa;text-align:center;">
© 2025 Nigeria Data Intelligence Platform · <a href="https://ndip.lovable.app" style="color:#0A6847;text-decoration:none;">ndip.ng</a>
</p></div></body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NDIP Nigeria <update@ndip.ng>',
        to: ['okikiayoyinusa@gmail.com'],
        subject: `Your NDIP Daily Intelligence Report — ${new Date().toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        html,
      }),
    })

    const result = await res.json()
    console.log('Resend response:', JSON.stringify(result))

    return new Response(JSON.stringify({ success: res.ok, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})