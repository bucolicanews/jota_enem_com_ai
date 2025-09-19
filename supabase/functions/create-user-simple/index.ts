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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    // @ts-ignore: Deno is available in runtime
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })

    // Verificar se o usuário tem permissão
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { data: profile } = await supabaseClient
      .from('cliente')
      .select('is_admin, is_dev')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Permissão negada' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const { email, password, nome, apelido, nivel_dificuldade, permissao_id, is_admin, bloqueado } = await req.json()

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email e senha são obrigatórios' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Usar service role key para operações administrativas
    // @ts-ignore: Deno is available in runtime
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Verificar se email já existe no auth
    const { data: existingAuthUser } = await serviceClient.auth.admin.listUsers()
    const authUserExists = existingAuthUser.users.some(u => u.email === email)

    if (authUserExists) {
      return new Response(JSON.stringify({ error: 'Já existe um usuário com este email no sistema de autenticação' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Verificar se email já existe na tabela cliente
    const { data: existingCliente } = await serviceClient
      .from('cliente')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingCliente) {
      return new Response(JSON.stringify({ error: 'Já existe um usuário com este email na base de dados' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Verificar se a permissão existe (se for fornecida)
    if (permissao_id) {
      const { data: permissao, error: permissaoError } = await serviceClient
        .from('permissoes')
        .select('id')
        .eq('id', permissao_id)
        .single()

      if (permissaoError || !permissao) {
        return new Response(JSON.stringify({ error: 'Permissão inválida' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
    }

    // Criar usuário no Auth
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome }
    })

    if (authError) {
      return new Response(JSON.stringify({ error: `Erro no Auth: ${authError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Criar perfil na tabela cliente
    const { error: clienteError } = await serviceClient
      .from('cliente')
      .insert({
        id: authData.user.id,
        email,
        nome: nome || '',
        apelido: apelido || '',
        nivel_dificuldade: nivel_dificuldade || 'iniciante',
        permissao_id: permissao_id || null,
        is_admin: is_admin || false,
        bloqueado: bloqueado || false,
        ativo: true,
        data_criacao: new Date().toISOString()
      })

    if (clienteError) {
      // Rollback: deletar usuário do Auth se falhar ao criar perfil
      await serviceClient.auth.admin.deleteUser(authData.user.id)
      return new Response(JSON.stringify({ error: `Erro no cliente: ${clienteError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Usuário criado com sucesso',
      user: { id: authData.user.id, email: authData.user.email }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Erro interno: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})