import React from 'react';
import { Bird } from 'lucide-react';

interface SizeOptionProps {
  size: string;
  selected: boolean;
  onClick: () => void;
}

export const SizeOption: React.FC<SizeOptionProps> = ({ size, selected, onClick }) => {
  // Determine which birds to show based on the size string
  const getBirds = () => {
    switch (size) {
      case "Sparrow-sized or smaller":
        return [{ type: 'sparrow', sizeClass: 'w-5 h-5', opacity: 'opacity-100' }];
      case "Between Sparrow and Robin":
        return [
          { type: 'sparrow', sizeClass: 'w-5 h-5', opacity: 'opacity-40' },
          { type: 'robin', sizeClass: 'w-7 h-7', opacity: 'opacity-40' }
        ];
      case "Robin-sized":
        return [{ type: 'robin', sizeClass: 'w-7 h-7', opacity: 'opacity-100' }];
      case "Between Robin and Crow":
        return [
          { type: 'robin', sizeClass: 'w-7 h-7', opacity: 'opacity-40' },
          { type: 'crow', sizeClass: 'w-10 h-10', opacity: 'opacity-40' }
        ];
      case "Crow-sized":
        return [{ type: 'crow', sizeClass: 'w-10 h-10', opacity: 'opacity-100' }];
      case "Between Crow and Goose":
        return [
          { type: 'crow', sizeClass: 'w-10 h-10', opacity: 'opacity-40' },
          { type: 'goose', sizeClass: 'w-14 h-14', opacity: 'opacity-40' }
        ];
      case "Goose-sized":
        return [{ type: 'goose', sizeClass: 'w-14 h-14', opacity: 'opacity-100' }];
      default:
        return [];
    }
  };

  const birds = getBirds();

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-4 h-32 rounded-xl border transition-all ${
        selected 
          ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-500' 
          : 'border-stone-200 hover:border-emerald-300 hover:bg-stone-50 text-stone-700 bg-white'
      }`}
    >
      <div className="flex-1 flex items-end justify-center gap-4 mb-3">
        {birds.map((bird, i) => (
          <div key={i} className={`flex flex-col items-center justify-end h-full ${bird.opacity}`}>
            {/* We use the lucide Bird icon, but scale it to represent the different sizes */}
            <Bird 
              className={`${bird.sizeClass} ${selected ? 'text-emerald-600' : 'text-stone-500'} transition-colors`} 
              strokeWidth={selected ? 2.5 : 2}
            />
          </div>
        ))}
      </div>
      
      {/* A subtle baseline to ground the birds */}
      <div className={`absolute bottom-12 left-8 right-8 h-px ${selected ? 'bg-emerald-200' : 'bg-stone-200'}`} />
      
      <span className="text-sm font-medium text-center leading-tight z-10">
        {size}
      </span>
    </button>
  );
}
