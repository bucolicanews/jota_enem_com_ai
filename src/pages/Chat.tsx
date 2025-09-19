import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2, Users, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';

interface Profile {
  id: string;
  nome: string | null;
  apelido: string | null;
  avatar_url: string | null;
}

interface Message {
  id:string;
  content: string;
  created_at: string;
  user_id: string;
  cliente: Profile | null;
}

interface OnlineUser {
  id: string;
  displayName: string;
  avatar_url: string;
}

const Chat = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Setup inicial do usuário e mensagens
  useEffect(() => {
    const setupChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      setUser(user);

      const { data: profileData, error: profileError } = await supabase
        .from('cliente')
        .select('id, nome, apelido, avatar_url')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        navigate('/dashboard');
        return;
      }
      setProfile(profileData);

      const { data: initialMessages, error: messagesError } = await supabase
        .from('messages')
        .select('*, cliente ( id, nome, apelido, avatar_url )')
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
      } else {
        setMessages(initialMessages as Message[]);
      }
      setLoading(false);
    };
    setupChat();
  }, [navigate]);

  // Gerenciamento de presença e novas mensagens
  useEffect(() => {
    if (!profile) return;

    const channel = supabase.channel('chat-room', {
      config: {
        presence: {
          key: profile.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState<OnlineUser>();
        const users = Object.values(newState).map(p => p[0]);
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setOnlineUsers(prev => [...prev, ...newPresences as unknown as OnlineUser[]]);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const leftIds = (leftPresences as unknown as OnlineUser[]).map(p => p.id);
        setOnlineUsers(prev => prev.filter(u => !leftIds.includes(u.id)));
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const newMessageId = payload.new.id;
          
          const { data: newMessageWithProfile, error } = await supabase
            .from('messages')
            .select('*, cliente ( id, nome, apelido, avatar_url )')
            .eq('id', newMessageId)
            .single();
          
          if (error) {
            console.error('Error fetching new message with profile:', error);
          } else if (newMessageWithProfile) {
            setMessages((prevMessages) => {
              if (prevMessages.some(msg => msg.id === newMessageId)) {
                return prevMessages;
              }
              return [...prevMessages, newMessageWithProfile as Message];
            });
          }
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ 
            id: profile.id, 
            displayName: profile.apelido || profile.nome || 'Aluno', 
            avatar_url: profile.avatar_url || '' 
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !profile) return;

    const content = newMessage;
    setNewMessage('');

    const { data, error } = await supabase
      .from('messages')
      .insert({ content: content, user_id: user.id })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      setNewMessage(content);
    } else if (data) {
      const sentMessage: Message = {
        ...(data as Omit<Message, 'cliente'>),
        cliente: profile,
      };
      setMessages((prevMessages) => [...prevMessages, sentMessage]);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '..';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const renderMessages = () => (
    <Card className="flex-1 flex flex-col overflow-hidden h-full">
      <CardContent className="flex-1 p-4 space-y-4 overflow-y-auto h-full">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const isCurrentUser = message.user_id === user?.id;
              const displayName = isCurrentUser 
                ? 'Você' 
                : message.cliente?.apelido || message.cliente?.nome || 'Aluno';
              const timestamp = new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${isCurrentUser ? 'justify-end' : ''}`}
                >
                  {!isCurrentUser && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={message.cliente?.avatar_url || ''} alt={displayName} />
                      <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
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
                      <p className="text-sm">{message.content}</p>
                    </div>
                    <p className="text-xs text-gray-500 px-1 mt-1">{displayName}, {timestamp}</p>
                  </div>
                  {isCurrentUser && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || ''} alt={profile?.apelido || profile?.nome || ''} />
                      <AvatarFallback>{getInitials(profile?.apelido || profile?.nome)}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </CardContent>
      <div className="p-4 border-t flex-shrink-0">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            autoComplete="off"
            disabled={!user}
          />
          <Button type="submit" size="icon" disabled={!user || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );

  const renderOnlineUsersDialog = () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8 mr-2">
          <Users className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alunos Online ({onlineUsers.length})</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col space-y-3 p-4 overflow-y-auto max-h-[400px]">
          {onlineUsers.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-200">
              <Avatar className="relative">
                <AvatarImage src={u.avatar_url} alt={u.displayName} />
                <AvatarFallback>{getInitials(u.displayName)}</AvatarFallback>
                <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
              </Avatar>
              <span className="font-medium">{u.displayName}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {isMobile ? (
        <div className="flex flex-col h-full w-full">
          
          <div className="flex-1 p-4 overflow-hidden h-full">
            {renderMessages()}
          </div>
        </div>
      ) : (
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel defaultSize={25} minSize={20} maxSize={30}>
            <div className="flex flex-col h-full bg-gray-50 border-r p-4">
              <h2 className="text-xl font-bold mb-4">Alunos Online ({onlineUsers.length})</h2>
              <div className="flex-1 overflow-y-auto space-y-3">
                {onlineUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-200">
                    <Avatar className="relative">
                      <AvatarImage src={u.avatar_url} alt={u.displayName} />
                      <AvatarFallback>{getInitials(u.displayName)}</AvatarFallback>
                      <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
                    </Avatar>
                    <span className="font-medium">{u.displayName}</span>
                  </div>
                ))}
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={75}>
            <div className="flex flex-col h-full p-4">
              {renderMessages()}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </>
  );
};

export default Chat;
