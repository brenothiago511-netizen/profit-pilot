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

    const { expenses } = await req.json();

    if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
      return new Response(JSON.stringify({ error: 'No expenses provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch available categories
    const { data: categories } = await supabase
      .from('expense_categories')
      .select('id, name');

    if (!categories || categories.length === 0) {
      return new Response(JSON.stringify({ error: 'No categories found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const categoryMap = Object.fromEntries(categories.map(c => [c.name.toLowerCase(), c.id]));
    const categoryNames = categories.map(c => c.name).join(', ');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Process in batches of 50 to avoid token limits
    const BATCH_SIZE = 50;
    const allResults: { id: string; category_id: string }[] = [];

    for (let i = 0; i < expenses.length; i += BATCH_SIZE) {
      const batch = expenses.slice(i, i + BATCH_SIZE);

      const expenseList = batch.map((e: any, idx: number) =>
        `${idx}. [ID: ${e.id}] "${e.description}" (atual: ${e.category_name || 'Sem categoria'})`
      ).join('\n');

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          tools: [
            {
              type: "function",
              function: {
                name: "categorize_expenses",
                description: "Categorize each expense based on its description.",
                parameters: {
                  type: "object",
                  properties: {
                    categorizations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", description: "The expense ID" },
                          category: { type: "string", description: "The category name that best fits" },
                        },
                        required: ["id", "category"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["categorizations"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "categorize_expenses" } },
          messages: [
            {
              role: 'system',
              content: `Você é um classificador financeiro especializado em e-commerce. Analise cada despesa e atribua a categoria mais adequada.

Categorias disponíveis: ${categoryNames}

Regras:
- "FACEBK", "Facebook Ads", "FB Ads", "Google Ads", "TikTok Ads" → "Ads / Tráfego Pago"
- "Shopify", "app", "SaaS", "software", "assinatura" → "Plataformas e Ferramentas"
- "fornecedor", "produto", "mercadoria", "estoque", "supplier" → "Fornecedores / Produtos"
- "frete", "correios", "shipping", "envio", "transportadora" → "Logística / Frete"
- "taxa", "tarifa", "IOF", "comissão", "gateway" → "Taxas e Comissões"
- "imposto", "DAS", "DARF", "ICMS", "ISS" → "Impostos"
- "salário", "folha", "pró-labore" → "Salários"
- "agência", "influenciador", "marketing", "design" → "Marketing"
- "aluguel", "internet", "energia", "escritório" → "Infraestrutura"
- "contabilidade", "advocacia", "consultoria", "freelancer" → "Serviços Terceirizados"
- "reparo", "manutenção", "conserto" → "Manutenção"
- "papelaria", "material", "suprimento" → "Material de Escritório"
- Se não se encaixar em nenhuma → "Outros"

IMPORTANTE: Use EXATAMENTE os nomes das categorias disponíveis.`
            },
            {
              role: 'user',
              content: `Classifique estas despesas:\n\n${expenseList}`
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);

        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.', processed: allResults.length }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: 'Créditos de IA esgotados.', processed: allResults.length }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const data = await response.json();

      // Extract tool call result
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          const categorizations = parsed.categorizations || [];

          for (const cat of categorizations) {
            const catNameLower = cat.category?.toLowerCase();
            const categoryId = categoryMap[catNameLower];
            if (categoryId && cat.id) {
              allResults.push({ id: cat.id, category_id: categoryId });
            }
          }
        } catch (parseErr) {
          console.error('Failed to parse tool call:', parseErr);
        }
      }
    }

    // Update expenses in database
    let updated = 0;
    let errors = 0;

    for (const result of allResults) {
      const { error } = await supabase
        .from('expenses')
        .update({ category_id: result.category_id })
        .eq('id', result.id);

      if (error) {
        console.error('Update error:', error);
        errors++;
      } else {
        updated++;
      }
    }

    console.log(`Category review complete: ${updated} updated, ${errors} errors out of ${expenses.length} total`);

    return new Response(
      JSON.stringify({ updated, errors, total: expenses.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in review-expense-categories:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to review categories';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
