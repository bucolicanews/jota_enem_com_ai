import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2 } from 'lucide-react';

interface ForumTopic {
    id: string;
    title: string;
    content: string;
}

interface EditTopicDialogProps {
  topic: ForumTopic | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditTopicDialog = ({ topic, isOpen, onClose, onSuccess }: EditTopicDialogProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (topic) {
      setTitle(topic.title);
      setContent(topic.content);
    }
  }, [topic]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;

    setIsSubmitting(true);
    const { error } = await supabase
      .from('forum_topics')
      .update({ title, content })
      .eq('id', topic.id);

    if (error) {
      showError('Erro ao atualizar o tópico.');
    } else {
      showSuccess('Tópico atualizado com sucesso!');
      onSuccess();
      onClose();
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Tópico</DialogTitle>
          <DialogDescription>
            Faça as alterações necessárias no seu tópico.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpdate} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-topic-title">Título</Label>
            <Input id="edit-topic-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-topic-content">Conteúdo</Label>
            <Textarea id="edit-topic-content" value={content} onChange={(e) => setContent(e.target.value)} rows={6} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};