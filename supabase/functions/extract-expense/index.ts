import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
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
    const { image } = await req.json();
    
    if (!image) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Extracting expense data from image...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente de IA especializado em extrair dados financeiros de imagens de extratos bancários, comprovantes de pagamento, recibos, notas fiscais e faturas.

Analise a imagem e extraia TODAS as transações/despesas visíveis. Para cada transação, extraia:
- amount: O valor (número, sem símbolo de moeda)
- description: Descrição da transação como aparece no extrato
- date: A data no formato YYYY-MM-DD (se visível)
- currency: A moeda da transação (USD, BRL, EUR, GBP, MXN, etc). Identifique pela presença de símbolos ($, R$, €, £), textos como "USD", "BRL", ou pelo contexto (ex: transações em sites americanos = USD).
- category: Classifique em UMA das categorias abaixo baseado na descrição:
  - "Ads / Tráfego Pago" (Facebook Ads, Google Ads, TikTok Ads, mídia paga)
  - "Plataformas e Ferramentas" (Shopify, apps, SaaS, software, assinaturas digitais)
  - "Fornecedores / Produtos" (compra de mercadoria, matéria-prima, estoque)
  - "Logística / Frete" (Correios, transportadora, shipping, envio)
  - "Taxas e Comissões" (taxas bancárias, IOF, tarifas, comissões de gateway)
  - "Impostos" (DAS, DARF, ICMS, ISS, impostos em geral)
  - "Salários" (folha de pagamento, salários, pró-labore, benefícios)
  - "Marketing" (agência, influenciadores, conteúdo, design)
  - "Infraestrutura" (aluguel, internet, energia, escritório, equipamentos)
  - "Serviços Terceirizados" (contabilidade, advocacia, consultoria, freelancers)
  - "Manutenção" (reparos, consertos, manutenção preventiva)
  - "Material de Escritório" (papelaria, suprimentos, material de escritório)
  - "Outros" (quando não se encaixar em nenhuma outra)

IMPORTANTE: Se a imagem contiver MÚLTIPLAS transações (como um extrato bancário), retorne TODAS elas em um array JSON.

Responda APENAS com um JSON válido neste formato exato:
- Para MÚLTIPLAS transações: [{"amount": 123.45, "description": "Desc", "date": "2024-01-15", "currency": "USD", "category": "Categoria"}, ...]
- Para UMA transação: [{"amount": 123.45, "description": "Desc", "date": "2024-01-15", "currency": "USD", "category": "Categoria"}]

Sempre retorne um ARRAY, mesmo que tenha apenas uma transação.
Se não conseguir extrair um valor, use null para esse campo. Nunca retorne valores negativos, converta para positivo.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extraia os dados de despesa desta imagem. Pode ser um extrato bancário, comprovante de pagamento, recibo ou nota fiscal.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: image
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos para continuar.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log('AI Response:', content);

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response - always return an array
    let extractedData: any[];
    try {
      // Try to find array first
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        extractedData = JSON.parse(arrayMatch[0]);
      } else {
        // Fallback: try single object
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = [JSON.parse(jsonMatch[0])];
        } else {
          extractedData = JSON.parse(content);
          if (!Array.isArray(extractedData)) extractedData = [extractedData];
        }
      }
      
      // Ensure all amounts are positive
      extractedData = extractedData.map((item: any) => ({
        ...item,
        amount: item.amount ? Math.abs(item.amount) : null,
      }));
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      extractedData = [{
        amount: null,
        description: null,
        date: null,
        currency: null,
        category: null
      }];
    }

    console.log('Extracted data:', extractedData);

    return new Response(
      JSON.stringify(extractedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in extract-expense function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract expense data';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
