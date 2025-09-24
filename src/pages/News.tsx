import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { NewsCard } from '@/components/NewsCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Search, XCircle, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { checkUserPermissions, UserPermissions } from '@/utils/permissions';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showError } from '@/utils/toast';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

const News = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);

  // Estados para os filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'news', 'video'
  const [filterSource, setFilterSource] = useState('all'); // 'all' ou nome da fonte
  const [filterTitle, setFilterTitle] = useState('all'); // NOVO: filtro por título

  const isMobile = useIsMobile();
  const [showSidebar, setShowSidebar] = useState(!isMobile); // Controla a visibilidade da sidebar no mobile

  const fetchNewsFromDb = useCallback(async () => {
    const { data, error: dbError } = await supabase
      .from('news_items')
      .select('*')
      .order('pub_date', { ascending: false })
      .limit(50);

    if (dbError) {
      console.error('DB fetch error:', dbError);
      throw new Error('Não foi possível carregar o conteúdo.');
    }
    return data as NewsItem[];
  }, []);

  const fetchUserData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const permissions = await checkUserPermissions(user.id);
      return permissions;
    }
    return null;
  }, []);

  useEffect(() => {
    const loadPageData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [newsData, permissionsData] = await Promise.all([
          fetchNewsFromDb(),
          fetchUserData(),
        ]);
        setItems(newsData);
        setUserPermissions(permissionsData);
      } catch (err: any) {
        console.error('Error loading News page data:', err);
        setError(err.message || 'Ocorreu um erro ao carregar a página.');
        showError(err.message || 'Ocorreu um erro ao carregar a página.');
      } finally {
        setLoading(false);
      }
    };
    loadPageData();
  }, [fetchNewsFromDb, fetchUserData]);

  // Lógica de filtragem
  const filteredItems = useMemo(() => {
    let currentFilteredItems = items;

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentFilteredItems = currentFilteredItems.filter(item =>
        item.title.toLowerCase().includes(lowerCaseSearchTerm) ||
        item.description.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    if (filterType !== 'all') {
      currentFilteredItems = currentFilteredItems.filter(item => item.type === filterType);
    }

    if (filterSource !== 'all') {
      currentFilteredItems = currentFilteredItems.filter(item => item.source === filterSource);
    }

    // NOVO: Filtrar por título
    if (filterTitle !== 'all') {
      currentFilteredItems = currentFilteredItems.filter(item => item.title === filterTitle);
    }

    return currentFilteredItems;
  }, [items, searchTerm, filterType, filterSource, filterTitle]); // Adicionado filterTitle aqui

  // Obter todas as fontes únicas para o filtro
  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    items.forEach(item => sources.add(item.source));
    return Array.from(sources).sort();
  }, [items]);

  // NOVO: Obter todos os títulos únicos para o filtro
  const uniqueTitles = useMemo(() => {
    const titles = new Set<string>();
    items.forEach(item => titles.add(item.title));
    return Array.from(titles).sort();
  }, [items]);

  const renderSidebar = () => (
    <div className="flex flex-col h-full bg-gray-50 border-r p-4">
      <h2 className="text-xl font-bold mb-4">Filtros</h2>
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Filtrar por Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            <SelectItem value="news">Notícia</SelectItem>
            <SelectItem value="video">Vídeo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Filtrar por Fonte" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Fontes</SelectItem>
            {uniqueSources.map(source => (
              <SelectItem key={source} value={source}>{source}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* NOVO: Filtro por Título */}
        <Select value={filterTitle} onValueChange={setFilterTitle}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Filtrar por Título" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Títulos</SelectItem>
            {uniqueTitles.map(title => (
              <SelectItem key={title} value={title}>{title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isMobile && (
        <Button variant="outline" className="mt-4" onClick={() => setShowSidebar(false)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Notícias
        </Button>
      )}
    </div>
  );

  const renderMainContent = () => (
    <div className="flex flex-col h-full p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <h1 className="text-3xl font-bold">Conteúdo do JOTA ENEM</h1>
        {userPermissions?.isProf && (
          <Badge
            onClick={() => navigate('/admin/news')}
            className="cursor-pointer bg-red-500 hover:bg-red-600 transition-colors mt-2 md:mt-0"
          >
            Adicionar novo conteúdo
          </Badge>
        )}
      </div>

      <p className="text-xl text-gray-600 mb-8">
        Fique por dentro das últimas notícias, dicas e vídeos sobre o ENEM.
      </p>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex flex-col space-y-3">
              <Skeleton className="h-[125px] w-full rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && filteredItems.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-12">
          <XCircle className="h-12 w-12 mb-4 text-gray-400" />
          <p>Nenhum conteúdo encontrado com os filtros aplicados.</p>
          <p className="text-sm text-muted-foreground">Tente ajustar sua busca ou filtros.</p>
        </div>
      )}

      {!loading && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div key={item.id} className="relative">
              <Badge 
                className={`absolute top-2 right-2 z-10 text-xs px-2 py-1 ${item.type === 'video' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
              >
                {item.type === 'news' ? 'Notícia' : 'Vídeo'}
              </Badge>
              <NewsCard item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <div className="h-full flex flex-col">
          {showSidebar ? (
            renderSidebar()
          ) : (
            <>
              <div className="flex-shrink-0 p-4 border-b flex justify-between items-center gap-4 bg-white">
                <h1 className="text-xl font-bold">Notícias</h1>
                <Button variant="outline" size="sm" onClick={() => setShowSidebar(true)}>
                  <Search className="h-4 w-4 mr-2" /> Filtros
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderMainContent()}
              </div>
            </>
          )}
        </div>
      ) : (
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel defaultSize={25} minSize={20} maxSize={30}>
            {renderSidebar()}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={75}>
            {renderMainContent()}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </>
  );
};

export default News;