// supabase/functions/invoke-llm/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

// --- CORREÇÃO NOS CAMINHOS DE IMPORTAÇÃO ---
// O caminho correto para buscar os arquivos na pasta compartilhada.
import { invokeLLM } from '../_shared/llm-providers.ts';
import { consumeCredits } from '../_shared/consume-credits.ts'; 
// (Assumindo que consume-credits.ts também está na pasta _shared)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LanguageModel {
  provider: string;
  model_variant: string;
  api_key: string;
  system_message: string | null;
  is_standard: boolean;
  model_name: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    // @ts-ignore: Deno está disponível no runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore: Deno está disponível no runtime
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    // @ts-ignore: Deno está disponível no runtime
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    let parsedBody;
    try {
      const rawBody = await req.text();
      if (!rawBody) throw new Error("O corpo da requisição está vazio.");
      parsedBody = JSON.parse(rawBody);
    } catch (parseError: any) {
      return new Response(JSON.stringify({ success: false, message: `Erro ao analisar o corpo da requisição: ${parseError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const { chatHistory, modelId } = parsedBody;

    if (!chatHistory || !Array.isArray(chatHistory) || chatHistory.length === 0) {
      return new Response(JSON.stringify({ success: false, message: 'O histórico da conversa (chatHistory) é obrigatório.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userAuthError } = await supabaseClient.auth.getUser();
    if (userAuthError || !user) {
      return new Response(JSON.stringify({ success: false, message: 'Não autorizado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      });
    }

    const { data: model, error: modelError } = await supabaseClient
      .from('language_models')
      .select('provider, model_variant, api_key, system_message, is_standard, model_name')
      .eq('id', modelId)
      .single<LanguageModel>();

    if (modelError || !model) {
      throw new Error(`Modelo não encontrado: ${modelError?.message || 'Erro desconhecido'}`);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });
    
    // Supondo que a função consumeCredits precise do cliente admin e do ID do usuário
    const { error: creditError } = await consumeCredits(supabaseAdmin, user.id);
    if (creditError) {
      return new Response(JSON.stringify({ success: false, message: creditError }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402,
      });
    }

    const { aiResponse, success, errorMessage } = await invokeLLM(
      model.provider,
      model.model_variant,
      model.api_key,
      chatHistory,
      model.system_message
    );

    if (success) {
      return new Response(JSON.stringify({ success: true, aiResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    } else {
      return new Response(JSON.stringify({ success: false, message: errorMessage || 'Falha ao invocar o modelo de IA.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});