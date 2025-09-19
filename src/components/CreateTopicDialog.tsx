import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, PlusCircle } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface CreateTopicDialogProps {
  user: User | null;
  onSuccess: () => void;
}

export const CreateTopicDialog = ({ user, onSuccess }: CreateTopicDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !content.trim()) {
      showError('Título e conteúdo são obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase
      .from('forum_topics')
      .insert({ user_id: user.id, title, content });

    if (error) {
      showError('Erro ao criar o tópico.');
      console.error('Create topic error:', error);
    } else {
      showSuccess('Tópico criado com sucesso!');
      onSuccess();
      setTitle('');
      setContent('');
      setIsOpen(false);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Criar Novo Tópico
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Tópico</DialogTitle>
          <DialogDescription>
            Inicie uma nova discussão compartilhando sua dúvida ou ideia.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="topic-title">Título</Label>
            <Input id="topic-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Qual é o assunto principal?" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="topic-content">Conteúdo</Label>
            <Textarea id="topic-content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Descreva sua dúvida ou ideia com mais detalhes..." rows={6} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publicar Tópico
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};