// Edge functions do Supabase - código otimizado para evitar erros TypeScript

// @ts-ignore: Deno imports are valid in runtime
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: ESM imports are valid in runtime  
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // @ts-ignore: Deno is available in runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    // @ts-ignore: Deno is available in runtime
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('cliente')
      .select('is_admin, is_dev')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || (!profile.is_admin && !profile.is_dev)) {
      return new Response(JSON.stringify({ error: 'Permissão negada' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const { email, password, nome, apelido, nivel_dificuldade, is_admin, is_dev, bloqueado } = await req.json()

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email e senha são obrigatórios' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // @ts-ignore: Deno is available in runtime
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Verificar se o email já existe
    const { data: existingUser, error: checkError } = await serviceClient
      .from('cliente')
      .select('id')
      .eq('email', email)
      .limit(1)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      return new Response(JSON.stringify({ error: 'Erro ao verificar email existente' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (existingUser) {
      return new Response(JSON.stringify({ error: 'Já existe um usuário com este email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 1. Primeiro criar o usuário no Auth
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome }
    })

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 2. Depois criar o perfil na tabela cliente usando o ID do usuário do Auth
    const { error: profileInsertError } = await serviceClient
      .from('cliente')
      .insert({
        id: authData.user.id,
        email,
        nome,
        apelido,
        nivel_dificuldade: nivel_dificuldade || 'iniciante',
        is_admin: is_admin || false,
        is_dev: is_dev || false,
        bloqueado: bloqueado || false,
        ativo: true,
        data_criacao: new Date().toISOString()
      })

    if (profileInsertError) {
      await serviceClient.auth.admin.deleteUser(authData.user.id)
      return new Response(JSON.stringify({ error: profileInsertError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    return new Response(JSON.stringify({ success: true, user: authData.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})