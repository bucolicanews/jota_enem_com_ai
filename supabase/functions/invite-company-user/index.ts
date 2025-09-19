// supabase/functions/invite-company-user/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.5'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const URL = Deno.env.get('URL')
const SERVICE_KEY = Deno.env.get('SERVICE_KEY')

const supabaseAdmin = createClient(
  URL,
  SERVICE_KEY,
  {
    auth: {
      persistSession: false,
    },
  }
)

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:8080',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS' // Adicionado método OPTIONS
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { email, redirectTo } = await req.json()

  if (!email || !redirectTo) {
    return new Response(JSON.stringify({ error: 'Email e redirectTo são obrigatórios.' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erro interno do servidor.' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
})