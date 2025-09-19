import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Youtube } from 'lucide-react';

// SVG de placeholder codificado em base64
const placeholderImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ccc' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15.5L18.86 13.36a2.25 2.25 0 00-3.18 0l-1.5 1.5-3.32-3.32a2.25 2.25 0 00-3.18 0l-1.5 1.5L3 13.5V6.75a2.25 2.25 0 012.25-2.25h13.5a2.25 2.25 0 012.25 2.25v8.75z'/%3E%3C/svg%3E";


interface NewsItem {
  title: string;
  link: string;
  pub_date: string;
  description: string;
  thumbnail_url?: string;
  source: string;
  type: 'news' | 'video';
}

export const NewsCard = ({ item }: { item: NewsItem }) => {
  const cleanDescription = (html: string) => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  };

  const formattedDate = new Date(item.pub_date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Usa a thumbnail_url se existir, caso contrário, usa a imagem de fallback
  const imageUrl = item.thumbnail_url || placeholderImage;

  return (
    <a href={item.link} target="_blank" rel="noopener noreferrer" className="block transform hover:-translate-y-1 transition-transform duration-300">
      <Card className="h-full flex flex-col hover:shadow-xl transition-shadow duration-300">
        <img
          src={imageUrl}
          alt={`Imagem de capa de ${item.title}`}
          className="rounded-t-lg object-cover w-full h-48"
        />
        <CardHeader>
          <CardTitle className="text-lg leading-snug">{item.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <p className="text-sm text-muted-foreground line-clamp-3">
            {cleanDescription(item.description)}
          </p>
        </CardContent>
        <CardFooter className="flex justify-between items-center text-xs text-muted-foreground">
          <Badge variant="outline" className="flex items-center gap-1">
            {item.type === 'video' ? <Youtube className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
            {item.source}
          </Badge>
          <span>{formattedDate}</span>
        </CardFooter>
      </Card>
    </a>
  );
};