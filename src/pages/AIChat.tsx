import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2, Bot, User as UserIcon, ArrowLeft, PlusCircle, MessageSquareText, Pencil } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Profile {
  nome: string | null;
  apelido: string | null;
  avatar_url: string | null;
}

interface LanguageModel {
  id: string;
  provider: string;
  model_name: string | null;
  model_variant: string | null;
  system_message: string | null;
  avatar_url: string | null;
}

interface Conversation {
  id: string;
  user_id: string;
  model_id: string;
  title: string;
  language: string; // Adicionado
  created_at: string;
  updated_at: string;
}

interface AIChatMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'ai' | 'system';
  content: string;
  created_at: string;
}

const AIChat = () => {
  const { modelId, conversationId } = useParams<{ modelId: string; conversationId?: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [model, setModel] = useState<LanguageModel | null>(null);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);

  // Estados para edição de título
  const [isEditTitleDialogOpen, setIsEditTitleDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  // Estado para seleção de idioma
  const [selectedLanguage, setSelectedLanguage] = useState('Português'); // Default language

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

  const fetchConversations = useCallback(async (userId: string, currentModelId: string) => {
    setLoadingConversations(true);
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('model_id', currentModelId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      showError('Erro ao carregar histórico de conversas.');
    } else {
      setConversations(data || []);
    }
    setLoadingConversations(false);
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      showError('Erro ao carregar mensagens da conversa.');
      setMessages([]);
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const setupChat = async () => {
      setLoading(true);
      const { data: { user: loggedInUser } } = await supabase.auth.getUser();
      if (!loggedInUser) {
        navigate('/login');
        return;
      }
      setUser(loggedInUser);

      const { data: profileData, error: profileError } = await supabase
        .from('cliente')
        .select('nome, apelido, avatar_url')
        .eq('id', loggedInUser.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        showError('Erro ao carregar perfil do usuário.');
        navigate('/dashboard');
        return;
      }
      setProfile(profileData);

      if (!modelId) {
        showError('ID do modelo de IA não fornecido.');
        navigate('/language-models');
        return;
      }

      const { data: modelData, error: modelError } = await supabase
        .from('language_models')
        .select('id, provider, model_name, model_variant, system_message, avatar_url')
        .eq('id', modelId)
        .single();

      if (modelError || !modelData) {
        console.error('Error fetching model:', modelError);
        showError('Modelo de IA não encontrado ou acesso negado.');
        navigate('/language-models');
        return;
      }
      setModel(modelData);

      await fetchConversations(loggedInUser.id, modelId);

      if (conversationId) {
        const { data: convData, error: convError } = await supabase
          .from('ai_conversations')
          .select('*')
          .eq('id', conversationId)
          .eq('user_id', loggedInUser.id)
          .eq('model_id', modelId)
          .single();

        if (convError || !convData) {
          console.error('Error fetching specific conversation:', convError);
          showError('Conversa não encontrada ou acesso negado.');
          navigate(`/ai-chat/${modelId}`);
          return;
        }
        setCurrentConversation(convData);
        setSelectedLanguage(convData.language || 'Português'); // Carregar idioma salvo
        await fetchMessages(convData.id);
      } else {
        setCurrentConversation(null);
        setMessages([]);
        setSelectedLanguage('Português'); // Resetar para o padrão em nova conversa
        if (modelData.system_message) {
          setMessages([{
            id: 'system-intro',
            sender: 'ai',
            content: `Olá! Eu sou ${modelData.model_name || modelData.provider}. ${modelData.system_message}`,
            created_at: new Date().toISOString(),
            conversation_id: 'temp',
          }]);
        }
      }
      setLoading(false);
    };
    setupChat();
  }, [navigate, modelId, conversationId, fetchConversations, fetchMessages]);

  // Efeito para atualizar o idioma da conversa no DB quando selectedLanguage muda
  useEffect(() => {
    const updateConversationLanguage = async () => {
      if (currentConversation && user && selectedLanguage !== currentConversation.language) {
        const { error } = await supabase
          .from('ai_conversations')
          .update({ language: selectedLanguage })
          .eq('id', currentConversation.id)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating conversation language:', error);
          showError('Erro ao salvar o idioma da conversa.');
        } else {
          setCurrentConversation(prev => prev ? { ...prev, language: selectedLanguage } : null);
          showSuccess('Idioma da conversa atualizado!');
        }
      }
    };
    updateConversationLanguage();
  }, [selectedLanguage, currentConversation, user]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !model || sendingMessage) return;

    const userMessageContent = newMessage;
    setNewMessage('');
    setSendingMessage(true);

    let currentConvId = currentConversation?.id;
    let isNewConversation = !currentConvId;

    const userMessage: AIChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: userMessageContent,
      created_at: new Date().toISOString(),
      conversation_id: currentConvId || 'temp',
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const { data, error } = await supabase.functions.invoke('invoke-llm', {
        body: {
          modelId: model.id,
          userMessage: userMessageContent,
          conversationId: currentConvId,
          systemMessage: model.system_message,
          selectedLanguage: selectedLanguage, // Passar o idioma selecionado
        },
      });

      if (error) throw new Error(error.message);

      const { aiResponse, newConversationId, newConversationTitle } = data;

      if (isNewConversation && newConversationId && newConversationTitle) {
        const newConv: Conversation = {
          id: newConversationId,
          user_id: user.id,
          model_id: model.id,
          title: newConversationTitle,
          language: selectedLanguage, // Salvar o idioma na nova conversa
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setCurrentConversation(newConv);
        setConversations((prev) => [newConv, ...prev]);
        navigate(`/ai-chat/${modelId}/${newConversationId}`);
        currentConvId = newConversationId;
      }

      setMessages(prev => prev.map(msg =>
        msg.id === userMessage.id && currentConvId ? { ...msg, conversation_id: currentConvId } : msg
      ));

      const aiResponseMessage: AIChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        content: aiResponse || 'Não foi possível obter uma resposta do modelo de IA.',
        created_at: new Date().toISOString(),
        conversation_id: currentConvId || 'temp',
      };
      setMessages((prev) => [...prev, aiResponseMessage]);

      if (currentConvId) {
        fetchConversations(user.id, model.id);
      }

    } catch (err: any) {
      console.error('Error invoking LLM:', err);
      showError(`Erro ao conversar com a IA: ${err.message}`);
      const errorMessage: AIChatMessage = {
        id: `error-${Date.now()}`,
        sender: 'ai',
        content: 'Desculpe, houve um erro ao processar sua mensagem. Tente novamente.',
        created_at: new Date().toISOString(),
        conversation_id: currentConversation?.id || 'temp',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleNewChat = () => {
    setCurrentConversation(null);
    setMessages([]);
    setNewMessage('');
    setSelectedLanguage('Português'); // Resetar para o padrão ao iniciar nova conversa
    navigate(`/ai-chat/${modelId}`);
  };

  const handleSelectConversation = (convId: string) => {
    navigate(`/ai-chat/${modelId}/${convId}`);
  };

  const handleEditTitleClick = () => {
    if (currentConversation) {
      setEditTitle(currentConversation.title);
      setIsEditTitleDialogOpen(true);
    }
  };

  const handleSaveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentConversation || !editTitle.trim()) {
      showError('O título não pode ser vazio.');
      return;
    }

    setSendingMessage(true); // Reusing sendingMessage for general submission state
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .update({ title: editTitle.trim() })
        .eq('id', currentConversation.id)
        .eq('user_id', user.id);

      if (error) throw error;

      showSuccess('Título da conversa atualizado!');
      setIsEditTitleDialogOpen(false);
      fetchConversations(user.id, modelId as string); // Refresh list
      setCurrentConversation(prev => prev ? { ...prev, title: editTitle.trim() } : null); // Update current conversation title
    } catch (error: any) {
      showError(`Erro ao atualizar título: ${error.message}`);
      console.error('Error updating conversation title:', error);
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
  const aiAvatarUrl = model.avatar_url;

  const renderChatContent = () => (
    <Card className="flex-1 flex flex-col overflow-hidden h-full">
      <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => navigate('/standard-models')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Avatar className="h-8 w-8">
            <AvatarImage src={aiAvatarUrl || ''} alt={aiDisplayName} />
            <AvatarFallback><Bot className="h-5 w-5" /></AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl font-bold text-gray-800">{currentConversation?.title || aiDisplayName}</CardTitle>
            {currentConversation && (
              <Dialog open={isEditTitleDialogOpen} onOpenChange={setIsEditTitleDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleEditTitleClick}>
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Editar título</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Editar Título da Conversa</DialogTitle>
                    <DialogDescription>
                      Altere o título desta conversa para facilitar a organização.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSaveTitle} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-conversation-title">Novo Título</Label>
                      <Input
                        id="edit-conversation-title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Digite o novo título"
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsEditTitleDialogOpen(false)}>Cancelar</Button>
                      <Button type="submit" disabled={sendingMessage}>
                        {sendingMessage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="language-select" className="sr-only">Idioma</Label>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger id="language-select" className="w-[140px]">
              <SelectValue placeholder="Idioma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Português">Português</SelectItem>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Español">Español</SelectItem>
            </SelectContent>
          </Select>
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
          const timestamp = new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

          return (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${isCurrentUser ? 'justify-end' : ''}`}
            >
              {!isCurrentUser && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={aiAvatarUrl || ''} alt={aiDisplayName} />
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
              <AvatarImage src={aiAvatarUrl || ''} alt={aiDisplayName} />
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
  );

  const renderConversationList = () => (
    <div className="flex flex-col h-full bg-gray-50 border-r">
      <div className="p-4 border-b flex flex-col gap-2 bg-white">
        <h2 className="text-xl font-bold">Conversas com {aiDisplayName}</h2>
        <Button onClick={handleNewChat} className="w-full">
          <PlusCircle className="h-4 w-4 mr-2" /> Nova Conversa
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 p-2">
        {loadingConversations ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">Nenhuma conversa ainda.</p>
        ) : (
          conversations.map((conv) => (
            <Button
              key={conv.id}
              variant="ghost"
              className={cn(
                "w-full justify-start text-left h-auto py-2 px-3",
                currentConversation?.id === conv.id && "bg-blue-100 hover:bg-blue-200"
              )}
              onClick={() => handleSelectConversation(conv.id)}
            >
              <MessageSquareText className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">{conv.title}</span>
            </Button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      {isMobile ? (
        <div className="flex flex-col h-full w-full">
          {renderChatContent()}
        </div>
      ) : (
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel defaultSize={25} minSize={20} maxSize={30}>
            {renderConversationList()}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={75}>
            {renderChatContent()}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </>
  );
};

export default AIChat;