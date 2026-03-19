import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  Deno.env.get('SITE_URL') || '',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

interface UserToImport {
  email: string;
  name: string;
  password: string;
  role: 'admin' | 'financeiro' | 'gestor' | 'socio';
}

interface ImportResult {
  email: string;
  success: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Verify the request is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create client with user's token to verify they're an admin
    const supabaseUser = createClient(
      supabaseUrl,
      anonKey,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Error getting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin using the database function
    const { data: isAdmin, error: adminError } = await supabaseAdmin.rpc('is_admin', { _user_id: user.id });
    if (adminError) {
      console.error('Error checking admin status:', adminError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify authorization' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!isAdmin) {
      console.error('User is not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Only admins can import users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the request body
    const { users } = await req.json() as { users: UserToImport[] };

    if (!users || !Array.isArray(users) || users.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No users provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting bulk import of ${users.length} users`);

    const results: ImportResult[] = [];

    for (const userData of users) {
      try {
        // Validate user data
        if (!userData.email || !userData.name || !userData.password) {
          results.push({
            email: userData.email || 'unknown',
            success: false,
            error: 'Email, nome e senha são obrigatórios',
          });
          continue;
        }

        if (userData.password.length < 6) {
          results.push({
            email: userData.email,
            success: false,
            error: 'Senha deve ter pelo menos 6 caracteres',
          });
          continue;
        }

        const validRoles = ['admin', 'financeiro', 'gestor', 'socio'];
        const role = validRoles.includes(userData.role) ? userData.role : 'financeiro';

        // Create the user with admin API
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true, // Auto-confirm the email
          user_metadata: {
            name: userData.name,
            role: role,
          },
        });

        if (createError) {
          console.error(`Error creating user ${userData.email}:`, createError);
          results.push({
            email: userData.email,
            success: false,
            error: createError.message,
          });
          continue;
        }

        console.log(`Successfully created user: ${userData.email}`);
        results.push({
          email: userData.email,
          success: true,
        });

      } catch (error) {
        console.error(`Error processing user ${userData.email}:`, error);
        results.push({
          email: userData.email || 'unknown',
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Bulk import complete: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total: users.length,
          success: successCount,
          failed: failCount,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk import:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
