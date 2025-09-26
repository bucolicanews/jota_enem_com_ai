"use client";

// @ts-ignore: Deno imports are valid in runtime
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

// @ts-ignore: Deno imports are valid em runtime
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
// @ts-ignore: ESM imports are valid em runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para gerar um título a partir do texto
async function generateTitle(text: string): Promise<string> {
  // Limita o texto para evitar que seja muito longo para a IA
  const promptText = text.length > 150 ? text.substring(0, 150) + '...' : text;
  // Por enquanto, vamos pegar as primeiras palavras do prompt.
  const words = promptText.split(' ');
  let title = words.slice(0, Math.min(words.length, 5)).join(' ');
  if (words.length > 5) title += '...';
  
  return title.charAt(0).toUpperCase() + title.slice(1); // Capitaliza a primeira letra
}


serve(async (req) => {
  console.log('Edge Function invoke-llm started.');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Declarar variáveis em um escopo mais alto para que sejam acessíveis no bloco catch externo
  let aiResponse = 'Não foi possível obter uma resposta do modelo de IA.';
  let currentConversationId: string | undefined = undefined;
  let newConversationTitle: string | null = null;
  let modelProvider: string = 'unknown'; // Para logs de erro mais úteis
  let serviceClient: any; // Declarar aqui para garantir que esteja sempre em escopo para o log de erro, se necessário

  try {
    // Create a Supabase client with the user's auth token
    // @ts-ignore: Deno is available em runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore: Deno is available em runtime
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
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

    // Removido selectedLanguage e systemMessage do corpo da requisição
    const { modelId, userMessage, conversationId: incomingConversationId } = await req.json()
    if (!modelId || !userMessage) {
      console.log('Access denied: modelId e userMessage são obrigatórios.');
      return new Response(JSON.stringify({ error: 'modelId e userMessage são obrigatórios' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    console.log('Invoking modelId:', modelId);

    // Create a service role client to securely fetch the API key and user permissions
    // @ts-ignore: Deno is available em runtime
    serviceClient = createClient( // Atribuir à variável de escopo mais alto
        // @ts-ignore: Deno is available em runtime
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore: Deno is available em runtime
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch user's permission level
    console.log('Fetching client profile for user:', user.id);
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
    console.log('Client profile fetched, permissao_id:', clientProfile.permissao_id);

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
    console.log('User permissions:', { permissionName, isPro, isProf, isAdmin });

    // 2. Fetch the model by ID, including system_message
    console.log('Fetching language model for modelId:', modelId);
    const { data: model, error: dbError } = await serviceClient
      .from('language_models')
      .select('api_key, provider, model_name, model_variant, is_standard, user_id, system_message')
      .eq('id', modelId)
      .single()

    if (dbError || !model) {
      console.error('Model not found in DB or DB error:', dbError);
      return new Response(JSON.stringify({ error: 'Modelo de IA não encontrado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }
    console.log('Model fetched:', { id: model.id, provider: model.provider, model_variant: model.model_variant, is_standard: model.is_standard, user_id: model.user_id });

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
    console.log('Access granted to AI model.');

    // 4. Consume credits for 'perguntas'
    console.log('Attempting to consume 1 credit for "perguntas" for user:', user.id);
    const consumeCreditsResponse = await supabaseClient.functions.invoke('consume-credits', {
      body: { creditType: 'perguntas', amount: 1 },
    });

    if (consumeCreditsResponse.error) {
      console.error('Error consuming credits:', consumeCreditsResponse.error);
      return new Response(JSON.stringify({ error: consumeCreditsResponse.error.message || 'Erro ao consumir créditos de perguntas.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403, // Forbidden due to insufficient credits
      });
    }
    console.log('Credits consumed successfully. New credits:', consumeCreditsResponse.data.newCredits);


    const { api_key, provider, model_variant, system_message } = model;
    modelProvider = provider; // Atribuir à variável de escopo mais alto
    
    currentConversationId = incomingConversationId; // Atribuir à variável de escopo mais alto

    // Handle conversation creation and message saving
    if (!currentConversationId) {
      // Create new conversation
      const generatedTitle = await generateTitle(userMessage);
      console.log('Attempting to create new conversation with title:', generatedTitle);
      const { data: newConv, error: convError } = await serviceClient
        .from('ai_conversations')
        .insert({ user_id: user.id, model_id: modelId, title: generatedTitle /* language: selectedLanguage */ }) // Removido 'language'
        .select('id, title')
        .single();

      if (convError || !newConv) {
        console.error('Error creating new conversation:', convError);
        throw new Error('Erro ao iniciar nova conversa.'); // Throw error for outer catch
      }
      currentConversationId = newConv.id;
      newConversationTitle = newConv.title;
      console.log('New conversation created successfully. ID:', currentConversationId, 'Title:', newConversationTitle);
    } else {
      // Update conversation's updated_at timestamp
      console.log('Updating conversation timestamp for conversationId:', currentConversationId);
      const { error: updateConvError } = await serviceClient
        .from('ai_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentConversationId)
        .eq('user_id', user.id); // Ensure user owns the conversation
      if (updateConvError) {
        console.error('Error updating conversation timestamp:', updateConvError);
      } else {
        console.log('Conversation timestamp updated for conversationId:', currentConversationId);
      }
    }

    // Save user message
    console.log('Attempting to save user message for conversationId:', currentConversationId);
    const { error: userMsgError } = await serviceClient
      .from('ai_chat_messages')
      .insert({ conversation_id: currentConversationId, sender: 'user', content: userMessage });
    if (userMsgError) {
        console.error('Error saving user message:', userMsgError);
    } else {
        console.log('User message saved to ai_chat_messages.');
    }

    // Fetch previous messages for context
    const { data: previousMessages, error: messagesError } = await serviceClient
      .from('ai_chat_messages')
      .select('sender, content')
      .eq('conversation_id', currentConversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching previous messages:', messagesError);
      // Continue without previous messages if there's an error
    }

    // Prepare messages array, including system_message if available
    const messagesForLLM: { role: string; content: string }[] = [];
    
    let finalSystemMessage = system_message || '';
    // Adicionar instrução explícita para responder em português
    finalSystemMessage += `\n\nResponda sempre em Português do Brasil.`;

    if (finalSystemMessage) {
      messagesForLLM.push({ role: 'system', content: finalSystemMessage.trim() });
    }

    // Add previous messages to context
    if (previousMessages) {
      previousMessages.forEach(msg => {
        messagesForLLM.push({ role: msg.sender === 'user' ? 'user' : 'model', content: msg.content });
      });
    }
    
    // Add current user message (already saved, but needed for LLM context)
    // A instrução de idioma foi movida para o system message para ser mais consistente
    messagesForLLM.push({ role: 'user', content: userMessage });
    console.log('Messages prepared for LLM:', messagesForLLM);

    // Invoke the appropriate LLM based on the provider
    if (provider === 'OpenAI') {
        console.log('Invoking OpenAI model:', model_variant);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
            body: JSON.stringify({ model: model_variant, messages: messagesForLLM, max_tokens: 500 })
        });
        if (response.ok) {
            const data = await response.json();
            aiResponse = data.choices[0]?.message?.content || aiResponse;
            console.log('OpenAI response received.');
        } else {
            const errorData = await response.json();
            console.error('OpenAI API error:', errorData);
            throw new Error(`Falha na conexão com OpenAI: ${errorData.error?.message || 'Erro desconhecido'}`);
        }
    } 
    else if (provider === 'Google Gemini') {
        console.log('Invoking Google Gemini model:', model_variant);
        const finalGeminiMessages = messagesForLLM.map(msg => ({
          role: msg.role === 'system' ? 'user' : msg.role, // Gemini doesn't have a 'system' role directly in content
          parts: [{ text: msg.content }]
        }));
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model_variant}:generateContent?key=${api_key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: finalGeminiMessages })
        });
        if (response.ok) {
            const data = await response.json();
            aiResponse = data.candidates[0]?.content?.parts[0]?.text || aiResponse;
            console.log('Google Gemini response received.');
        } else {
            const errorData = await response.json();
            console.error('Gemini API error:', errorData);
            const errorMessage = errorData.error?.message || 'Erro desconhecido';
            if (errorMessage.includes('Quota exceeded') || errorMessage.includes('limit: 0')) {
                throw new Error('Parece que o limite de uso da sua chave de API do Google Gemini foi atingido. Por favor, verifique seu plano e detalhes de faturamento no Google AI Studio, ou tente novamente mais tarde.');
            } else {
                // Lançar erro para qualquer outro tipo de falha do Gemini
                throw new Error('Não foi possível acessar o modelo Gemini. Verifique se o modelo está correto e se sua chave de API tem as permissões necessárias.');
            }
        }
    } 
    else if (provider === 'Anthropic') {
        console.log('Invoking Anthropic model:', model_variant);
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': api_key, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: model_variant, messages: messagesForLLM, max_tokens: 500 })
        });
        if (response.ok) {
            const data = await response.json();
            aiResponse = data.content[0]?.text || aiResponse;
            console.log('Anthropic response received.');
        } else {
            const errorData = await response.json();
            console.error('Anthropic API error:', errorData);
            throw new Error(`Falha na conexão com Anthropic: ${errorData.error?.message || 'Erro desconhecido'}`);
        }
    }
    else if (provider === 'Groq') {
        console.log('Invoking Groq model:', model_variant);
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
            body: JSON.stringify({ model: model_variant, messages: messagesForLLM, max_tokens: 500 })
        });
        if (response.ok) {
            const data = await response.json();
            aiResponse = data.choices[0]?.message?.content || aiResponse;
            console.log('Groq response received.');
        } else {
            const errorData = await response.json();
            console.error('Groq API error:', errorData);
            throw new Error(`Falha na conexão com Groq: ${errorData.error?.message || 'Erro desconhecido'}`);
        }
    }
    else if (provider === 'DeepSeek') {
        console.log('Invoking DeepSeek model:', model_variant);
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
            body: JSON.stringify({ model: model_variant, messages: messagesForLLM, max_tokens: 500 })
        });
        if (response.ok) {
            const data = await response.json();
            aiResponse = data.choices[0]?.message?.content || aiResponse;
            console.log('DeepSeek response received.');
        } else {
            const errorData = await response.json();
            console.error('DeepSeek API error:', errorData);
            throw new Error(`Falha na conexão com DeepSeek: ${errorData.error?.message || 'Erro desconhecido'}`);
        }
    }
    else {
      throw new Error(`Provedor de IA '${provider}' não suportado.`);
    }


    // Save AI response
    console.log('Attempting to save AI message for conversationId:', currentConversationId);
    const { error: aiMsgError } = await serviceClient
      .from('ai_chat_messages')
      .insert({ conversation_id: currentConversationId, sender: 'ai', content: aiResponse });
    if (aiMsgError) {
        console.error('Error saving AI message:', aiMsgError);
    } else {
        console.log('AI response saved to ai_chat_messages.');
    }


    console.log('Edge Function invoke-llm finished successfully.');
    return new Response(JSON.stringify({ aiResponse, newConversationId: currentConversationId, newConversationTitle }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error(`Erro interno na função Edge invoke-llm (provedor: ${modelProvider}):`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // Use 500 for internal errors, or 400 for client-side issues like invalid input
    })
  }
})