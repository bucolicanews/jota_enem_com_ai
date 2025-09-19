import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { NewsCard } from '@/components/NewsCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { checkUserPermissions, UserPermissions } from '@/utils/permissions';

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

  const fetchNewsFromDb = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: dbError } = await supabase
      .from('news_items')
      .select('*')
      .order('pub_date', { ascending: false })
      .limit(50);

    if (dbError) {
      setError('Não foi possível carregar o conteúdo.');
      console.error('DB fetch error:', dbError);
    } else {
      setItems(data as NewsItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const permissions = await checkUserPermissions(user.id);
        setUserPermissions(permissions);
      }
    };
    fetchUserData();
    fetchNewsFromDb();
  }, [fetchNewsFromDb]);

  return (
    <main className="space-y-8">
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

      {!loading && !error && items.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nenhum conteúdo encontrado.</p>
          <p className="text-sm text-muted-foreground">Entre em contato com o administrador para adicionar notícias.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
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
    </main>
  );
};

export default News;