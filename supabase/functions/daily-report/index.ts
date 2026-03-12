import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const DATA_COMMONS_API = 'https://api.datacommons.org/v2/observation'
const PLATFORM_URL = 'https://ndip.ng'

// Topic -> Data Commons indicators mapping
const TOPIC_INDICATORS: Record<string, { dcid: string; label: string; format: (v: number) => string }[]> = {
  economics: [
    { dcid: 'Amount_EconomicActivity_GrossDomesticProduction_Nominal_PerCapita', label: 'GDP Per Capita', format: (v) => `$${v.toLocaleString()}` },
    { dcid: 'UnemploymentRate_Person', label: 'Unemployment Rate', format: (v) => `${v.toFixed(1)}%` },
  ],
  demographics: [
    { dcid: 'Count_Person', label: 'Population', format: (v) => `${(v / 1_000_000).toFixed(1)}M` },
    { dcid: 'FertilityRate_Person_Female', label: 'Fertility Rate', format: (v) => `${v.toFixed(2)} births/woman` },
  ],
  health: [
    { dcid: 'LifeExpectancy_Person', label: 'Life Expectancy', format: (v) => `${v.toFixed(1)} years` },
    { dcid: 'Count_Death_0Years_AsFractionOf_Count_BirthEvent_LiveBirth', label: 'Infant Mortality', format: (v) => `${v.toFixed(1)} per 1,000` },
  ],
  education: [
    { dcid: 'Count_Person_EnrolledInSchool', label: 'School Enrollment', format: (v) => `${(v / 1_000_000).toFixed(1)}M` },
  ],
  agriculture: [
    { dcid: 'Area_Farm', label: 'Agricultural Land', format: (v) => `${(v / 1_000_000).toFixed(2)}M hectares` },
  ],
  sustainability: [
    { dcid: 'Amount_Emissions_CarbonDioxide_PerCapita', label: 'CO2 Per Capita', format: (v) => `${v.toFixed(2)} tonnes` },
  ],
  infrastructure: [
    { dcid: 'Count_Person_IsInternetUser_PerCapita', label: 'Internet Users', format: (v) => `${(v * 100).toFixed(1)}%` },
  ],
  governance: [
    { dcid: 'Amount_EconomicActivity_GrossDomesticProduction_Nominal_PerCapita', label: 'GDP Per Capita (governance context)', format: (v) => `$${v.toLocaleString()}` },
  ],
  technology: [
    { dcid: 'Count_Person_IsInternetUser_PerCapita', label: 'Internet Penetration', format: (v) => `${(v * 100).toFixed(1)}%` },
  ],
  security: [
    { dcid: 'Count_Person', label: 'Population', format: (v) => `${(v / 1_000_000).toFixed(1)}M` },
  ],
}

async function fetchIndicatorsForTopics(apiKey: string, topics: string[]) {
  const indicatorMap = new Map<string, { dcid: string; label: string; format: (v: number) => string; topics: string[] }>()

  for (const topic of topics) {
    const indicators = TOPIC_INDICATORS[topic] || []
    for (const ind of indicators) {
      if (!indicatorMap.has(ind.dcid)) {
        indicatorMap.set(ind.dcid, { ...ind, topics: [topic] })
      } else {
        indicatorMap.get(ind.dcid)!.topics.push(topic)
      }
    }
  }

  if (indicatorMap.size === 0) return []

  const dcids = Array.from(indicatorMap.keys())
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

  if (!resp.ok) throw new Error(`Data Commons API error: ${resp.status}`)
  const data = await resp.json()

  const results: { label: string; value: string; date: string; topic: string }[] = []
  for (const [dcid, indicator] of indicatorMap) {
    try {
      const facets = data?.byVariable?.[dcid]?.byEntity?.['country/NGA']?.orderedFacets
      if (!facets?.length || !facets[0].observations?.length) continue
      const obs = facets[0].observations
      const latest = obs[obs.length - 1]
      results.push({
        label: indicator.label,
        value: indicator.format(latest.value),
        date: latest.date,
        topic: indicator.topics[0],
      })
    } catch { /* skip */ }
  }
  return results
}

