// Removido: /// <reference lib="deno.ns" />
import { serve } from 'std/http'; // Caminho atualizado para usar o alias
import { createClient } from '@supabase/supabase-js'; // Caminho atualizado para usar o alias
import { testLLMConnection } from 'shared/llm-providers'; // Caminho atualizado para usar o alias

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { modelId } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: model, error: modelError } = await supabaseClient
      .from('language_models')
      .select('provider, model_variant, api_key')
      .eq('id', modelId)
      .single();

    if (modelError || !model) {
      throw new Error(`Model not found: ${modelError?.message || 'Unknown error'}`);
    }

    const { success, errorMessage } = await testLLMConnection(
      model.provider,
      model.model_variant,
      model.api_key
    );

    if (success) {
      return new Response(JSON.stringify({ success: true, message: 'Conexão bem-sucedida!' }), {
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
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});