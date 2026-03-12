import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function generateWelcomeHtml(firstName: string, topics: string[], preferredHour: number): string {
  const topicLabels: Record<string, string> = {
    economics: '📊 Economics & Finance',
    health: '🏥 Health & Disease',
    education: '📚 Education',
    agriculture: '🌾 Agriculture & Food',
    security: '🔒 Security & Conflict',
    infrastructure: '🏗️ Infrastructure & Energy',
    technology: '💻 Technology & Innovation',
    governance: '🏛️ Governance & Policy',
    demographics: '👥 Demographics & Census',
    environment: '🌍 Environment & Climate',
  }

  const topicListHtml = topics
    .map(t => {
      const label = topicLabels[t] || `📌 ${t.charAt(0).toUpperCase() + t.slice(1)}`
      return `<li style="padding:6px 0;font-size:15px;color:#1a1a2e;">${label}</li>`
    })
    .join('')

  const hourLabel = preferredHour === 0 ? '12:00 AM' :
    preferredHour < 12 ? `${preferredHour}:00 AM` :
    preferredHour === 12 ? '12:00 PM' :
    `${preferredHour - 12}:00 PM`

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;">
        
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0a6b3d,#0f8a4f,#d4a017);padding:32px 28px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">🇳🇬 NDIP</h1>
          <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Nigeria Data Intelligence Platform</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 28px;border:1px solid #e8e0d0;border-top:none;border-radius:0 0 12px 12px;">
          <h2 style="margin:0 0 16px;font-size:20px;color:#0a6b3d;">Welcome, ${firstName}! 🎉</h2>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#333;">
            Thank you for subscribing to the <strong>Daily Intelligence Report</strong>. 
            You'll receive personalized data-driven briefings on Nigeria's key indicators, 
            curated just for you.
          </p>

          <!-- Topics -->
          <div style="background-color:#f5f0e8;border-radius:8px;padding:20px 24px;margin-bottom:20px;">
            <h3 style="margin:0 0 12px;font-size:16px;color:#0a6b3d;">Your Selected Topics</h3>
            <ul style="margin:0;padding:0 0 0 16px;list-style-type:none;">
              ${topicListHtml}
            </ul>
          </div>

          <!-- Delivery Time -->
          <div style="background-color:#f0f7f3;border-radius:8px;padding:16px 24px;margin-bottom:24px;">
            <p style="margin:0;font-size:14px;color:#555;">
              ⏰ <strong>Delivery Time:</strong> ${hourLabel} WAT (daily)
            </p>
          </div>

          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#333;">
            Each report includes the latest data from trusted sources, AI-powered analysis, 
            and actionable insights tailored to your interests.
          </p>

          <!-- CTA -->
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
            <tr><td style="background-color:#0a6b3d;border-radius:8px;">
              <a href="https://ndip.lovable.app" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                Explore the Platform →
              </a>
            </td></tr>
          </table>

          <p style="margin:0;font-size:13px;color:#888;text-align:center;">
            You can manage your topics and preferences anytime from the platform.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 28px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#aaa;">
            © ${new Date().getFullYear()} Nigeria Data Intelligence Platform · 
            <a href="https://ndip.lovable.app" style="color:#0a6b3d;text-decoration:none;">ndip.lovable.app</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { firstName, email, topics, preferredHour } = await req.json()

    if (!email || !firstName || !topics?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const html = generateWelcomeHtml(firstName, topics, preferredHour ?? 7)
    const messageId = crypto.randomUUID()

    const { error } = await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: email,
        from: 'NDIP <no-reply@notify.ndip.ng>',
        sender_domain: 'notify.ndip.ng',
        subject: `Welcome to NDIP, ${firstName}! 🇳🇬 Your Daily Intelligence Report is ready`,
        html,
        text: `Welcome ${firstName}! You've subscribed to the Nigeria Data Intelligence Platform Daily Report. Topics: ${topics.join(', ')}. Delivery: daily. Visit https://ndip.lovable.app to explore.`,
        purpose: 'transactional',
        label: 'welcome_email',
        queued_at: new Date().toISOString(),
      },
    })

    if (error) {
      console.error('Failed to enqueue welcome email', error)
      return new Response(
        JSON.stringify({ error: 'Failed to queue email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message_id: messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Welcome email error', err)
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})