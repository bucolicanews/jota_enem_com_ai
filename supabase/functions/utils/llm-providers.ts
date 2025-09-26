// supabase/functions/utils/llm-providers.ts

import { getVertexAIAuthToken } from './google-auth.ts';

interface LLMMessage {
  role: string;
  content: string;
}

interface LLMResponse {
  aiResponse: string;
  success: boolean;
  errorMessage?: string;
}

export async function invokeLLM(
  provider: string,
  modelVariant: string,
  apiKey: string,
  messages: LLMMessage[],
  systemMessage: string | null,
): Promise<LLMResponse> {
  let aiResponse = 'Não foi possível obter uma resposta do modelo de IA.';
  let success = false;
  let errorMessage: string | undefined;

  try {
    // Prepare messages array, including system_message if available
    const messagesForLLM: { role: string; content: string }[] = [];
    
    let finalSystemMessage = systemMessage || '';
    finalSystemMessage += `\n\nResponda sempre em Português do Brasil.`;

    if (finalSystemMessage) {
      messagesForLLM.push({ role: 'system', content: finalSystemMessage.trim() });
    }

    messages.forEach(msg => {
      messagesForLLM.push({ role: msg.role, content: msg.content });
    });

    if (provider === 'OpenAI') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelVariant, messages: messagesForLLM, max_tokens: 500 })
      });
      if (response.ok) {
        const data = await response.json();
        aiResponse = data.choices[0]?.message?.content || aiResponse;
        success = true;
      } else {
        const errorData = await response.json();
        errorMessage = `Falha na conexão com OpenAI: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else if (provider === 'Google Gemini') {
      const accessToken = await getVertexAIAuthToken();
      const finalGeminiMessages = messagesForLLM.map(msg => ({
        role: msg.role === 'system' ? 'user' : msg.role, // Gemini doesn't have a 'system' role directly in content
        parts: [{ text: msg.content }]
      }));
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelVariant}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }, // Usar token de serviço
          body: JSON.stringify({ contents: finalGeminiMessages })
      });
      if (response.ok) {
        const data = await response.json();
        aiResponse = data.candidates[0]?.content?.parts[0]?.text || aiResponse;
        success = true;
      } else {
        const errorData = await response.json();
        errorMessage = `Erro na conexão com Gemini: ${errorData.error?.message || 'Erro desconhecido'}`;
        if (errorMessage.includes('Quota exceeded')) {
          errorMessage = 'Desculpe, o limite de uso da IA (Google Gemini) foi atingido. Por favor, tente novamente mais tarde ou considere verificar seu plano de API.';
        } else {
          errorMessage = 'Não foi possível acessar o modelo Gemini. Verifique se o modelo está correto e se sua chave de API tem as permissões necessárias.';
        }
      }
    } else if (provider === 'Anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: modelVariant, messages: messagesForLLM, max_tokens: 500 })
      });
      if (response.ok) {
        const data = await response.json();
        aiResponse = data.content[0]?.text || aiResponse;
        success = true;
      } else {
        const errorData = await response.json();
        errorMessage = `Erro na conexão com Anthropic: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else if (provider === 'Groq') {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelVariant, messages: messagesForLLM, max_tokens: 500 })
      });
      if (response.ok) {
        const data = await response.json();
        aiResponse = data.choices[0]?.message?.content || aiResponse;
        success = true;
      } else {
        const errorData = await response.json();
        errorMessage = `Falha na conexão com Groq: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else if (provider === 'DeepSeek') {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelVariant, messages: messagesForLLM, max_tokens: 500 })
      });
      if (response.ok) {
        const data = await response.json();
        aiResponse = data.choices[0]?.message?.content || aiResponse;
        success = true;
      } else {
        const errorData = await response.json();
        errorMessage = `Falha na conexão com DeepSeek: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else {
      errorMessage = `Provedor de IA '${provider}' não suportado.`;
    }
  } catch (fetchError: any) {
    errorMessage = `Erro na comunicação com o provedor ${provider}: ${fetchError.message}`;
  }

  return { aiResponse, success, errorMessage };
}

export async function testLLMConnection(
  provider: string,
  modelVariant: string,
  apiKey: string,
): Promise<LLMResponse> {
  let success = false;
  let message = 'Provedor não suportado';

  try {
    if (provider === 'OpenAI') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelVariant, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 })
      });
      if (response.ok) {
        success = true;
        message = 'Conexão com OpenAI bem-sucedida!';
      } else {
        const errorData = await response.json();
        message = `Falha na conexão com OpenAI: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else if (provider === 'Google Gemini') {
      const accessToken = await getVertexAIAuthToken();
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelVariant}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }, // Usar token de serviço
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] })
      });
      if (response.ok) {
        success = true;
        message = 'Conexão com Google Gemini bem-sucedida!';
      } else {
        const errorData = await response.json();
        message = `Falha na conexão com Gemini: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else if (provider === 'Anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: modelVariant, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 })
      });
      if (response.ok) {
        success = true;
        message = 'Conexão com Anthropic bem-sucedida!';
      } else {
        const errorData = await response.json();
        message = `Falha na conexão com Anthropic: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else if (provider === 'Groq') {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelVariant, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 })
      });
      if (response.ok) {
        success = true;
        message = 'Conexão com Groq bem-sucedida!';
      } else {
        const errorData = await response.json();
        message = `Falha na conexão com Groq: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else if (provider === 'DeepSeek') {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelVariant, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 })
      });
      if (response.ok) {
        success = true;
        message = 'Conexão com DeepSeek bem-sucedida!';
      } else {
        const errorData = await response.json();
        message = `Falha na conexão com DeepSeek: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    }
  } catch (fetchError: any) {
    message = `Erro na comunicação com o provedor ${provider}: ${fetchError.message}`;
  }

  return { aiResponse: message, success, errorMessage: message };
}