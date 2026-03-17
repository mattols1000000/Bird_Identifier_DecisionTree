import React, { useState, useEffect } from 'react';
import { Info } from 'lucide-react';

interface BirdAnatomyDiagramProps {
  term: string;
}

export function BirdAnatomyDiagram({ term }: BirdAnatomyDiagramProps) {
  const [definition, setDefinition] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchDefinition() {
      setLoading(true);
      try {
        // Try searching for the term specifically in the context of birds first
        let response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term + ' (bird)')}`);
        
        if (!response.ok) {
          // Fallback to just the term
          response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`);
        }
        
        if (response.ok && isMounted) {
          const data = await response.json();
          // Only use the extract if it's not a disambiguation page
          if (data.type !== 'disambiguation') {
            setDefinition(data.extract);
          }
        }
      } catch (e) {
        console.error("Failed to fetch anatomy definition", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    if (term) {
      fetchDefinition();
    }
    
    return () => {
      isMounted = false;
    };
  }, [term]);

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden relative flex items-center justify-center p-4 shadow-sm">
        <img 
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Bird_topography.svg/1024px-Bird_topography.svg.png" 
          alt="Bird Topography Diagram"
          className="w-full max-h-64 object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
      
      {loading ? (
        <div className="animate-pulse h-16 bg-stone-100 rounded-lg border border-stone-200"></div>
      ) : definition ? (
        <div className="text-sm text-stone-700 bg-stone-50 p-4 rounded-xl border border-stone-200 flex items-start shadow-sm">
          <Info className="h-5 w-5 text-emerald-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="capitalize text-stone-900 block mb-1">{term}</strong>
            <p className="leading-relaxed">{definition}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
