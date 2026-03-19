import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  event: string;      // ex: 'expense.created', 'revenue.created', 'goal.achieved'
  data: Record<string, any>;
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: WebhookPayload = await req.json();
    const { event, data } = payload;

    if (!event || !data) {
      return new Response(JSON.stringify({ error: 'event and data are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar webhooks configurados para este usuário/evento
    const { data: webhooks, error: webhookError } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', `webhook_url_${user.id}`)
      .maybeSingle();

    const results: { url: string; status: number; ok: boolean }[] = [];

    if (webhooks?.value) {
      const webhookUrls = Array.isArray(webhooks.value)
        ? webhooks.value
        : [webhooks.value];

      // Disparar para todos os URLs configurados em paralelo
      await Promise.all(
        webhookUrls.map(async (url: string) => {
          try {
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Event': event,
                'X-Webhook-Timestamp': new Date().toISOString(),
              },
              body: JSON.stringify({
                event,
                data,
                timestamp: new Date().toISOString(),
                source: 'profit-pilot',
              }),
              signal: AbortSignal.timeout(5000), // 5s timeout
            });
            results.push({ url, status: response.status, ok: response.ok });
          } catch (err) {
            console.error(`Webhook failed for ${url}:`, err);
            results.push({ url, status: 0, ok: false });
          }
        })
      );
    }

    // Log do evento disparado
    console.log(`Webhook dispatched: ${event} → ${results.length} endpoints`);

    return new Response(
      JSON.stringify({
        event,
        dispatched: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
