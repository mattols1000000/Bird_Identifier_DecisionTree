import React, { useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPin, Search } from 'lucide-react';

export interface ResolvedRegion {
  displayName: string;
  lat: number;
  lng: number;
  regionName: string;
  regionCode: string;
  regionType: string;
  address?: Record<string, string>;
}

interface GeocodeResult {
  displayName: string;
  lat: number;
  lng: number;
  address?: Record<string, string>;
}

interface LocationPickerProps {
  value: ResolvedRegion | null;
  onChange: (location: ResolvedRegion) => void;
}

const markerIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:9999px;background:#059669;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function RecenterMap({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);

  return null;
}

function ClickSelector({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.6023, -75.4714]);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (value) {
      const center: [number, number] = [value.lat, value.lng];
      setMapCenter(center);
      setMarkerPosition(center);
    }
  }, [value]);

  const searchLocation = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsSearching(true);
    setError('');
    setResults([]);

    try {
      const response = await fetch(`/api/geocode-location?q=${encodeURIComponent(trimmed)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not search for that location.');
      }

      setResults(data.results || []);
      if (data.results?.[0]) {
        const first = data.results[0];
        const center: [number, number] = [first.lat, first.lng];
        setMapCenter(center);
        setMarkerPosition(center);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not search for that location.');
    } finally {
      setIsSearching(false);
    }
  };

  const resolvePoint = async (lat: number, lng: number, fallbackDisplayName?: string) => {
    setIsResolving(true);
    setError('');
    setMarkerPosition([lat, lng]);
    setMapCenter([lat, lng]);

    try {
      const response = await fetch('/api/resolve-region', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, displayName: fallbackDisplayName }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not resolve an eBird region for that map point.');
      }

      onChange(data.location as ResolvedRegion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve an eBird region for that map point.');
    } finally {
      setIsResolving(false);
    }
  };

  const chooseSearchResult = (result: GeocodeResult) => {
    resolvePoint(result.lat, result.lng, result.displayName);
    setResults([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MapPin className="h-5 w-5 text-stone-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                searchLocation();
              }
            }}
            placeholder="Search a place, e.g., Bethlehem, PA"
            className="block w-full pl-10 pr-3 py-3 border border-stone-300 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-sm transition-shadow"
          />
        </div>
        <button
          type="button"
          onClick={searchLocation}
          disabled={!query.trim() || isSearching}
          className="flex items-center px-4 py-3 bg-stone-800 text-white rounded-xl font-medium hover:bg-stone-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100 overflow-hidden shadow-sm">
          {results.slice(0, 5).map((result) => (
            <button
              key={`${result.lat}-${result.lng}-${result.displayName}`}
              type="button"
              onClick={() => chooseSearchResult(result)}
              className="block w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors"
            >
              <span className="text-sm text-stone-700">{result.displayName}</span>
            </button>
          ))}
        </div>
      )}

      <div className="h-80 rounded-2xl overflow-hidden border border-stone-200 shadow-sm relative">
        <MapContainer center={mapCenter} zoom={value ? 11 : 8} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterMap center={mapCenter} zoom={markerPosition ? 12 : 8} />
          <ClickSelector onSelect={(lat, lng) => resolvePoint(lat, lng)} />
          {markerPosition && <Marker position={markerPosition} icon={markerIcon} />}
        </MapContainer>

        {isResolving && (
          <div className="absolute inset-x-3 top-3 z-[1000] bg-white/95 border border-stone-200 rounded-xl px-4 py-3 shadow-sm flex items-center text-sm text-stone-700">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Resolving county/state/country borders for this point...
          </div>
        )}
      </div>

      <p className="text-sm text-stone-500">
        Search for a place to move the map, then click the exact sighting point. The app will use that coordinate to choose the eBird region.
      </p>

      {value && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-900">
          <div className="font-medium">Selected eBird region: {value.regionName} ({value.regionCode})</div>
          <div className="mt-1 text-emerald-800">Point: {value.lat.toFixed(5)}, {value.lng.toFixed(5)}</div>
          <div className="mt-1 text-emerald-800 truncate">Map location: {value.displayName}</div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}