async function generateAIAnalysis(indicators: { label: string; value: string; date: string; topic: string }[], topics: string[]) {
  const azureEndpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT')
  const azureKey = Deno.env.get('AZURE_OPENAI_API_KEY')
  if (!azureEndpoint || !azureKey) {
    console.error('Azure OpenAI credentials not configured')
    return null
  }

  const dataContext = indicators.map(i => `${i.label}: ${i.value} (as of ${i.date})`).join('\n')
  const today = new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const systemPrompt = `You are a senior Nigeria intelligence analyst writing a daily current-affairs briefing for policymakers, business leaders, and informed citizens. Today is ${today}.

Your job is to transform raw socio-economic data into a compelling, current-affairs style intelligence briefing — the kind a busy minister or CEO reads over morning coffee.

STYLE GUIDELINES:
- Write like a Bloomberg or Economist intelligence briefing, not an academic report
- Open with the most newsworthy or striking data point as a "lead"
- Connect data to real-world events, policy decisions, and economic trends happening in Nigeria right now
- Compare to regional peers (Ghana, Kenya, South Africa) and global benchmarks
- Flag risks, opportunities, and what to watch next
- Use confident, analytical language — not hedging or generic
- 4-6 short, punchy paragraphs
- Do NOT use markdown headers, bullet points, or formatting — write flowing prose
- End with a forward-looking "What to Watch" insight

TOPICS TO FOCUS ON: ${topics.join(', ')}`

  try {
    const resp = await fetch(azureEndpoint, {
      method: 'POST',
      headers: {
        'api-key': azureKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Here is today's Nigeria data from official sources (World Bank, UN, WHO via Data Commons):\n\n${dataContext}\n\nWrite today's intelligence briefing. Ground your analysis in this data but bring in contextual awareness of Nigeria's current economic and political landscape.`,
          },
        ],
      }),
    })

    if (!resp.ok) {
      console.error('Azure OpenAI error:', resp.status, await resp.text())
      return null
    }
    const result = await resp.json()
    return result.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('Azure OpenAI call failed:', e)
    return null
  }
}

