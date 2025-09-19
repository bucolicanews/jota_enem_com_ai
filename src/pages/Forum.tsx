import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, MessageSquare, Search, Pencil, Trash2, Send, ArrowLeft } from 'lucide-react';
import { CreateTopicDialog } from '@/components/CreateTopicDialog';
import { EditTopicDialog } from '@/components/EditTopicDialog';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Profile {
  id: string;
  nome: string | null;
  apelido: string | null;
  avatar_url: string | null;
}

interface Topic {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  cliente: Profile | null;
  forum_comments: { count: number }[];
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  cliente: Profile | null;
}

const Forum = () => {
  const { topicId } = useParams<{ topicId?: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingTopicDetail, setLoadingTopicDetail] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const isMobile = useIsMobile();
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<'topic' | 'comment' | null>(null);
  const [commentToDeleteId, setCommentToDeleteId] = useState<string | null>(null);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '..';
    const names = name.split(' ');
    return names.length > 1 ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  const fetchTopics = useCallback(async () => {
    setLoadingTopics(true);
    
    let topicsQuery = supabase
      .from('forum_topics')
      .select('id, user_id, title, created_at, forum_comments(count)')
      .order('created_at', { ascending: false });

    if (searchTerm.trim()) {
      topicsQuery = topicsQuery.ilike('title', `%${searchTerm.trim()}%`);
    }

    const { data: topicsData, error: topicsError } = await topicsQuery;

    if (topicsError) {
      console.error('Error fetching topics:', topicsError);
      showError('Não foi possível carregar os tópicos.');
      setLoadingTopics(false);
      return;
    }

    if (!topicsData || topicsData.length === 0) {
      setTopics([]);
      setLoadingTopics(false);
      return;
    }

    const userIds = [...new Set(topicsData.map((t: any) => t.user_id))];
    const { data: profilesData, error: profilesError } = await supabase
      .from('cliente')
      .select('id, nome, apelido, avatar_url')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    const profilesById = (profilesData || []).reduce((acc: any, p: Profile) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const topicsWithProfiles = topicsData.map((topic: any) => ({
      ...topic,
      cliente: profilesById[topic.user_id] || null,
    }));

    setTopics(topicsWithProfiles as unknown as Topic[]);
    setLoadingTopics(false);
  }, [searchTerm]);

  const fetchTopicDetail = useCallback(async (id: string) => {
    setLoadingTopicDetail(true);
    setSelectedTopic(null);
    setComments([]);
    
    // 1. Busca os dados do tópico sem o join implícito.
    const { data: topicData, error: topicError } = await supabase
      .from('forum_topics')
      .select('*, user_id')
      .eq('id', id)
      .single();

    if (topicError || !topicData) {
      showError('Tópico não encontrado.');
      navigate('/forum');
      setLoadingTopicDetail(false);
      return;
    }

    // 2. Busca os comentários separadamente.
    const { data: commentsData, error: commentsError } = await supabase
      .from('forum_comments')
      .select('*')
      .eq('topic_id', id)
      .order('created_at', { ascending: true });

    if (commentsError) {
      showError('Erro ao carregar comentários.');
    }
    
    // 3. Coleta os IDs de todos os usuários (tópico e comentários).
    const userIds = new Set<string>();
    userIds.add(topicData.user_id);
    if (commentsData) {
      commentsData.forEach((c: any) => userIds.add(c.user_id));
    }

    // 4. Busca todos os perfis dos usuários de uma vez.
    const { data: profilesData, error: profilesError } = await supabase
      .from('cliente')
      .select('id, nome, apelido, avatar_url')
      .in('id', Array.from(userIds));

    if (profilesError) {
      showError('Não foi possível carregar os perfis dos usuários.');
    }

    // 5. Mapeia os perfis para um objeto de busca rápida.
    const profilesById = (profilesData || []).reduce((acc: any, p: Profile) => {
      acc[p.id] = p;
      return acc;
    }, {});

    // 6. Anexa o perfil ao tópico e aos comentários.
    const topicWithProfile = {
      ...topicData,
      cliente: profilesById[topicData.user_id] || null,
    };

    const commentsWithProfiles = (commentsData || []).map((comment: any) => ({
      ...comment,
      cliente: profilesById[comment.user_id] || null,
    }));

    setSelectedTopic(topicWithProfile as Topic);
    setComments(commentsWithProfiles as Comment[]);
    setLoadingTopicDetail(false);
  }, [navigate]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) navigate('/login');
      else setUser(user);
    };
    getUser();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      const delayDebounceFn = setTimeout(() => fetchTopics(), 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchTerm, user, fetchTopics]);

  useEffect(() => {
    if (topicId) {
      fetchTopicDetail(topicId);
    } else {
      setSelectedTopic(null);
      setComments([]);
    }
  }, [topicId, fetchTopicDetail]);

  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  const handleSelectTopic = (id: string) => {
    navigate(`/forum/${id}`);
  };

  const handleDeleteTopic = async () => {
    if (!selectedTopic) return;
    const { error } = await supabase.from('forum_topics').delete().eq('id', selectedTopic.id);
    if (error) {
      showError('Erro ao deletar o tópico.');
      console.error('Delete topic error:', error);
    } else {
      showSuccess('Tópico deletado com sucesso.');
      navigate('/forum');
      fetchTopics();
    }
  };

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !topicId || !newComment.trim()) return;

    const { error } = await supabase
      .from('forum_comments')
      .insert({ user_id: user.id, topic_id: topicId, content: newComment });

    if (error) {
      showError('Erro ao publicar comentário.');
      console.error('Create comment error:', error);
    } else {
      setNewComment('');
      fetchTopicDetail(topicId);
    }
  };

  const handleDeleteComment = async () => {
    if (!commentToDeleteId) return;
    const { error } = await supabase.from('forum_comments').delete().eq('id', commentToDeleteId);
    if (error) {
      showError('Erro ao deletar o comentário.');
      console.error('Delete comment error:', error);
    } else {
      showSuccess('Comentário deletado.');
      fetchTopicDetail(topicId as string);
    }
  };

  const handleDeleteConfirmation = () => {
    if (itemToDelete === 'topic') {
      handleDeleteTopic();
    } else if (itemToDelete === 'comment') {
      handleDeleteComment();
    }
    setIsDeleteDialogOpen(false);
  };

  const renderTopicList = () => (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="p-4 border-b flex items-center gap-4 bg-white">
        <div className="relative w-full">         
          <h1>Assuntos</h1>          
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loadingTopics ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {topics.map(topic => (
              <button key={topic.id} onClick={() => handleSelectTopic(topic.id)} className={cn("w-full text-left p-3 rounded-lg transition-colors", topicId === topic.id ? "bg-blue-100" : "hover:bg-gray-100")}>
                <p className="font-semibold text-sm truncate">{topic.title}</p>
                <div className="flex justify-between items-center text-xs text-muted-foreground mt-2">
                  <div className="flex items-center gap-2 truncate">
                    <Avatar className="h-5 w-5"><AvatarImage src={topic.cliente?.avatar_url || ''} /><AvatarFallback>{getInitials(topic.cliente?.apelido)}</AvatarFallback></Avatar>
                    <span className="truncate">{topic.cliente?.apelido || topic.cliente?.nome || 'Aluno'}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0"><MessageSquare className="h-3 w-3" />{topic.forum_comments[0]?.count || 0}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderTopicDetail = () => (
    <div className="h-full flex flex-col bg-white">
      {loadingTopicDetail ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      ) : !selectedTopic ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Selecione um tópico para ver os detalhes</div>
      ) : (
        <>
          <div className="p-4 border-b flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate('/forum')} className="lg:hidden"><ArrowLeft className="h-5 w-5" /></Button>
              <h1 className="text-xl font-bold text-gray-800 truncate">{selectedTopic.title}</h1>
            </div>
            {user?.id === selectedTopic.user_id && (
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => {
                    setItemToDelete('topic');
                    setIsDeleteDialogOpen(true);
                  }}
                ><Trash2 className="mr-2 h-4 w-4" /> Deletar</Button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <Card>
              <CardContent className="p-6 whitespace-pre-wrap">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-10 w-10"><AvatarImage src={selectedTopic.cliente?.avatar_url || ''} /><AvatarFallback>{getInitials(selectedTopic.cliente?.apelido)}</AvatarFallback></Avatar>
                  <div>
                    <p className="font-semibold">{selectedTopic.cliente?.apelido || selectedTopic.cliente?.nome || 'Anônimo'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(selectedTopic.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
                {selectedTopic.content}
              </CardContent>
            </Card>
            <h2 className="text-lg font-semibold text-gray-800">Comentários ({comments.length})</h2>
            {comments.map(comment => {
              const isCurrentUserComment = user?.id === comment.user_id;
              return (
                <Card key={comment.id} className={cn("flex flex-col", isCurrentUserComment ? 'bg-blue-50 dark:bg-blue-950 items-end' : '')}>
                  <CardHeader className={cn("flex flex-row justify-between items-start p-4", isCurrentUserComment ? 'flex-row-reverse' : '')}>
                    <div className={cn("flex items-center gap-3", isCurrentUserComment ? 'flex-row-reverse text-right' : '')}>
                      <Avatar className="h-10 w-10"><AvatarImage src={comment.cliente?.avatar_url || ''} /><AvatarFallback>{getInitials(comment.cliente?.apelido)}</AvatarFallback></Avatar>
                      <div>
                        <p className="font-semibold">{comment.cliente?.apelido || comment.cliente?.nome || 'Anônimo'}</p>
                        <p className="text-xs text-muted-foreground">{new Date(comment.created_at).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                    {isCurrentUserComment && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setItemToDelete('comment');
                          setCommentToDeleteId(comment.id);
                          setIsDeleteDialogOpen(true);
                        }}
                      ><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    )}
                  </CardHeader>
                  <CardContent className={cn("px-4 pb-4 whitespace-pre-wrap", isCurrentUserComment ? 'text-right' : '')}>
                    {comment.content}
                  </CardContent>
                </Card>
              );
            })}
            <div ref={commentsEndRef} />
          </div>
          <div className="p-4 border-t bg-gray-50 flex-shrink-0">
            <form onSubmit={handleCreateComment} className="space-y-2">
              <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Escreva sua resposta..." rows={3} />
              <Button type="submit" disabled={!newComment.trim()}><Send className="mr-2 h-4 w-4" /> Enviar</Button>
            </form>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <EditTopicDialog
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        topic={selectedTopic}
        onSuccess={() => {
          if (topicId) fetchTopicDetail(topicId);
          fetchTopics();
        }}
      />
      
      {isMobile ? (
        <div className="h-full flex flex-col">
          {topicId ? (
            renderTopicDetail()
          ) : (
            renderTopicList()
          )}
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex-shrink-0 p-4 border-b flex justify-between items-center gap-4 bg-white">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <CreateTopicDialog user={user} onSuccess={fetchTopics} />
          </div>
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            <ResizablePanel defaultSize={30} minSize={25} maxSize={40}>
              {renderTopicList()}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={70}>
              {renderTopicDetail()}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {itemToDelete === 'topic' ? 'Tópico' : 'Comentário'}</DialogTitle>
            <DialogDescription>
              Você tem certeza que deseja excluir este {itemToDelete}? Esta ação é irreversível.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteConfirmation}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Forum;