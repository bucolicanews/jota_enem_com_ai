"use client";

// @ts-ignore: Deno imports are valid in runtime
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

// @ts-ignore: Deno imports are valid in runtime
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
// @ts-ignore: ESM imports are valid in runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('Edge Function test-llm-key started.');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the user's auth token
    // @ts-ignore: Deno is available in runtime
    const supabaseClient = createClient(
      // @ts-ignore: Deno is available in runtime
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore: Deno is available in runtime
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the user from the token
    const { data: { user }, error: userAuthError } = await supabaseClient.auth.getUser()
    if (userAuthError) {
        console.error('User authentication error:', userAuthError);
    }
    if (!user) {
      console.log('Access denied: No user found.');
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }
    console.log('User authenticated:', user.id);

    const { modelId } = await req.json()
    if (!modelId) {
      console.log('Access denied: modelId é obrigatório.');
      return new Response(JSON.stringify({ error: 'modelId é obrigatório' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    console.log('Testing modelId:', modelId);

    // Create a service role client to securely fetch the API key and user permissions
    // @ts-ignore: Deno is available in runtime
    const serviceClient = createClient(
        // @ts-ignore: Deno is available in runtime
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore: Deno is available in runtime
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch user's permission level
    const { data: clientProfile, error: clientProfileError } = await serviceClient
      .from('cliente')
      .select('permissao_id')
      .eq('id', user.id)
      .single();

    if (clientProfileError || !clientProfile) {
      console.error('Erro ao buscar perfil do cliente:', clientProfileError);
      return new Response(JSON.stringify({ error: 'Erro ao verificar permissões do usuário.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const { data: userPermission, error: userPermissionError } = await serviceClient
      .from('permissoes')
      .select('nome')
      .eq('id', clientProfile.permissao_id)
      .single();

    if (userPermissionError || !userPermission) {
      console.error('Erro ao buscar nome da permissão:', userPermissionError);
      return new Response(JSON.stringify({ error: 'Erro ao verificar permissões do usuário.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const permissionName = userPermission.nome;
    const isPro = ['Pro', 'Prof', 'Admin'].includes(permissionName);
    const isProf = ['Prof', 'Admin'].includes(permissionName);
    const isAdmin = permissionName === 'Admin';

    // 2. Fetch the model by ID
    const { data: model, error: dbError } = await serviceClient
      .from('language_models')
      .select('api_key, provider, model_name, model_variant, is_standard, user_id')
      .eq('id', modelId)
      .single()

    if (dbError) {
        console.error('Database fetch error for model:', dbError);
    }
    if (!model) {
      console.log('Modelo não encontrado para o ID:', modelId);
      return new Response(JSON.stringify({ error: 'Modelo de IA não encontrado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }
    console.log('Modelo buscado:', { id: model.id, provider: model.provider, model_variant: model.model_variant, is_standard: model.is_standard, user_id: model.user_id });

    // 3. Implement Access Logic
    let hasAccess = false;
    if (model.is_standard) {
      // Standard models require PRO, Prof, or Admin permission
      if (model.user_id !== null) {
        // Invalid configuration for a standard model
        console.error(`Configuração inválida: Modelo padrão ${model.id} tem user_id.`);
        return new Response(JSON.stringify({ error: 'Configuração inválida do modelo padrão.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }
      hasAccess = isPro || isProf || isAdmin;
    } else {
      // Personal models require matching user_id
      hasAccess = model.user_id === user.id;
    }

    if (!hasAccess) {
      console.log('Acesso negado ao modelo de IA.');
      return new Response(JSON.stringify({ error: 'Acesso negado ao modelo de IA.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }
    console.log('Acesso concedido para teste do modelo.');

    const { api_key, provider, model_variant } = model;
    
    console.log('DEBUG: Provedor do DB:', provider);
    console.log('DEBUG: Variante do Modelo do DB:', model_variant);

    let testResult = { success: false, message: 'Provedor não suportado' };

    try {
      // Test OpenAI
      if (provider === 'OpenAI') {
          console.log('Tentando testar OpenAI...');
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
              body: JSON.stringify({ model: model_variant, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 })
          });
          console.log('Status da resposta OpenAI:', response.status);
          if (response.ok) {
              testResult = { success: true, message: 'Conexão com OpenAI bem-sucedida!' };
          } else {
              const errorData = await response.json();
              console.error('Resposta de erro da API OpenAI:', errorData);
              testResult = { success: false, message: `Falha na conexão com OpenAI: ${errorData.error?.message || 'Erro desconhecido'}` };
          }
      } 
      // Test Google Gemini
      else if (provider === 'Google Gemini') {
          console.log('Tentando testar Google Gemini...');
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model_variant}:generateContent?key=${api_key}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] })
          });
          console.log('Status da resposta Google Gemini:', response.status);
          if (response.ok) {
              testResult = { success: true, message: 'Conexão com Google Gemini bem-sucedida!' };
          } else {
              const errorData = await response.json();
              console.error('Resposta de erro da API Google Gemini:', errorData);
              testResult = { success: false, message: `Falha na conexão com Gemini: ${errorData.error?.message || 'Erro desconhecido'}` };
          }
      } 
      // Test Anthropic
      else if (provider === 'Anthropic') {
          console.log('Tentando testar Anthropic...');
          const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': api_key, 'anthropic-version': '2023-06-01' },
              body: JSON.stringify({ model: model_variant, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 })
          });
          console.log('Status da resposta Anthropic:', response.status);
          if (response.ok) {
              testResult = { success: true, message: 'Conexão com Anthropic bem-sucedida!' };
          } else {
              const errorData = await response.json();
              console.error('Resposta de erro da API Anthropic:', errorData);
              testResult = { success: false, message: `Falha na conexão com Anthropic: ${errorData.error?.message || 'Erro desconhecido'}` };
          }
      } 
      // Test Groq
      else if (provider === 'Groq') {
          console.log('Tentando testar Groq...');
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
              body: JSON.stringify({ model: model_variant, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 })
          });
          console.log('Status da resposta Groq:', response.status);
          if (response.ok) {
              testResult = { success: true, message: 'Conexão com Groq bem-sucedida!' };
          } else {
              const errorData = await response.json();
              console.error('Resposta de erro da API Groq:', errorData);
              testResult = { success: false, message: `Falha na conexão com Groq: ${errorData.error?.message || 'Erro desconhecido'}` };
          }
      }
      // Test DeepSeek
      else if (provider === 'DeepSeek') {
          console.log('Tentando testar DeepSeek...');
          const response = await fetch('https://api.deepseek.com/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
              body: JSON.stringify({ model: model_variant, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 })
          });
          console.log('Status da resposta DeepSeek:', response.status);
          if (response.ok) {
              testResult = { success: true, message: 'Conexão com DeepSeek bem-sucedida!' };
          } else {
              const errorData = await response.json();
              console.error('Resposta de erro da API DeepSeek:', errorData);
              testResult = { success: false, message: `Falha na conexão com DeepSeek: ${errorData.error?.message || 'Erro desconhecido'}` };
          }
      }
    } catch (fetchError: any) {
      console.error(`Erro durante a chamada da API para o provedor ${provider}:`, fetchError);
      testResult = { success: false, message: `Erro na comunicação com o provedor ${provider}: ${fetchError.message}` };
    }


    console.log('Edge Function test-llm-key finalizada com sucesso.');
    return new Response(JSON.stringify(testResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('Erro não tratado em test-llm-key:', error); // This is the key log
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})