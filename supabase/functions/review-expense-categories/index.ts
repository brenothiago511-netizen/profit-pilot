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

    const { date_from, date_to, user_id } = await req.json();

    if (!date_from || !date_to) {
      return new Response(JSON.stringify({ error: 'date_from and date_to are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch expenses from DB with pagination
    let allExpenses: any[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('expenses')
        .select('id, description, category_id, expense_categories(name)')
        .gte('date', date_from)
        .lte('date', date_to)
        .range(from, from + PAGE_SIZE - 1);

      if (user_id && user_id !== 'all') {
        query = query.eq('user_id', user_id);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Fetch error:', error);
        hasMore = false;
      } else {
        allExpenses = allExpenses.concat(data || []);
        hasMore = (data?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }
    }

    if (allExpenses.length === 0) {
      return new Response(JSON.stringify({ updated: 0, errors: 0, total: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch categories
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

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const BATCH_SIZE = 50;
    const allResults: { id: string; category_id: string }[] = [];

    for (let i = 0; i < allExpenses.length; i += BATCH_SIZE) {
      const batch = allExpenses.slice(i, i + BATCH_SIZE);

      const expenseList = batch.map((e: any, idx: number) =>
        `${idx}. [ID: ${e.id}] "${e.description}" (atual: ${e.expense_categories?.name || 'Sem categoria'})`
      ).join('\n');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          tools: [
            {
              name: 'categorize_expenses',
              description: 'Categorize each expense based on its description.',
              input_schema: {
                type: 'object',
                properties: {
                  categorizations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'The expense ID' },
                        category: { type: 'string', description: 'The category name that best fits' },
                      },
                      required: ['id', 'category'],
                    },
                  },
                },
                required: ['categorizations'],
              },
            },
          ],
          tool_choice: { type: 'tool', name: 'categorize_expenses' },
          system: `Você é um classificador financeiro especializado em e-commerce. Analise cada despesa e atribua a categoria mais adequada.

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
- Se não se encaixar → "Outros"

IMPORTANTE: Use EXATAMENTE os nomes das categorias disponíveis.`,
          messages: [
            {
              role: 'user',
              content: `Classifique estas despesas:\n\n${expenseList}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Anthropic API error:', response.status, errorText);

        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.', updated: allResults.length }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // Skip this batch on error, continue with next
        console.error(`Skipping batch starting at ${i}`);
        continue;
      }

      const data = await response.json();

      // Anthropic tool use response format: data.content[].type === 'tool_use'
      const toolUse = data.content?.find((c: any) => c.type === 'tool_use' && c.name === 'categorize_expenses');
      if (toolUse?.input?.categorizations) {
        try {
          const categorizations = toolUse.input.categorizations;

          for (const cat of categorizations) {
            const catNameLower = cat.category?.toLowerCase();
            const categoryId = categoryMap[catNameLower];
            if (categoryId && cat.id) {
              allResults.push({ id: cat.id, category_id: categoryId });
            }
          }
        } catch (parseErr) {
          console.error('Failed to process tool use response:', parseErr);
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < allExpenses.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Batch update using individual updates
    let updated = 0;
    let errors = 0;

    for (const result of allResults) {
      const { error } = await supabase
        .from('expenses')
        .update({ category_id: result.category_id })
        .eq('id', result.id);

      if (error) {
        errors++;
      } else {
        updated++;
      }
    }

    console.log(`Category review: ${updated} updated, ${errors} errors, ${allExpenses.length} total`);

    return new Response(
      JSON.stringify({ updated, errors, total: allExpenses.length }),
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
