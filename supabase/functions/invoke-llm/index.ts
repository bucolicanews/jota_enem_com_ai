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
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { modelId, userMessage } = await req.json()
    if (!modelId || !userMessage) {
      return new Response(JSON.stringify({ error: 'modelId e userMessage são obrigatórios' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

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

    // 2. Fetch the model by ID, including system_message
    const { data: model, error: dbError } = await serviceClient
      .from('language_models')
      .select('api_key, provider, model_name, model_variant, is_standard, user_id, system_message') // Added system_message
      .eq('id', modelId)
      .single()

    if (dbError || !model) {
      return new Response(JSON.stringify({ error: 'Modelo de IA não encontrado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

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
      return new Response(JSON.stringify({ error: 'Acesso negado ao modelo de IA.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const { api_key, provider, model_variant, system_message } = model;
    
    let aiResponse = 'Não foi possível obter uma resposta do modelo de IA.';

    // Prepare messages array, including system_message if available
    const messages: { role: string; content: string }[] = [];
    if (system_message) {
      messages.push({ role: 'system', content: system_message });
    }
    messages.push({ role: 'user', content: userMessage });

    // Invoke the appropriate LLM based on the provider
    if (provider === 'OpenAI') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
            body: JSON.stringify({ model: model_variant, messages, max_tokens: 500 })
        });
        if (response.ok) {
            const data = await response.json();
            aiResponse = data.choices[0]?.message?.content || aiResponse;
        } else {
            const errorData = await response.json();
            console.error('OpenAI API error:', errorData);
            aiResponse = `Erro na conexão com OpenAI: ${errorData.error?.message || 'Erro desconhecido'}`;
        }
    } 
    else if (provider === 'Google Gemini') {
        const geminiMessages = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model', // Gemini uses 'user' and 'model' roles
            parts: [{ text: msg.content }]
        }));
        // Gemini's generateContent endpoint expects a slightly different structure for system messages
        // For simplicity, we'll put system message as first user message for now, or handle it differently
        // A more robust solution might involve a dedicated system instruction field if supported by Gemini API
        // For now, we'll just send user message and rely on system_message for context.
        // If system_message is crucial, it might need to be prepended to the user's message or handled by a specific Gemini API feature.
        // For now, let's assume the system_message is implicitly handled by the model's training or a more advanced API call.
        // Reverting to simple user message for Gemini as direct system role is not standard in generateContent.
        // A better approach for Gemini system instructions would be to use the `system_instruction` field in the `GenerateContentRequest` if available,
        // or prepend it to the first user message. For this example, we'll keep it simple and just send the user message.
        // If `system_message` is critical for Gemini, it needs a different integration.
        // For now, let's pass the system message as a "user" message at the beginning of the conversation for Gemini.
        const finalGeminiMessages = [];
        if (system_message) {
            finalGeminiMessages.push({ role: 'user', parts: [{ text: system_message }] });
            finalGeminiMessages.push({ role: 'model', parts: [{ text: 'Ok, entendi. Como posso ajudar?' }] }); // Simulate AI acknowledging system message
        }
        finalGeminiMessages.push({ role: 'user', parts: [{ text: userMessage }] });


        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model_variant}:generateContent?key=${api_key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: finalGeminiMessages })
        });
        if (response.ok) {
            const data = await response.json();
            aiResponse = data.candidates[0]?.content?.parts[0]?.text || aiResponse;
        } else {
            const errorData = await response.json();
            console.error('Gemini API error:', errorData);
            aiResponse = `Erro na conexão com Gemini: ${errorData.error?.message || 'Erro desconhecido'}`;
        }
    } 
    else if (provider === 'Anthropic') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': api_key, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: model_variant, messages, max_tokens: 500 })
        });
        if (response.ok) {
            const data = await response.json();
            aiResponse = data.content[0]?.text || aiResponse;
        } else {
            const errorData = await response.json();
            console.error('Anthropic API error:', errorData);
            aiResponse = `Erro na conexão com Anthropic: ${errorData.error?.message || 'Erro desconhecido'}`;
        }
    }
    else if (provider === 'Groq') {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
            body: JSON.stringify({ model: model_variant, messages, max_tokens: 500 })
        });
        if (response.ok) {
            const data = await response.json();
            aiResponse = data.choices[0]?.message?.content || aiResponse;
        } else {
            const errorData = await response.json();
            console.error('Groq API error:', errorData);
            aiResponse = `Erro na conexão com Groq: ${errorData.error?.message || 'Erro desconhecido'}`;
        }
    }
    else if (provider === 'DeepSeek') {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
            body: JSON.stringify({ model: model_variant, messages, max_tokens: 500 })
        });
        if (response.ok) {
            const data = await response.json();
            aiResponse = data.choices[0]?.message?.content || aiResponse;
        } else {
            const errorData = await response.json();
            console.error('DeepSeek API error:', errorData);
            aiResponse = `Erro na conexão com DeepSeek: ${errorData.error?.message || 'Erro desconhecido'}`;
        }
    }

    return new Response(JSON.stringify({ aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('Erro interno na função Edge invoke-llm:', error);
    return new Response(JSON.stringify({ error: `Erro interno: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})