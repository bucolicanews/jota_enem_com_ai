import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { requireContentManager } from '@/utils/permissions';
interface NewsItem {
id: string;
title: string;
link: string;
pub_date: string;
description: string;
thumbnail_url?: string;
source: string;
type: 'news' | 'video';
}
const AdminNews = () => {
const navigate = useNavigate();
const [user, setUser] = useState<User | null>(null);
const [hasAccess, setHasAccess] = useState(false);
const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
const [loading, setLoading] = useState(true);
const [isSubmitting, setIsSubmitting] = useState(false);
const [checkingPermissions, setCheckingPermissions] = useState(true);
const [editMode, setEditMode] = useState(false);
const [currentNewsItem, setCurrentNewsItem] = useState<NewsItem | null>(null);
const [title, setTitle] = useState('');
const [link, setLink] = useState('');
const [pubDate, setPubDate] = useState('');
const [description, setDescription] = useState('');
const [thumbnailUrl, setThumbnailUrl] = useState('');
const [source, setSource] = useState('');
const [type, setType] = useState<'news' | 'video'>('news');
const [searchTerm, setSearchTerm] = useState(''); // Novo estado para o termo de busca
const fetchNewsItems = useCallback(async (userId: string) => {
setLoading(true);
const { data, error } = await supabase
.from('news_items')
.select('*')
.eq('id_cliente_criador', userId)
.order('pub_date', { ascending: false });
if (error) {
showError('Erro ao carregar itens de notícias.');
console.error('Error fetching news items:', error);
} else {
setNewsItems(data as NewsItem[]);
}
setLoading(false);
}, []);
useEffect(() => {
const checkUserPermissionsAndFetch = async () => {
setCheckingPermissions(true);
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
navigate('/login');
return;
}
setUser(user);
const canManageContent = await requireContentManager(user.id);
if (canManageContent) {
setHasAccess(true);
fetchNewsItems(user.id);
} else {
showError('Acesso negado. Você não tem permissão para acessar esta página.');
navigate('/dashboard');
}
setCheckingPermissions(false);
};
checkUserPermissionsAndFetch();
}, [navigate, fetchNewsItems]);
const resetForm = () => {
setTitle('');
setLink('');
setPubDate('');
setDescription('');
setThumbnailUrl('');
setSource('');
setType('news');
setEditMode(false);
setCurrentNewsItem(null);
};
const handleEditClick = (item: NewsItem) => {
setEditMode(true);
setCurrentNewsItem(item);
setLink(item.link);
setPubDate(new Date(item.pub_date).toISOString().substring(0, 16));
setDescription(item.description || '');
setThumbnailUrl(item.thumbnail_url || '');
setSource(item.source);
setType(item.type);
setTitle(item.title);
};
const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
if (!user || !hasAccess) {
showError('Acesso negado.');
return;
}
if (!title || !link || !pubDate || !source || !type) {
showError('Por favor, preencha todos os campos obrigatórios.');
return;
}
setIsSubmitting(true);
const itemData = {
title,
link,
pub_date: new Date(pubDate).toISOString(),
description,
thumbnail_url: thumbnailUrl || null,
source,
type,
id_cliente_criador: user.id,
};
let error = null;
if (editMode && currentNewsItem) {
const { error: updateError } = await supabase
.from('news_items')
.update(itemData)
.eq('id', currentNewsItem.id);
error = updateError;
} else {
const { error: insertError } = await supabase
.from('news_items')
.insert(itemData);
error = insertError;
}
if (error) {
showError(`Erro ao ${editMode ? 'atualizar' : 'adicionar'} item: ${error.message}`);
} else {
showSuccess(`Item ${editMode ? 'atualizado' : 'adicionado'} com sucesso!`);
resetForm();
fetchNewsItems(user.id);
}
setIsSubmitting(false);
};
const handleDelete = async (id: string) => {
if (!user || !hasAccess) {
showError('Acesso negado.');
return;
}
if (!window.confirm('Tem certeza que deseja deletar este item?')) return;
const { error } = await supabase
.from('news_items')
.delete()
.eq('id', id)
.eq('id_cliente_criador', user.id);
if (error) {
showError(`Erro ao deletar item: ${error.message}`);
} else {
showSuccess('Item deletado com sucesso!');
fetchNewsItems(user.id);
}
};
// Filtra os itens com base no termo de busca
const filteredItems = useMemo(() => {
if (!searchTerm) {
return newsItems;
}
const lowerCaseSearchTerm = searchTerm.toLowerCase();
return newsItems.filter(item =>
item.title.toLowerCase().includes(lowerCaseSearchTerm) ||
item.source.toLowerCase().includes(lowerCaseSearchTerm) ||
item.type.toLowerCase().includes(lowerCaseSearchTerm)
);
}, [newsItems, searchTerm]);
if (checkingPermissions) {
return (
<div className="flex items-center justify-center min-h-screen">
<Loader2 className="h-8 w-8 animate-spin" />
</div>
);
}
if (!hasAccess) {
return null;
}
return (
<main className="space-y-8 p-4 md:p-8">
<Card>
<CardHeader>
<CardTitle>{editMode ? 'Editar Item' : 'Adicionar Novo Item'}</CardTitle>
<CardDescription>Gerencie o conteúdo da página de Notícias.</CardDescription>
</CardHeader>
<CardContent>
<form onSubmit={handleSubmit} className="space-y-4">
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
<div className="space-y-2">
<Label htmlFor="title">Título</Label>
<Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
</div>
<div className="space-y-2">
<Label htmlFor="link">Link (URL)</Label>
<Input id="link" type="url" value={link} onChange={(e) => setLink(e.target.value)} required />
</div>
<div className="space-y-2">
<Label htmlFor="pubDate">Data de Publicação</Label>
<Input id="pubDate" type="datetime-local" value={pubDate} onChange={(e) => setPubDate(e.target.value)} required />
</div>
<div className="space-y-2">
<Label htmlFor="source">Fonte</Label>
<Input id="source" value={source} onChange={(e) => setSource(e.target.value)} required />
</div>
<div className="space-y-2">
<Label htmlFor="type">Tipo</Label>
<Select value={type} onValueChange={(value: 'news' | 'video') => setType(value)} required>
<SelectTrigger id="type"><SelectValue /></SelectTrigger>
<SelectContent>
<SelectItem value="news">Notícia</SelectItem>
<SelectItem value="video">Vídeo</SelectItem>
</SelectContent>
</Select>
</div>
<div className="space-y-2">
<Label htmlFor="thumbnailUrl">URL da Miniatura (opcional)</Label>
<Input id="thumbnailUrl" type="url" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} />
</div>
<div className="space-y-2 md:col-span-2">
<Label htmlFor="description">Descrição (opcional)</Label>
<Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
</div>
</div>
<div className="flex gap-2">
<Button type="submit" disabled={isSubmitting}>
{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
{editMode ? 'Salvar Alterações' : 'Adicionar Item'}
</Button>
{editMode && (
<Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
Cancelar
</Button>
)}
</div>
</form>
</CardContent>
</Card>
<Card>
<CardHeader>
<CardTitle>Itens Cadastrados</CardTitle>
</CardHeader>
<CardContent className="p-0">
<div className="p-4">
<Input
type="text"
placeholder="Buscar por título, fonte ou tipo..."
value={searchTerm}
onChange={(e) => setSearchTerm(e.target.value)}
/>
</div>
{loading ? (
<div className="flex justify-center items-center py-8">
<Loader2 className="h-8 w-8 animate-spin" />
</div>
) : filteredItems.length > 0 ? (
<Table>
<TableHeader>
<TableRow>
<TableHead>Título</TableHead>
<TableHead>Fonte</TableHead>
<TableHead>Tipo</TableHead>
<TableHead>Data</TableHead>
<TableHead className="text-right">Ações</TableHead>
</TableRow>
</TableHeader>
<TableBody>
{filteredItems.map((item) => (
<TableRow key={item.id}>
<TableCell className="font-medium">{item.title}</TableCell>
<TableCell>{item.source}</TableCell>
<TableCell>{item.type === 'news' ? 'Notícia' : 'Vídeo'}</TableCell>
<TableCell>{new Date(item.pub_date).toLocaleDateString('pt-BR')}</TableCell>
<TableCell className="text-right space-x-1">
<Button variant="ghost" size="icon" onClick={() => handleEditClick(item)} aria-label="Editar">
<Pencil className="h-4 w-4 text-blue-500" />
</Button>
<Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} aria-label="Excluir">
<Trash2 className="h-4 w-4 text-red-500" />
</Button>
</TableCell>
</TableRow>
))}
</TableBody>
</Table>
) : (
<p className="text-center py-8">Nenhum item encontrado.</p>
)}
</CardContent>
</Card>
</main>
);
};
export default AdminNews;