// supabase/functions/test-llm-key/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
// Certifique-se de que o caminho para seu arquivo compartilhado está correto
import { testLLMConnection } from '../_shared/llm-providers.ts'; 

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LanguageModel {
  provider: string;
  model_variant: string;
  api_key: string;
}

serve(async (req) => {
  // Lida com a requisição de verificação (preflight) do navegador
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    // 1. Obter variáveis de ambiente
    // @ts-ignore: Deno está disponível no runtime do Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore: Deno is available in runtime
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // 2. Validar o corpo da requisição
    let parsedBody;
    try {
      const rawBody = await req.text();
      if (!rawBody) {
        throw new Error("O corpo da requisição está vazio.");
      }
      parsedBody = JSON.parse(rawBody);
    } catch (e: any) {
      console.error('Erro ao analisar JSON:', e.message);
      return new Response(JSON.stringify({ success: false, message: `Corpo da requisição inválido: ${e.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    const { modelId } = parsedBody;
    if (!modelId) {
      throw new Error("A propriedade 'modelId' é obrigatória.");
    }

    // 3. Autenticar o usuário
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, message: 'Não autorizado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    
    // 4. Buscar os dados do modelo no banco
    const { data: model, error: modelError } = await supabaseClient
      .from('language_models')
      .select('provider, model_variant, api_key')
      .eq('id', modelId)
      .single<LanguageModel>();

    if (modelError || !model) {
      throw new Error(`Modelo não encontrado ou acesso negado: ${modelError?.message || 'Erro desconhecido'}`);
    }

    // 5. Chamar a função de teste
    const { success, errorMessage, message } = await testLLMConnection(
      model.provider,
      model.model_variant,
      model.api_key
    );

    if (success) {
      return new Response(JSON.stringify({ success: true, message: message || 'Conexão bem-sucedida!' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      return new Response(JSON.stringify({ success: false, message: errorMessage || 'Falha ao testar a conexão.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
  } catch (error: any) {
    console.error('Erro na Edge Function:', error.message);
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // Erro interno do servidor
    });
  }
});