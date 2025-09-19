import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2, Bot, User as UserIcon, ArrowLeft } from 'lucide-react';
import { showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: string;
}

interface LanguageModel {
  id: string;
  provider: string;
  model_name: string | null;
  model_variant: string | null;
}

const AIChat = () => {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ nome: string | null; apelido: string | null; avatar_url: string | null } | null>(null);
  const [model, setModel] = useState<LanguageModel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '..';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const setupChat = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      setUser(user);

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('cliente')
        .select('nome, apelido, avatar_url')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        showError('Erro ao carregar perfil do usuário.');
        navigate('/dashboard');
        return;
      }
      setProfile(profileData);

      // Fetch AI model details
      if (!modelId) {
        showError('ID do modelo de IA não fornecido.');
        navigate('/language-models');
        return;
      }

      const { data: modelData, error: modelError } = await supabase
        .from('language_models')
        .select('id, provider, model_name, model_variant')
        .eq('id', modelId)
        .eq('user_id', user.id) // Ensure user owns the model
        .single();

      if (modelError || !modelData) {
        console.error('Error fetching model:', modelError);
        showError('Modelo de IA não encontrado ou acesso negado.');
        navigate('/language-models');
        return;
      }
      setModel(modelData);
      setLoading(false);
    };
    setupChat();
  }, [navigate, modelId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !model || sendingMessage) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: newMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const messageContent = newMessage;
    setNewMessage('');
    setSendingMessage(true);

    try {
      const { data, error } = await supabase.functions.invoke('invoke-llm', {
        body: { modelId: model.id, userMessage: messageContent },
      });

      if (error) throw new Error(error.message);

      const aiResponse: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        content: data.aiResponse || 'Não foi possível obter uma resposta do modelo de IA.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (err: any) {
      console.error('Error invoking LLM:', err);
      showError(`Erro ao conversar com a IA: ${err.message}`);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        sender: 'ai',
        content: 'Desculpe, houve um erro ao processar sua mensagem. Tente novamente.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Modelo de IA não carregado</h1>
        <p className="text-muted-foreground mb-6">Por favor, selecione um modelo válido na página de configurações.</p>
        <Button onClick={() => navigate('/language-models')}>Voltar para Modelos de IA</Button>
      </div>
    );
  }

  const aiDisplayName = model.model_name || model.provider;

  return (
    <div className="flex flex-col h-full w-full">
      <Card className="flex-1 flex flex-col overflow-hidden h-full">
        <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/language-models')} className="lg:hidden">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Bot className="h-6 w-6 text-blue-600" />
            <CardTitle className="text-xl font-bold text-gray-800">{aiDisplayName}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-4 space-y-4 overflow-y-auto h-full">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Bot className="h-16 w-16 mb-4 text-gray-400" />
              <p className="text-lg">Comece a conversar com {aiDisplayName}!</p>
              <p className="text-sm">Pergunte sobre o ENEM, dicas de estudo ou qualquer coisa que precisar.</p>
            </div>
          )}
          {messages.map((message) => {
            const isCurrentUser = message.sender === 'user';
            const displayName = isCurrentUser ? (profile?.apelido || profile?.nome || 'Você') : aiDisplayName;
            const timestamp = new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${isCurrentUser ? 'justify-end' : ''}`}
              >
                {!isCurrentUser && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback><Bot className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                )}
                <div className={`flex flex-col gap-1 ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`rounded-lg px-3 py-2 max-w-xs md:max-w-md ${
                      isCurrentUser
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <p className="text-xs text-gray-500 px-1 mt-1">{displayName}, {timestamp}</p>
                </div>
                {isCurrentUser && (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url || ''} alt={displayName} />
                    <AvatarFallback>{getInitials(profile?.apelido || profile?.nome)}</AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })}
          {sendingMessage && (
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback><Bot className="h-5 w-5" /></AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1 items-start">
                <div className="rounded-lg px-3 py-2 max-w-xs md:max-w-md bg-gray-200 text-gray-800">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <p className="text-xs text-gray-500 px-1 mt-1">{aiDisplayName} está digitando...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
        <div className="p-4 border-t flex-shrink-0">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              autoComplete="off"
              disabled={sendingMessage}
            />
            <Button type="submit" size="icon" disabled={!newMessage.trim() || sendingMessage}>
              {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default AIChat;