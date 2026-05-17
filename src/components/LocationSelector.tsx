import { useState } from 'react';
import { useLocationContext, PREDEFINED_LOCATIONS } from '../context/LocationContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { X, MapPin, Navigation } from 'lucide-react';

interface LocationSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LocationSelector({ isOpen, onClose }: LocationSelectorProps) {
  const { currentLocation, setCurrentLocation } = useLocationContext();
  const { getCurrentPosition, loading: gpsLoading } = useGeolocation();
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const handleGPSClick = async () => {
    try {
      const position = await getCurrentPosition();
      setCurrentLocation(position);
      onClose();
    } catch (e) {
      alert('No se pudo obtener la ubicación GPS.');
    }
  };

  const handleLocationClick = (loc: typeof PREDEFINED_LOCATIONS[0]) => {
    setCurrentLocation(loc);
    onClose();
  };

  const filteredLocations = PREDEFINED_LOCATIONS.filter(l => 
    !l.isGPS && l.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white text-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Seleccionar Ubicación</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="relative mb-6">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar ciudad..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-100 pl-10 pr-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <button 
          onClick={handleGPSClick}
          disabled={gpsLoading}
          className="w-full flex items-center justify-between bg-blue-50 hover:bg-blue-100 text-blue-600 p-4 rounded-xl mb-4 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Navigation size={20} />
            <span className="font-semibold">{gpsLoading ? 'Obteniendo GPS...' : 'Usar mi ubicación actual'}</span>
          </div>
        </button>

        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
          {filteredLocations.map(loc => (
            <button 
              key={loc.id}
              onClick={() => handleLocationClick(loc)}
              className={`text-left p-4 rounded-xl transition-colors ${currentLocation.id === loc.id ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'}`}
            >
              {loc.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
