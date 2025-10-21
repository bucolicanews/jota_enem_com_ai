import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2, Bot, ArrowLeft, PlusCircle, MessageSquareText, Pencil, Trash2 } from 'lucide-react';
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
import { Label } from '@/components/ui/label';

// Interfaces
interface Profile {
  nome: string | null;
  apelido: string | null;
  avatar_url: string | null;
}

interface LanguageModel {
  id: string;
  provider: string;
  model_name: string | null;
  avatar_url: string | null;
}

interface Conversation {
  id: string;
  title: string;
}

interface AIChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'model';
  content: string;
  created_at: string;
}

interface ChatHistoryPart {
  role: 'user' | 'model';
  parts: { text: string }[];
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

  const [isEditTitleDialogOpen, setIsEditTitleDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [conversationToEdit, setConversationToEdit] = useState<Conversation | null>(null);

  const [isDeleteConversationDialogOpen, setIsDeleteConversationDialogOpen] = useState(false);
  const [conversationToDeleteId, setConversationToDeleteId] = useState<string | null>(null);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '..';
    const names = name.split(' ');
    return names.length > 1 ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendingMessage]);

  const fetchConversations = useCallback(async (userId: string, currentModelId: string) => {
    setLoadingConversations(true);
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('id, title')
      .eq('user_id', userId)
      .eq('model_id', currentModelId)
      .order('updated_at', { ascending: false });

    if (error) {
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
      showError('Erro ao carregar mensagens.');
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

      const { data: profileData } = await supabase.from('cliente').select('nome, apelido, avatar_url').eq('id', loggedInUser.id).single();
      setProfile(profileData);

      if (!modelId) {
        showError('ID do modelo de IA não fornecido.');
        navigate('/language-models');
        return;
      }

      const { data: modelData, error: modelError } = await supabase.from('language_models').select('id, provider, model_name, avatar_url').eq('id', modelId).single();
      if (modelError || !modelData) {
        showError('Modelo de IA não encontrado.');
        navigate('/language-models');
        return;
      }
      setModel(modelData);

      await fetchConversations(loggedInUser.id, modelId);

      if (conversationId) {
        const { data: convData } = await supabase.from('ai_conversations').select('id, title').eq('id', conversationId).single();
        if (!convData) {
          showError('Conversa não encontrada.');
          navigate(`/ai-chat/${modelId}`);
          return;
        }
        setCurrentConversation(convData);
        await fetchMessages(convData.id);
      } else {
        setCurrentConversation(null);
        setMessages([]);
      }
      setLoading(false);
    };
    setupChat();
  }, [navigate, modelId, conversationId, fetchConversations, fetchMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !model || sendingMessage) return;

    const userMessageContent = newMessage;
    setNewMessage('');
    setSendingMessage(true);

    const isNewConversation = !currentConversation;
    let success = false;

    const optimisticUserMessage: AIChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessageContent,
      created_at: new Date().toISOString(),
      conversation_id: currentConversation?.id || 'temp',
    };
    const updatedMessages = [...messages, optimisticUserMessage];
    setMessages(updatedMessages);

    const chatHistoryForAPI: ChatHistoryPart[] = updatedMessages.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('invoke-llm', {
        body: { modelId: model.id, chatHistory: chatHistoryForAPI },
      });

      if (invokeError || !data.success) {
        throw new Error(data?.message || invokeError?.message || 'A função Edge retornou um erro.');
      }

      let convId = currentConversation?.id;

      if (isNewConversation) {
        const title = userMessageContent.substring(0, 40) + (userMessageContent.length > 40 ? '...' : '');
        const { data: newConvData, error: newConvError } = await supabase
          .from('ai_conversations')
          .insert({ user_id: user.id, model_id: model.id, title })
          .select('id, title')
          .single();

        if (newConvError) throw newConvError;

        convId = newConvData.id;
        setCurrentConversation(newConvData);
        navigate(`/ai-chat/${modelId}/${convId}`, { replace: true });
      }

      const messagesToSave = [
        { conversation_id: convId, role: 'user' as const, content: userMessageContent },
        { conversation_id: convId, role: 'model' as const, content: data.aiResponse }
      ];

      const { error: insertError } = await supabase.from('ai_chat_messages').insert(messagesToSave);
      if (insertError) throw insertError;

      await fetchMessages(convId as string);
      success = true;

    } catch (err: any) {
      console.error('Error sending message:', err);
      showError(`Erro: ${err.message}`);
      setMessages(prev => prev.filter(msg => msg.id !== optimisticUserMessage.id));
    } finally {
      setSendingMessage(false);
      if (success && user && model) {
        fetchConversations(user.id, model.id);
      }
    }
  };

  const handleNewChat = () => {
    setCurrentConversation(null);
    setMessages([]);
    navigate(`/ai-chat/${modelId}`);
  };

  const handleSelectConversation = (convId: string) => {
    navigate(`/ai-chat/${modelId}/${convId}`);
  };

  const handleEditTitleClick = (conv: Conversation) => {
    setConversationToEdit(conv);
    setEditTitle(conv.title);
    setIsEditTitleDialogOpen(true);
  };

  const handleSaveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !conversationToEdit || !editTitle.trim()) return;
    try {
      const { error } = await supabase
        .from('ai_conversations').update({ title: editTitle.trim() }).eq('id', conversationToEdit.id);
      if (error) throw error;
      showSuccess('Título atualizado!');
      setIsEditTitleDialogOpen(false);
      fetchConversations(user.id, modelId as string);
      if (currentConversation?.id === conversationToEdit.id) {
        setCurrentConversation(prev => prev ? { ...prev, title: editTitle.trim() } : null);
      }
    } catch (error: any) {
      showError(`Erro ao atualizar título: ${error.message}`);
    }
  };

  const handleDeleteConversation = async () => {
    if (!user || !conversationToDeleteId || !modelId) return;
    try {
      const { error } = await supabase.rpc('delete_conversation_and_messages', { p_conversation_id: conversationToDeleteId, p_user_id: user.id });
      if (error) throw error;
      showSuccess('Conversa deletada com sucesso!');
      setIsDeleteConversationDialogOpen(false);
      if (currentConversation?.id === conversationToDeleteId) handleNewChat();
      fetchConversations(user.id, modelId);
    } catch (error: any) {
      showError(`Erro ao deletar conversa: ${error.message}`);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!model) return <div className="text-center p-4">Modelo não carregado.</div>;

  const aiDisplayName = model.model_name || model.provider;
  const userDisplayName = profile?.apelido || profile?.nome || 'Você';

  const renderChatContent = () => (
    <Card className="flex-1 flex flex-col overflow-hidden h-full">
      <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          {isMobile && <Button variant="ghost" size="icon" onClick={() => navigate('/standard-models')}><ArrowLeft className="h-5 w-5" /></Button>}
          <Avatar className="h-8 w-8"><AvatarImage src={model.avatar_url || ''} /><AvatarFallback><Bot /></AvatarFallback></Avatar>
          <CardTitle className="text-lg">{currentConversation?.title || aiDisplayName}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-4 space-y-4 overflow-y-auto">
        {messages.length === 0 && !sendingMessage ? (
          <div className="text-center h-full flex flex-col justify-center items-center">
            <Bot className="h-12 w-12 mb-4 text-gray-400" />
            <p>Comece a conversar com {aiDisplayName}.</p>
          </div>
        ) : (
          messages.map((message) => {
            const isCurrentUser = message.role === 'user';
            return (
              <div key={message.id} className={`flex items-start gap-3 ${isCurrentUser ? 'justify-end' : ''}`}>
                {!isCurrentUser && <Avatar className="h-8 w-8"><AvatarImage src={model.avatar_url || ''} /><AvatarFallback><Bot /></AvatarFallback></Avatar>}
                <div className={`rounded-lg px-3 py-2 max-w-md ${isCurrentUser ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {isCurrentUser && <Avatar className="h-8 w-8"><AvatarImage src={profile?.avatar_url || ''} /><AvatarFallback>{getInitials(userDisplayName)}</AvatarFallback></Avatar>}
              </div>
            );
          })
        )}

        {sendingMessage && (
          <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8"><AvatarImage src={model.avatar_url || ''} /><AvatarFallback><Bot /></AvatarFallback></Avatar>
            <div className="rounded-lg px-3 py-2 bg-gray-200 flex items-center space-x-1.5">
              <span className="h-2 w-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="h-2 w-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="h-2 w-2 bg-gray-500 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </CardContent>
      <div className="p-4 border-t">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Digite sua mensagem..." disabled={sendingMessage} autoComplete="off" />
          <Button type="submit" size="icon" disabled={!newMessage.trim() || sendingMessage}>
            {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </Card>
  );

  const renderConversationList = () => (
    <div className="flex flex-col h-full bg-gray-50 border-r">
      <div className="p-4 border-b"><Button onClick={handleNewChat} className="w-full"><PlusCircle className="mr-2 h-4 w-4" />Nova Conversa</Button></div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loadingConversations ? <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> :
          conversations.map((conv) => (
            <div key={conv.id} className="flex items-center group">
              <Button
                variant="ghost"
                className={cn("w-full justify-start truncate", currentConversation?.id === conv.id && "bg-blue-100")}
                onClick={() => handleSelectConversation(conv.id)}
              >
                <MessageSquareText className="mr-2 h-4 w-4" />{conv.title}
              </Button>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 flex-shrink-0" onClick={() => handleEditTitleClick(conv)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 flex-shrink-0" onClick={() => { setConversationToDeleteId(conv.id); setIsDeleteConversationDialogOpen(true); }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </div>
          ))}
      </div>
    </div>
  );

  return (
    <>
      {isMobile ? renderChatContent() : (
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>{renderConversationList()}</ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={75}>{renderChatContent()}</ResizablePanel>
        </ResizablePanelGroup>
      )}
      <Dialog open={isEditTitleDialogOpen} onOpenChange={setIsEditTitleDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Título da Conversa</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveTitle} className="space-y-4 py-4">
            <Label htmlFor="edit-title-input">Título</Label>
            <Input id="edit-title-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditTitleDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isDeleteConversationDialogOpen} onOpenChange={setIsDeleteConversationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Conversa?</DialogTitle>
            <DialogDescription>Esta ação é permanente e não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteConversationDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteConversation}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AIChat;