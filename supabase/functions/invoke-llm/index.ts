/// <reference path="../../deno.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'; // URL direta
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.2'; // URL direta
import { invokeLLM } from '../_shared/llm-providers.ts'; // Caminho relativo corrigido
import { consumeCredits } from '../_shared/consume-credits.ts'; // Caminho relativo corrigido

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { chatHistory, modelId, isStandardModel } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: model, error: modelError } = await supabaseClient
      .from('language_models')
      .select('provider, model_variant, api_key, system_message, is_standard')
      .eq('id', modelId)
      .single();

    if (modelError || !model) {
      throw new Error(`Model not found: ${modelError?.message || 'Unknown error'}`);
    }

    // Se for um modelo padrão e is_standard for true, consumir créditos
    if (isStandardModel && model.is_standard) {
      const { error: creditError } = await consumeCredits(supabaseClient, req.headers.get('Authorization')!);
      if (creditError) {
        return new Response(JSON.stringify({ success: false, message: creditError }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 402, // Payment Required
        });
      }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      return new Response(JSON.stringify({ success: false, message: errorMessage || 'Falha ao invocar o modelo de IA.' }), {
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