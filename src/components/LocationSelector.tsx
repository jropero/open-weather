import { useState } from 'react';
import { useLocationContext } from '../context/LocationContext';
import { PREDEFINED_LOCATIONS } from '../constants/locations';
import { useGeolocation } from '../hooks/useGeolocation';
import { useGeoSearch } from '../hooks/useGeoSearch';
import { X, MapPin, Navigation, Plus, Trash2, Loader } from 'lucide-react';
import { useLanguage, type Language } from '../context/LanguageContext';
import type { Location } from '../types/weather';

interface LocationSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LocationSelector({ isOpen, onClose }: LocationSelectorProps) {
  const { currentLocation, setCurrentLocation, customLocations, addCustomLocation, deleteCustomLocation } = useLocationContext();
  const { getCurrentPosition, loading: gpsLoading } = useGeolocation();
  const { language, t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const { results: searchResults, loading: searchLoading } = useGeoSearch(searchTerm);

  if (!isOpen) return null;

  const getTranslatedLocationName = (loc: typeof PREDEFINED_LOCATIONS[0], lang: Language) => {
    if (loc.id === 'gps') return lang === 'en' ? 'Current (GPS)' : 'Actual (GPS)';
    if (loc.id === 'basel') return lang === 'en' ? 'Basel' : 'Basilea';
    if (loc.id === 'reykjavik') return lang === 'en' ? 'Reykjavik' : 'Reikiavik';
    if (loc.id === 'taipei') return lang === 'en' ? 'Taipei' : 'Taipéi';
    return loc.name;
  };

  const handleGPSClick = async () => {
    try {
      const position = await getCurrentPosition();
      setCurrentLocation(position);
      onClose();
    } catch {
      alert(t('alert.gps_error'));
    }
  };

  const handleLocationClick = (loc: Location) => {
    setCurrentLocation(loc);
    onClose();
  };

  const handleAdd = (loc: Location) => {
    addCustomLocation(loc);
    setSearchTerm('');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomLocation(id);
  };

  const filteredPredefined = PREDEFINED_LOCATIONS.filter(l => {
    if (l.isGPS) return false;
    if (searchTerm.trim().length >= 2) return false; // hide when searching
    return true;
  });

  const isCustomAlreadySaved = (id: string) => customLocations.some(l => l.id === id);

  const showSearch = searchTerm.trim().length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white text-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{t('title.select_location')}</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>

        {/* Search input */}
        <div className="relative mb-4">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={t('placeholder.search_city')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-100 pl-10 pr-10 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
          />
          {searchLoading && (
            <Loader className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" size={18} />
          )}
        </div>

        {/* Search results */}
        {showSearch && (
          <div className="flex flex-col gap-2 max-h-52 overflow-y-auto mb-4">
            {searchResults.length === 0 && !searchLoading && (
              <p className="text-sm text-gray-400 text-center py-3">Sin resultados</p>
            )}
            {searchResults.map(loc => (
              <div key={loc.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 gap-2">
                <button className="text-left flex-1 text-sm font-medium" onClick={() => handleLocationClick(loc)}>
                  {loc.name}
                </button>
                <button
                  onClick={() => handleAdd(loc)}
                  disabled={isCustomAlreadySaved(loc.id)}
                  title="Guardar ubicación"
                  className={`p-1.5 rounded-lg transition-colors shrink-0 ${isCustomAlreadySaved(loc.id) ? 'text-gray-300 cursor-default' : 'text-blue-500 hover:bg-blue-50'}`}
                >
                  <Plus size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* GPS button — only when not searching */}
        {!showSearch && (
          <button
            onClick={handleGPSClick}
            disabled={gpsLoading}
            className="w-full flex items-center justify-between bg-blue-50 hover:bg-blue-100 text-blue-600 p-4 rounded-xl mb-4 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Navigation size={20} />
              <span className="font-semibold">{gpsLoading ? t('btn.gps_active') : t('btn.gps_use')}</span>
            </div>
          </button>
        )}

        {/* Custom saved locations */}
        {!showSearch && customLocations.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Mis ubicaciones</p>
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
              {customLocations.map(loc => (
                <div key={loc.id} className={`flex items-center justify-between rounded-xl transition-colors ${currentLocation.id === loc.id ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'}`}>
                  <button className="text-left flex-1 p-3 text-sm font-medium" onClick={() => handleLocationClick(loc)}>
                    {loc.name}
                  </button>
                  <button
                    onClick={(e) => handleDelete(loc.id, e)}
                    title="Eliminar"
                    className={`p-2 mr-1 rounded-lg transition-colors ${currentLocation.id === loc.id ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Predefined locations */}
        {!showSearch && (
          <div>
            {customLocations.length > 0 && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ciudades</p>
            )}
            <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
              {filteredPredefined.map(loc => (
                <button
                  key={loc.id}
                  onClick={() => handleLocationClick(loc)}
                  className={`text-left p-3 rounded-xl transition-colors text-sm ${currentLocation.id === loc.id ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'}`}
                >
                  {getTranslatedLocationName(loc, language)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
