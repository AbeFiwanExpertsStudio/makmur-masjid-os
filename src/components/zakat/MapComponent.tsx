"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Navigation, X, Plus, Search, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

const createCustomIcon = (color: string, pulse = false) => {
  const pulseRing = pulse
    ? `<div style="position:absolute;top:-6px;left:-6px;width:32px;height:32px;border-radius:50%;background:${color}44;animation:mapPulse 1.5s ease-out infinite;"></div>`
    : "";
  return L.divIcon({
    className: "custom-div-icon",
    html: `<div style="position:relative;width:20px;height:20px;">
      ${pulseRing}
      <div style="position:relative;background-color:${color};width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,0.4);z-index:2;"></div>
    </div>
    <style>@keyframes mapPulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.2);opacity:0}}</style>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
};

const redPulseIcon = createCustomIcon("#DC2626", true);     // Active booths
const yellowPulseIcon = createCustomIcon("#D4A843", true);  // Scheduled booths
const goldIcon = createCustomIcon("#D4A843");               // New counter preview
const bluePulseIcon = createCustomIcon("#3B82F6", true);    // User's physical location

interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: "active" | "scheduled" | "expired";
  address: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
}

function MapUpdater({ center, trigger }: { center: [number, number], trigger: number }) {
  const map = useMap();
  const [prevTrigger, setPrevTrigger] = useState(0);

  useEffect(() => {
    if (trigger > prevTrigger) {
      map.flyTo(center, 15, { animate: true, duration: 1.5 });
      setPrevTrigger(trigger);
    }
  }, [center, map, trigger, prevTrigger]);
  return null;
}

// Component to capture map clicks for pin placement
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to search map locations via OpenStreetMap Nominatim
function MapSearchControl() {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchedPin, setSearchedPin] = useState<{ lat: number, lng: number, name: string } | null>(null);

  // Debounced search effect
  useEffect(() => {
    // Only search if user has typed at least 3 characters
    if (query.trim().length < 3) {
      setResults([]);
      // Don't auto-hide if they are just clearing out the box, but if it's empty hide it:
      if (query.trim() === "") setShowResults(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      setShowResults(true);
      try {
        // Nominatim API - note: we add '* ' wildcard or rely on the base behaviour. 
        // Nominatim isn't a perfect autocomplete engine, but q=... will try partial matches of words
        // Appending 'Malaysia' heavily improves local scope results for partial place names like "Masjid Padang Midin"
        const finalQuery = query.toLowerCase().includes('malaysia') ? query : `${query} Malaysia`;
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(finalQuery)}&limit=8&countrycodes=my`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 600); // 600ms debounce to respect Nominatim's strict usage policy (1 req/sec)

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // The useEffect handles the fetching, this just stops page reload on Enter
  };

  const handleSelect = (lat: string, lon: string, name: string) => {
    try {
      if (map) {
        map.flyTo([parseFloat(lat), parseFloat(lon)], 16, { duration: 1.5 });
        setSearchedPin({ lat: parseFloat(lat), lng: parseFloat(lon), name });
      }
    } catch (e) {
      console.warn("Map not ready for flyTo", e);
    }
    setShowResults(false);
    setQuery("");
  };

  return (
    <>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] w-[90%] max-w-sm">
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search world map (e.g. Kuala Lumpur)..."
            className="w-full bg-surface text-sm rounded-full pl-10 pr-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.15)] outline-none border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
          />
          <button type="submit" className="absolute left-3 top-3 text-text-secondary hover:text-primary">
            {isSearching ? <Loader2 size={18} className="animate-spin text-primary" /> : <Search size={18} />}
          </button>
          {query && (
            <button type="button" onClick={() => { setQuery(""); setShowResults(false); }} className="absolute right-3 top-3.5 text-text-muted hover:text-red-500">
              <X size={14} />
            </button>
          )}
        </form>

        {showResults && results.length > 0 && (
          <div className="absolute top-full left-0 w-full mt-2 bg-surface rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.15)] border border-border overflow-hidden">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(r.lat, r.lon, r.display_name)}
                className="w-full text-left px-4 py-3 border-b last:border-0 border-border hover:bg-background flex items-start gap-2 transition"
              >
                <Navigation size={14} className="mt-0.5 text-primary shrink-0" />
                <span className="text-xs text-text-secondary line-clamp-2">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {searchedPin && (
        <Marker position={[searchedPin.lat, searchedPin.lng]} icon={goldIcon}>
          <Popup className="text-xs font-bold text-text">
            <div className="flex flex-col gap-2 p-1">
              <span>{searchedPin.name}</span>
              <button
                onClick={() => {
                  try {
                    const addBtn = document.getElementById("admin-add-counter-btn");
                    if (addBtn) addBtn.click();
                    setTimeout(() => {
                      const event = new MouseEvent("click", {
                        view: window,
                        bubbles: true,
                        cancelable: true,
                        clientX: 0,
                        clientY: 0,
                      });
                      // Emulate a map click hook passing these coords if possible,
                      // or we can invoke a global state.
                      // Since we can't easily trigger the map hook manually, let's expose a global window function.
                      if ((window as any).triggerMapAddPin) {
                        (window as any).triggerMapAddPin(searchedPin.lat, searchedPin.lng, searchedPin.name);
                      }
                    }, 50);
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="bg-primary hover:bg-primary-dark text-white text-[10px] px-2 py-1.5 rounded transition-colors w-full uppercase tracking-widest font-bold"
              >
                Add Counter Here
              </button>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}

// Component to locate user
function LocateControl({ onLocationFound }: { onLocationFound?: (lat: number, lng: number) => void }) {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  const handleLocate = useCallback((e?: React.MouseEvent) => {
    // prevent default so it doesn't trigger map clicks
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    setLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocating(false);
          try {
            if (map) {
              map.flyTo([position.coords.latitude, position.coords.longitude], 16, { duration: 1.5 });
            }
          } catch (e) {
            console.warn("Map not ready for flyTo", e);
          }
          onLocationFound?.(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          setLocating(false);
          // Only alert if they manually clicked the button to avoid annoying popups on load if denied
          if (e) alert("Could not access your location. Please check your browser permissions.");
        },
        { enableHighAccuracy: true }
      );
    } else {
      setLocating(false);
      if (e) alert("Geolocation is not supported by your browser.");
    }
  }, [map, onLocationFound]);

  useEffect(() => {
    // Attempt to locate the user immediately on mount
    handleLocate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute bottom-6 right-4 z-[400] flex flex-col gap-2">
      <button
        onClick={handleLocate}
        title="My Current Location"
        className="bg-surface text-primary shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-border p-3 rounded-full hover:bg-background flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      >
        <Navigation size={22} className={locating ? "animate-ping opacity-50" : ""} />
        <span className="ml-2 font-bold text-sm hidden md:inline">My Location</span>
      </button>
    </div>
  );
}

export default function Map({
  locations,
  activeLocationId,
  panTrigger,
  isAdmin,
  onAddCounter,
  onLocationFound,
  userLocationCoords,
}: {
  locations: Location[];
  activeLocationId: string | null;
  panTrigger?: number;
  isAdmin?: boolean;
  onAddCounter?: (loc: Location) => void;
  onLocationFound?: (lat: number, lng: number) => void;
  userLocationCoords?: { lat: number, lng: number } | null;
}) {
  const defaultCenter = useMemo<[number, number]>(() => [3.139, 101.6869], []);
  const activeLocation = locations.find((loc) => loc.id === activeLocationId);
  const center = useMemo(() => activeLocation ? ([activeLocation.lat, activeLocation.lng] as [number, number]) : defaultCenter, [activeLocation, defaultCenter]);

  const [addMode, setAddMode] = useState(false);
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPicName, setFormPicName] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");

  useEffect(() => {
    (window as any).triggerMapAddPin = (lat: number, lng: number, name: string) => {
      if (!addMode) setAddMode(true);
      setPinCoords({ lat, lng });
      setFormAddress(name); // Auto-fill only the address with the formal search metadata
    };
    return () => {
      delete (window as any).triggerMapAddPin;
    };
  }, [addMode]);

  const handleMapClick = (lat: number, lng: number) => {
    if (!addMode) return;
    setPinCoords({ lat, lng });
  };

  const handleSubmit = () => {
    if (!pinCoords || !formName.trim() || !formStartDate || !formEndDate || !formStartTime || !formEndTime) return;
    
    // Validation: End must be after start
    const startDateTime = new Date(`${formStartDate}T${formStartTime.split('.')[0]}`);
    const endDateTime = new Date(`${formEndDate}T${formEndTime.split('.')[0]}`);
    
    if (endDateTime <= startDateTime) {
      toast.error("End date/time must be strictly after start date/time");
      return;
    }

    const now = new Date();
    
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hr = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    
    const currentDate = `${yyyy}-${mm}-${dd}`;
    const currentTime = `${hr}:${min}`;

    const isFuture = formStartDate > currentDate || (formStartDate === currentDate && formStartTime > currentTime);

    const newLoc: Location = {
      id: `new-${Date.now()}`,
      name: formName,
      lat: pinCoords.lat,
      lng: pinCoords.lng,
      status: isFuture ? "scheduled" : "active",
      address: formAddress || formName, // use typed address, or fallback to name
      start_date: formStartDate,
      end_date: formEndDate,
      start_time: `${formStartTime}:00`,
      end_time: `${formEndTime}:00`,
    };
    onAddCounter?.(newLoc);
    // Reset form
    setAddMode(false);
    setPinCoords(null);
    setFormName("");
    setFormAddress("");
    setFormPicName("");
    setFormStartDate("");
    setFormEndDate("");
    setFormStartTime("");
    setFormEndTime("");
  };

  const cancelAdd = () => {
    setAddMode(false);
    setPinCoords(null);
    setFormName("");
    setFormAddress("");
    setFormPicName("");
    setFormStartDate("");
    setFormEndDate("");
    setFormStartTime("");
    setFormEndTime("");
  };

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {locations.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.lat, loc.lng]}
            icon={loc.status === "active" ? redPulseIcon : yellowPulseIcon}
          >
            <Popup>
              <div className="p-1">
                <h3 className="font-bold font-sans text-sm mb-1">{loc.name}</h3>
                <p className="text-xs text-slate-500 mb-3">{loc.address}</p>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-primary hover:bg-primary-dark text-white w-full py-1.5 rounded flex items-center justify-center gap-1 text-xs transition-colors"
                >
                  <Navigation size={12} />
                  Get Directions
                </a>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Show pin preview when adding */}
        {pinCoords && (
          <Marker position={[pinCoords.lat, pinCoords.lng]} icon={goldIcon}>
            <Popup>
              <div className="p-1 text-xs text-center text-slate-500">
                📍 New counter location
              </div>
            </Popup>
          </Marker>
        )}

        {/* Show user's actual location if known */}
        {userLocationCoords && (
          <Marker position={[userLocationCoords.lat, userLocationCoords.lng]} icon={bluePulseIcon}>
            <Popup>
              <div className="p-1 text-xs text-center font-bold text-blue-600">
                🔵 You are here
              </div>
            </Popup>
          </Marker>
        )}

        <MapUpdater center={center} trigger={panTrigger || 0} />
        {addMode && <MapClickHandler onMapClick={handleMapClick} />}
        <LocateControl onLocationFound={onLocationFound} />
        <MapSearchControl />
      </MapContainer>

      {/* ═══ Admin: Add Counter button + form ═══ */}
      {isAdmin && (
        <div className="absolute top-4 right-4 z-[400]">
          {!addMode ? (
            <button
              id="admin-add-counter-btn"
              onClick={() => setAddMode(true)}
              className="bg-surface text-primary shadow-lg border border-border px-4 py-2 rounded-full font-bold text-sm hover:shadow-xl transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Add Counter
            </button>
          ) : (
            <div className="bg-surface rounded-2xl shadow-2xl border border-border w-72 overflow-hidden">
              <div className="hero-gradient px-4 py-3 text-white flex items-center justify-between">
                <span className="font-bold text-sm">Add Zakat Counter</span>
                <button onClick={cancelAdd} className="text-white/60 hover:text-white"><X size={16} /></button>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-text-muted">
                  {pinCoords
                    ? `📍 ${pinCoords.lat.toFixed(4)}, ${pinCoords.lng.toFixed(4)}`
                    : "👆 Click on the map to place a pin"}
                </p>
                <div className="space-y-2 mb-2">
                  <input
                    type="text"
                    placeholder="Booth name (e.g., Masjid Al-Falah)"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                  />
                  <input
                    type="text"
                    placeholder="Address / Location Details"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-[13px] bg-background outline-none text-text-secondary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-muted uppercase font-bold">Start Date</label>
                    <input type="date" min={new Date().toLocaleDateString('en-CA')} value={formStartDate} onChange={e => { setFormStartDate(e.target.value); if (formEndDate < e.target.value) setFormEndDate(e.target.value); }} className="w-full px-2 py-1.5 border border-border rounded-lg text-[13px] bg-background outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-muted uppercase font-bold">End Date</label>
                    <input type="date" min={formStartDate || new Date().toLocaleDateString('en-CA')} value={formEndDate} onChange={e => setFormEndDate(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded-lg text-[13px] bg-background outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-muted uppercase font-bold">Start Time</label>
                    <input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded-lg text-[13px] bg-background outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-muted uppercase font-bold">End Time</label>
                    <input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded-lg text-[13px] bg-background outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!pinCoords || !formName.trim() || !formStartDate || !formEndDate || !formStartTime || !formEndTime}
                  className="w-full py-2.5 btn-primary text-sm disabled:opacity-40"
                >
                  Save Counter
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instruction overlay when in add mode */}
      {addMode && !pinCoords && (
        <div className="absolute top-4 left-4 z-[400] bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-pulse">
          👆 Click anywhere on the map to place the counter
        </div>
      )}
    </div>
  );
}
