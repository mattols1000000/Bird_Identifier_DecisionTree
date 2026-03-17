import React from 'react';

interface BirdDiagramProps {
  highlightPart?: string;
  className?: string;
}

export function BirdDiagram({ highlightPart, className = "" }: BirdDiagramProps) {
  // A simple stylized bird SVG
  // We'll use different paths for different body parts so we can highlight them
  
  const getFill = (part: string) => {
    if (highlightPart && highlightPart.toLowerCase() === part.toLowerCase()) {
      return "#ef4444"; // red-500 for highlight
    }
    return "#d6d3d1"; // stone-300 for default
  };

  return (
    <svg 
      viewBox="0 0 200 200" 
      xmlns="http://www.w3.org/2000/svg" 
      className={`w-full h-full ${className}`}
    >
      {/* Background circle */}
      <circle cx="100" cy="100" r="95" fill="#f5f5f4" />
      
      {/* Tail */}
      <path 
        d="M 40 140 L 10 180 L 50 170 Z" 
        fill={getFill('tail')} 
        stroke="#78716c" 
        strokeWidth="2"
      />
      
      {/* Body / Belly */}
      <path 
        d="M 50 120 C 50 160, 120 170, 140 130 C 120 150, 70 150, 50 120 Z" 
        fill={getFill('belly')} 
        stroke="#78716c" 
        strokeWidth="2"
      />
      
      {/* Back / Wing */}
      <path 
        d="M 40 100 C 60 70, 120 80, 140 130 C 100 120, 50 130, 40 100 Z" 
        fill={getFill('wing')} 
        stroke="#78716c" 
        strokeWidth="2"
      />
      
      {/* Head */}
      <path 
        d="M 120 80 C 120 50, 160 50, 160 80 C 160 110, 130 100, 120 80 Z" 
        fill={getFill('head')} 
        stroke="#78716c" 
        strokeWidth="2"
      />
      
      {/* Bill / Beak */}
      <path 
        d="M 155 70 L 190 75 L 155 85 Z" 
        fill={getFill('bill')} 
        stroke="#78716c" 
        strokeWidth="2"
      />
      
      {/* Eye */}
      <circle cx="145" cy="70" r="4" fill="#292524" />
      
      {/* Legs */}
      <path d="M 80 155 L 70 190 M 70 190 L 60 195 M 70 190 L 80 195" stroke="#78716c" strokeWidth="3" fill="none" />
      <path d="M 100 150 L 95 185 M 95 185 L 85 190 M 95 185 L 105 190" stroke="#78716c" strokeWidth="3" fill="none" />
    </svg>
  );
}
