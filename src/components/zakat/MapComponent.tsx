"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import { Navigation, X, Plus } from "lucide-react";

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

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15, { animate: true, duration: 1.5 });
  }, [center, map]);
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

export default function Map({
  locations,
  activeLocationId,
  isAdmin,
  onAddCounter,
}: {
  locations: Location[];
  activeLocationId: string | null;
  isAdmin?: boolean;
  onAddCounter?: (loc: Location) => void;
}) {
  const defaultCenter: [number, number] = [3.139, 101.6869];
  const activeLocation = locations.find((loc) => loc.id === activeLocationId);
  const center = activeLocation ? ([activeLocation.lat, activeLocation.lng] as [number, number]) : defaultCenter;

  const [addMode, setAddMode] = useState(false);
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");

  const handleMapClick = (lat: number, lng: number) => {
    if (!addMode) return;
    setPinCoords({ lat, lng });
  };

  const handleSubmit = () => {
    if (!pinCoords || !formName.trim() || !formStartDate || !formEndDate || !formStartTime || !formEndTime) return;
    const newLoc: Location = {
      id: `new-${Date.now()}`,
      name: formName,
      lat: pinCoords.lat,
      lng: pinCoords.lng,
      status: "active",
      address: formAddress || "TBD",
      start_date: formStartDate,
      end_date: formEndDate,
      start_time: formStartTime,
      end_time: formEndTime,
    };
    onAddCounter?.(newLoc);
    // Reset form
    setAddMode(false);
    setPinCoords(null);
    setFormName("");
    setFormAddress("");
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
                  className="bg-[#1B6B4A] hover:bg-[#0F4A33] text-white w-full py-1.5 rounded flex items-center justify-center gap-1 text-xs transition-colors"
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

        <MapUpdater center={center} />
        {addMode && <MapClickHandler onMapClick={handleMapClick} />}
      </MapContainer>

      {/* ═══ Admin: Add Counter button + form ═══ */}
      {isAdmin && (
        <div className="absolute top-4 right-4 z-[400]">
          {!addMode ? (
            <button
              onClick={() => setAddMode(true)}
              className="bg-white text-[#1B6B4A] shadow-lg border border-[#E2E8E5] px-4 py-2 rounded-full font-bold text-sm hover:shadow-xl transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Add Counter
            </button>
          ) : (
            <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8E5] w-72 overflow-hidden">
              <div className="hero-gradient px-4 py-3 text-white flex items-center justify-between">
                <span className="font-bold text-sm">Add Zakat Counter</span>
                <button onClick={cancelAdd} className="text-white/60 hover:text-white"><X size={16} /></button>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-[#8FA39B]">
                  {pinCoords
                    ? `📍 ${pinCoords.lat.toFixed(4)}, ${pinCoords.lng.toFixed(4)}`
                    : "👆 Click on the map to place a pin"}
                </p>
                <input
                  type="text"
                  placeholder="Booth name (e.g., Masjid Al-Falah)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8E5] rounded-lg text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none bg-[#F8FAF9]"
                />
                <input
                  type="text"
                  placeholder="Address / Location"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8E5] rounded-lg text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none bg-[#F8FAF9]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8FA39B] uppercase font-bold">Start Date</label>
                    <input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} className="w-full px-2 py-1.5 border border-[#E2E8E5] rounded-lg text-[13px] bg-[#F8FAF9] outline-none focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8FA39B] uppercase font-bold">End Date</label>
                    <input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} className="w-full px-2 py-1.5 border border-[#E2E8E5] rounded-lg text-[13px] bg-[#F8FAF9] outline-none focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8FA39B] uppercase font-bold">Start Time</label>
                    <input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)} className="w-full px-2 py-1.5 border border-[#E2E8E5] rounded-lg text-[13px] bg-[#F8FAF9] outline-none focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#8FA39B] uppercase font-bold">End Time</label>
                    <input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)} className="w-full px-2 py-1.5 border border-[#E2E8E5] rounded-lg text-[13px] bg-[#F8FAF9] outline-none focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A]" />
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
        <div className="absolute top-4 left-4 z-[400] bg-[#1A2E2A] text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-pulse">
          👆 Click anywhere on the map to place the counter
        </div>
      )}
    </div>
  );
}
