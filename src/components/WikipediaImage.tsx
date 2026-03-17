import React, { useState, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface WikipediaImageProps {
  title: string;
  alt: string;
  className?: string;
}

export function WikipediaImage({ title, alt, className = '' }: WikipediaImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchImage(searchQuery: string, tryFallback: boolean = false) {
      try {
        // Use Wikipedia REST API to get the page summary, which includes a thumbnail
        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchQuery)}`);
        
        if (!response.ok) {
          throw new Error('Wikipedia page not found');
        }
        
        const data = await response.json();
        
        if (isMounted) {
          if (data.thumbnail && data.thumbnail.source) {
            let highResUrl = data.thumbnail.source;
            if (highResUrl.includes('/thumb/')) {
              highResUrl = highResUrl.replace(/\/\d+px-/, '/600px-');
            }
            setImageUrl(highResUrl);
            setLoading(false);
          } else {
            throw new Error('No thumbnail found');
          }
        }
      } catch (err) {
        if (tryFallback && isMounted) {
          // If the first query (usually scientific name) fails, try the fallback (common name)
          fetchImage(alt, false);
        } else if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    }

    if (title) {
      setLoading(true);
      setError(false);
      setImageUrl(null);
      fetchImage(title, true);
    }
    
    return () => {
      isMounted = false;
    };
  }, [title, alt]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-stone-100 ${className}`}>
        <div className="animate-pulse w-full h-full bg-stone-200"></div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={`flex flex-col items-center justify-center bg-stone-100 text-stone-400 ${className}`}>
        <ImageIcon className="h-8 w-8 mb-2 opacity-30" />
        <span className="text-xs font-medium px-2 text-center opacity-50">No image available</span>
      </div>
    );
  }

  return (
    <img 
      src={imageUrl} 
      alt={alt} 
      className={className}
      referrerPolicy="no-referrer"
    />
  );
}
