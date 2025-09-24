// @ts-ignore: Deno imports are valid in runtime
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore: ESM imports are valid in runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// @ts-ignore: ESM imports are valid in runtime
import { v4 as uuidv4 } from "https://esm.sh/uuid@9.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // @ts-ignore: Deno is available in runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore: Deno is available in runtime
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Verify user authentication and if they are a 'Prof'
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Check if the user has 'Prof' permission
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('cliente')
      .select('permissao_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const { data: permission, error: permissionError } = await supabaseAdmin
      .from('permissoes')
      .select('nome')
      .eq('id', profile.permissao_id)
      .single();

    if (permissionError || permission?.nome !== 'Prof') {
      return new Response(JSON.stringify({ error: 'Access denied: Professor privilege required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Generate a unique token
    const inviteToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Link expires in 7 days

    // Store the token with the professor's user_id
    const { error: insertError } = await supabaseAdmin
      .from('professor_invite_tokens') // You'll need to create this table
      .insert({
        token: inviteToken,
        professor_id: user.id,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error storing invite token:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to generate invite link' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Construct the invite link
    // Assuming your signup page is at /login and can handle a 'token' query parameter
    const inviteLink = `${supabaseUrl}/auth/v1/signup?token=${inviteToken}&redirect_to=${encodeURIComponent(req.headers.get('Referer') || '/')}`;


    return new Response(JSON.stringify({ success: true, inviteLink }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in generate-invite-link Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});