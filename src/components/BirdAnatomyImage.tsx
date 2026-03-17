import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';

interface BirdAnatomyImageProps {
  anatomyTerm?: string;
  className?: string;
}

export function BirdAnatomyImage({ anatomyTerm, className = "" }: BirdAnatomyImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchImage() {
      try {
        setLoading(true);
        setError(false);
        
        let fileTitle = "File:Birdmorphology.svg";
        const term = (anatomyTerm || "").toLowerCase();
        
        if (term.includes('bill') || term.includes('beak')) {
          fileTitle = "File:BirdBeaksA.svg";
        } else if (term.includes('wing') || term.includes('primary') || term.includes('secondary')) {
          fileTitle = "File:Birdwing.svg";
        }
        
        const response = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${fileTitle}&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`);
        
        if (!response.ok) {
          throw new Error('Wikipedia API error');
        }
        
        const data = await response.json();
        
        if (isMounted) {
          const pages = data.query?.pages;
          if (pages) {
            const pageId = Object.keys(pages)[0];
            const imageInfo = pages[pageId]?.imageinfo?.[0];
            
            if (imageInfo && imageInfo.thumburl) {
              setImageUrl(imageInfo.thumburl);
            } else if (imageInfo && imageInfo.url) {
              setImageUrl(imageInfo.url);
            } else {
              throw new Error('No image URL found');
            }
          } else {
            throw new Error('No pages found');
          }
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    }

    fetchImage();
    
    return () => {
      isMounted = false;
    };
  }, [anatomyTerm]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-stone-100 ${className}`}>
        <Loader2 className="h-6 w-6 text-stone-400 animate-spin" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={`flex flex-col items-center justify-center bg-stone-100 text-stone-400 ${className}`}>
        <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
        <span className="text-xs font-medium">Diagram unavailable</span>
      </div>
    );
  }

  return (
    <div className={`relative bg-white flex items-center justify-center p-2 ${className}`}>
      <img 
        src={imageUrl} 
        alt={`Diagram of ${anatomyTerm || 'bird anatomy'}`}
        className="max-w-full max-h-full object-contain"
        referrerPolicy="no-referrer"
      />
      <div className="absolute bottom-2 right-2 bg-white/90 px-2 py-1 text-[10px] text-stone-500 rounded shadow-sm border border-stone-100">
        Source: Wikimedia Commons
      </div>
    </div>
  );
}
