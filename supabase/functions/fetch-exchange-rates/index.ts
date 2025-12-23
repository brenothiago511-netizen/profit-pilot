import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Supported currencies
const CURRENCIES = ['USD', 'BRL', 'EUR', 'GBP', 'ARS', 'CLP', 'MXN', 'COP', 'PEN', 'UYU', 'PYG', 'BOB']

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting exchange rate fetch...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the base currency from system settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'base_currency')
      .maybeSingle()

    const baseCurrency = settings?.value ? String(settings.value).replace(/"/g, '') : 'USD'
    console.log(`Base currency: ${baseCurrency}`)

    // Fetch exchange rates from frankfurter.app (free, no API key required)
    const targetCurrencies = CURRENCIES.filter(c => c !== baseCurrency).join(',')
    const apiUrl = `https://api.frankfurter.app/latest?from=${baseCurrency}&to=${targetCurrencies}`
    
    console.log(`Fetching from: ${apiUrl}`)
    
    const response = await fetch(apiUrl)
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('API response:', JSON.stringify(data))

    const today = new Date().toISOString().split('T')[0]
    const rates = data.rates || {}

    // Prepare exchange rate records
    const exchangeRates = Object.entries(rates).map(([currency, rate]) => ({
      base_currency: baseCurrency,
      target_currency: currency,
      rate: Number(rate),
      date: today,
      source: 'frankfurter.app',
    }))

    console.log(`Upserting ${exchangeRates.length} exchange rates...`)

    // Upsert exchange rates (update if exists, insert if not)
    for (const rateRecord of exchangeRates) {
      const { error } = await supabase
        .from('exchange_rates')
        .upsert(rateRecord, {
          onConflict: 'base_currency,target_currency,date',
        })

      if (error) {
        console.error(`Error upserting rate for ${rateRecord.target_currency}:`, error)
      }
    }

    console.log('Exchange rates updated successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated ${exchangeRates.length} exchange rates`,
        baseCurrency,
        date: today,
        rates: exchangeRates,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error fetching exchange rates:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
