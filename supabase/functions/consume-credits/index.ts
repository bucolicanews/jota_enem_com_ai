// @ts-ignore: Deno imports are valid in runtime
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore: ESM imports are valid in runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    // Verify user authentication
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

    const { creditType, amount = 1 } = await req.json(); // creditType: 'perguntas', 'redacoes', 'simulados'

    if (!creditType || !['perguntas', 'redacoes', 'simulados'].includes(creditType)) {
      return new Response(JSON.stringify({ error: 'Invalid credit type' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Fetch user's profile and check for parent_id
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('cliente')
      .select(`id, parent_id, creditos_${creditType}`)
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    let targetUserId = user.id;
    let currentCredits = userProfile[`creditos_${creditType}`];

    // If user is a student (has a parent_id), consume credits from the parent (professor)
    if (userProfile.parent_id) {
      const { data: parentProfile, error: parentProfileError } = await supabaseAdmin
        .from('cliente')
        .select(`id, creditos_${creditType}`)
        .eq('id', userProfile.parent_id)
        .single();

      if (parentProfileError || !parentProfile) {
        return new Response(JSON.stringify({ error: 'Professor profile not found for student' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      }
      targetUserId = parentProfile.id;
      currentCredits = parentProfile[`creditos_${creditType}`];
    }

    if (currentCredits < amount) {
      return new Response(JSON.stringify({ error: 'Insufficient credits' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Decrement credits
    const { error: updateError } = await supabaseAdmin
      .from('cliente')
      .update({ [`creditos_${creditType}`]: currentCredits - amount })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('Error decrementing credits:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to consume credits' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ success: true, newCredits: currentCredits - amount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in consume-credits Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});