function buildPersonalizedReportHTML(
  indicators: { label: string; value: string; date: string; topic: string }[],
  topics: string[],
  aiAnalysis: string | null,
  firstName: string,
  email: string
) {
  const date = new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const topicLabels: Record<string, string> = {
    economics: 'Economics', demographics: 'Demographics', health: 'Health',
    education: 'Education', agriculture: 'Agriculture', sustainability: 'Sustainability',
    infrastructure: 'Infrastructure', governance: 'Governance', technology: 'Technology', security: 'Security',
  }

  const rows = indicators.map(i => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e5e5; font-weight: 500; color: #1a1a2e;">${i.label}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e5e5; font-weight: 700; color: #0A6847; text-align: right;">${i.value}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e5e5; color: #666; text-align: right; font-size: 13px;">${i.date}</td>
    </tr>
  `).join('')

  const topicBadges = topics.map(t =>
    `<span style="display: inline-block; background: #e8f5e9; color: #0A6847; padding: 4px 10px; border-radius: 12px; font-size: 12px; margin: 2px;">${topicLabels[t] || t}</span>`
  ).join(' ')

  const greeting = firstName ? `Hi ${firstName},` : 'Hello,'

  const analysisSection = aiAnalysis ? `
    <div style="margin-top: 24px; padding: 24px; background: #fafcfa; border-radius: 12px; border-left: 4px solid #0A6847;">
      <h2 style="margin: 0 0 4px; font-size: 17px; color: #0A6847;">📰 Today's Intelligence Briefing</h2>
      <p style="margin: 0 0 16px; font-size: 12px; color: #999;">AI-generated analysis based on official data sources</p>
      <div style="font-size: 15px; color: #222; line-height: 1.75;">${aiAnalysis.replace(/\n\n/g, '</p><p style="margin: 12px 0; font-size: 15px; color: #222; line-height: 1.75;">').replace(/\n/g, '<br/>')}</div>
    </div>
  ` : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 20px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #0a6b3d, #0f8a4f); color: white; font-weight: bold; padding: 10px 18px; border-radius: 8px; font-size: 15px; margin-bottom: 12px;">🇳🇬 NDIP</div>
      <h1 style="margin: 8px 0 4px; font-size: 22px; color: #1a1a2e;">Daily Intelligence Report</h1>
      <p style="margin: 0 0 8px; color: #666; font-size: 14px;">${date}</p>
      <div style="margin-top: 8px;">${topicBadges}</div>
    </div>
    
    <p style="font-size: 15px; color: #1a1a2e; margin-bottom: 8px;">${greeting}</p>
    <p style="font-size: 14px; color: #555; margin-bottom: 24px;">Here's what's happening across your tracked sectors today, backed by the latest available data.</p>
    
    ${analysisSection}

    <h3 style="margin: 28px 0 12px; font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">📊 Supporting Data</h3>
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
    
    <div style="margin-top: 24px; text-align: center;">
      <a href="${PLATFORM_URL}" style="display: inline-block; background: #0A6847; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Explore the Platform →</a>
    </div>

    <p style="margin-top: 24px; font-size: 13px; color: #999; text-align: center;">
      Data sourced from Google Data Commons (World Bank, UN, WHO).<br/>
      <a href="${PLATFORM_URL}/manage-preferences?email=${encodeURIComponent(email)}" style="color: #0A6847;">Manage preferences</a> · <a href="${PLATFORM_URL}/manage-preferences?email=${encodeURIComponent(email)}&unsubscribe=true" style="color: #0A6847;">Unsubscribe</a>
    </p>
    
    <p style="margin-top: 16px; font-size: 12px; color: #aaa; text-align: center;">
      © ${new Date().getFullYear()} Nigeria Data Intelligence Platform · <a href="${PLATFORM_URL}" style="color: #0A6847; text-decoration: none;">ndip.ng</a>
    </p>
  </div>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const dataCommonsKey = Deno.env.get('DATA_COMMONS_API_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Determine current hour in WAT (UTC+1)
    const nowUtc = new Date()
    const watHour = (nowUtc.getUTCHours() + 1) % 24

    // Fetch active subscribers whose preferred_hour matches the current WAT hour
    const { data: subscribers, error: subError } = await supabase
      .from('subscribers')
      .select('id, email, first_name, preferred_hour')
      .eq('is_active', true)
      .eq('preferred_hour', watHour)

    if (subError) throw subError
    if (!subscribers?.length) {
      return new Response(JSON.stringify({ message: `No subscribers for hour ${watHour} WAT`, count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get preferences for these subscribers
    const subscriberIds = subscribers.map(s => s.id)
    const { data: allPrefs } = await supabase
      .from('subscriber_preferences')
      .select('subscriber_id, topic')
      .in('subscriber_id', subscriberIds)
      .eq('is_active', true)

    const prefsBySubscriber = new Map<string, string[]>()
    for (const pref of (allPrefs || [])) {
      const existing = prefsBySubscriber.get(pref.subscriber_id) || []
      existing.push(pref.topic)
      prefsBySubscriber.set(pref.subscriber_id, existing)
    }

    // Group by topic combination to minimize API calls
    const topicCombinations = new Map<string, { topics: string[]; subscribers: typeof subscribers }>()
    for (const sub of subscribers) {
      const topics = prefsBySubscriber.get(sub.id) || []
      if (topics.length === 0) continue
      const key = [...topics].sort().join(',')
      if (!topicCombinations.has(key)) {
        topicCombinations.set(key, { topics, subscribers: [] })
      }
      topicCombinations.get(key)!.subscribers.push(sub)
    }

    let enqueuedCount = 0
    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL') || 'update@ndip.ng'
    const fromName = Deno.env.get('SMTP_FROM_NAME') || 'NDIP Nigeria'
    const defaultFrom = `${fromName} <${fromEmail}>`

    for (const [_key, combo] of topicCombinations) {
      const indicators = await fetchIndicatorsForTopics(dataCommonsKey, combo.topics)
      const aiAnalysis = await generateAIAnalysis(indicators, combo.topics)

      for (const sub of combo.subscribers) {
        const html = buildPersonalizedReportHTML(indicators, combo.topics, aiAnalysis, sub.first_name || '', sub.email)
        const messageId = crypto.randomUUID()

        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: messageId,
            to: sub.email,
            from: defaultFrom,
            subject: `Your NDIP Daily Intelligence Report — ${new Date().toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}`,
            html,
            text: `Hi ${sub.first_name || 'there'}, your daily intelligence report for ${combo.topics.join(', ')} is ready. Visit ${PLATFORM_URL} to explore.`,
            purpose: 'transactional',
            label: 'daily_report',
            queued_at: new Date().toISOString(),
          },
        })

        if (enqueueError) {
          console.error('Failed to enqueue daily report', { email: sub.email, error: enqueueError })
        } else {
          enqueuedCount++
        }
      }
    }

    console.log(`Enqueued ${enqueuedCount} daily reports for WAT hour ${watHour}`)

    return new Response(JSON.stringify({
      generated_at: new Date().toISOString(),
      wat_hour: watHour,
      subscribers_matched: subscribers.length,
      reports_enqueued: enqueuedCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Daily report error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})