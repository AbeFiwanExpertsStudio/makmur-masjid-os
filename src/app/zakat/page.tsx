"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Search, MapPin, Clock, Pencil, Trash2, X, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthContext";
import { createClient } from "@/lib/supabase/client";

const MapComponent = dynamic(() => import("@/components/zakat/MapComponent"), { ssr: false });

type CounterStatus = "active" | "scheduled" | "expired";

interface ZakatCounter {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  hours: string;
  status: CounterStatus;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
}

function waitMs(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  // deg2rad formula
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export default function ZakatLocatorPage() {
  const { isAdmin } = useAuth();
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [panTrigger, setPanTrigger] = useState(0);
  const [locations, setLocations] = useState<ZakatCounter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState<number | "All">("All");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const filteredLocations = locations.filter((loc) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = loc.name.toLowerCase().includes(q) || loc.address.toLowerCase().includes(q);
    if (!matchSearch) return false;

    if (radiusKm !== "All") {
      if (!userLocation) return false;
      const dist = getDistance(userLocation.lat, userLocation.lng, loc.lat, loc.lng);
      if (dist > radiusKm) return false;
    }
    return true;
  });

  // Admin Modals
  const [editingCounter, setEditingCounter] = useState<ZakatCounter | null>(null);
  const [deletingCounter, setDeletingCounter] = useState<ZakatCounter | null>(null);

  const fetchCounters = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("zakat_counters").select("*");
      if (error || !data) return;

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hr = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const sec = String(now.getSeconds()).padStart(2, '0');

      const currentDate = `${yyyy}-${mm}-${dd}`;
      const currentTime = `${hr}:${min}:${sec}`;

      const parsedLocations = data.map(zc => {
        let computedStatus: CounterStatus = "active"; // fallback status

        if (zc.start_date && zc.end_date && zc.start_time && zc.end_time) {
          const cleanStartTime = zc.start_time.split('.')[0];
          const cleanEndTime = zc.end_time.split('.')[0];

          if (currentDate < zc.start_date) {
            computedStatus = "scheduled";
          } else if (currentDate > zc.end_date) {
            computedStatus = "expired";
          } else {
            if (currentDate === zc.start_date && currentTime < cleanStartTime) {
              computedStatus = "scheduled";
            } else if (currentDate === zc.end_date && currentTime > cleanEndTime) {
              computedStatus = "expired";
            } else {
              computedStatus = "active";
            }
          }
        } else if (!zc.is_active) {
          computedStatus = "expired";
        }

        const timeStr = zc.start_time && zc.end_time ? `${zc.start_time.slice(0, 5)} - ${zc.end_time.slice(0, 5)}` : "Daily";

        return {
          id: zc.id,
          name: zc.name,
          lat: zc.latitude,
          lng: zc.longitude,
          address: zc.address || "",
          hours: timeStr,
          status: computedStatus,
          start_date: zc.start_date,
          end_date: zc.end_date,
          start_time: zc.start_time,
          end_time: zc.end_time,
        };
      }).filter(loc => loc.status !== "expired");

      setLocations(parsedLocations);
      // Auto-select first active or scheduled
      const firstValid = parsedLocations.find(l => l.status !== "expired");
      if (firstValid && !activeLocation) setActiveLocation(firstValid.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [activeLocation]);

  useEffect(() => {
    fetchCounters();
  }, [fetchCounters]);

  const handleLocationClick = (id: string) => {
    if (isPanning) return;
    setIsPanning(true);
    setActiveLocation(id);
    setPanTrigger(prev => prev + 1);
    // Debounce map panning clicks
    setTimeout(() => setIsPanning(false), 800);
  };

  const handleAddCounter = async (newLoc: any) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("zakat_counters").insert({
        name: newLoc.name,
        latitude: newLoc.lat,
        longitude: newLoc.lng,
        address: newLoc.address,
        start_date: newLoc.start_date,
        end_date: newLoc.end_date,
        start_time: newLoc.start_time,
        end_time: newLoc.end_time,
        is_active: true,
      }).select("id").single();

      if (error) throw error;

      const timeStr = newLoc.start_time && newLoc.end_time ? `${newLoc.start_time.slice(0, 5)} - ${newLoc.end_time.slice(0, 5)}` : "Daily";
      setLocations((prev) => [...prev, {
        id: data.id,
        name: newLoc.name,
        lat: newLoc.lat,
        lng: newLoc.lng,
        status: newLoc.status,
        address: newLoc.address,
        hours: timeStr,
        start_date: newLoc.start_date,
        end_date: newLoc.end_date,
        start_time: newLoc.start_time,
        end_time: newLoc.end_time,
      }]);
    } catch (err) {
      console.error("Error adding counter:", err);
      alert("Failed to save counter to database.");
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] bg-[#F8FAF9] overflow-hidden">
      {/* Sidebar */}
      <div className="w-full md:w-96 bg-white border-r border-[#E2E8E5] flex flex-col h-1/2 md:h-full z-10">
        <div className="p-4 border-b border-[#E2E8E5] bg-white sticky top-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="icon-box icon-box-primary w-10 h-10"><MapPin size={18} /></div>
            <h1 className="text-lg font-bold text-[#1A2E2A]">Zakat Locator</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-[#8FA39B]" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by area or mosque..."
              className="w-full bg-[#F8FAF9] text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none border border-[#E2E8E5] focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] transition"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-semibold text-[#8FA39B] uppercase">Radius Filter:</span>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value === "All" ? "All" : Number(e.target.value))}
              className="bg-[#F8FAF9] border border-[#E2E8E5] text-sm rounded-lg py-1 px-2 outline-none focus:border-[#1B6B4A]"
            >
              <option value="All">All Locations</option>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
            </select>
          </div>
          {radiusKm !== "All" && !userLocation && (
            <div className="mt-2 text-[11px] text-amber-600 bg-amber-50 rounded p-1.5 border border-amber-100 flex items-start gap-1">
              <AlertTriangle size={14} className="shrink-0" />
              <p>Please click "My Location" on the map so we can calculate distances!</p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredLocations.length === 0 ? (
            <div className="text-center py-10 bg-[#F8FAF9] rounded-2xl border border-[#E2E8E5]">
              <MapPin size={32} className="mx-auto text-[#8FA39B] opacity-30 mb-2" />
              <p className="text-[#5A7068] text-sm">No locations found. Try somewhere else or adjust filters.</p>
            </div>
          ) : filteredLocations.map((loc) => (
            <div
              key={loc.id}
              onClick={() => handleLocationClick(loc.id)}
              className={`card p-4 cursor-pointer relative ${activeLocation === loc.id ? "border-[#1B6B4A] bg-[#EEFBF4]" : ""} ${isPanning ? "pointer-events-none opacity-80" : ""}`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-[#1A2E2A] text-sm pr-12">{loc.name}</h3>
                <span className={`badge text-[10px] whitespace-nowrap ${loc.status === "active" ? "bg-[#EEFBF4] text-[#1B6B4A]" :
                  loc.status === "scheduled" ? "bg-[#FFF9EE] text-[#D4A843]" :
                    "bg-[#F1F5F3] text-[#8FA39B]"
                  }`}>
                  {loc.status === "active" ? "● ACTIVE" : loc.status === "scheduled" ? "SCHEDULED" : "EXPIRED"}
                </span>
              </div>

              <div className="space-y-1.5 mt-2">
                <div className="flex items-start gap-2 text-[#5A7068] text-xs">
                  <MapPin size={13} className="mt-0.5 shrink-0" /> <span className="line-clamp-2">{loc.address}</span>
                </div>
                <div className="flex items-start gap-2 text-[#5A7068] text-xs">
                  <Clock size={13} className="mt-0.5 shrink-0" /> {loc.hours}
                </div>
              </div>

              {isAdmin && (
                <div className="absolute bottom-3 right-3 flex gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingCounter(loc); }}
                    className="p-1.5 bg-white border border-[#E2E8E5] rounded-md text-[#5A7068] hover:text-[#1B6B4A] hover:bg-[#EEFBF4] transition"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingCounter(loc); }}
                    className="p-1.5 bg-white border border-[#E2E8E5] rounded-md text-[#5A7068] hover:text-red-500 hover:bg-red-50 transition"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="w-full h-1/2 md:h-full md:flex-1 relative z-0 bg-[#E2E8E5]">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-[#E2E8E5]">
            <div className="animate-pulse flex flex-col items-center">
              <MapPin size={32} className="text-[#8FA39B] mb-2" />
              <p className="text-sm font-medium text-[#8FA39B]">Loading map...</p>
            </div>
          </div>
        ) : (
          <MapComponent
            locations={filteredLocations}
            activeLocationId={activeLocation}
            panTrigger={panTrigger}
            isAdmin={isAdmin}
            onAddCounter={handleAddCounter}
            onLocationFound={(lat, lng) => setUserLocation({ lat, lng })}
          />
        )}
      </div>

      {/* Modals */}
      {editingCounter && (
        <EditCounterModal
          counter={editingCounter}
          onClose={() => setEditingCounter(null)}
          onSave={(updated) => {
            setLocations(prev => prev.map(l => l.id === updated.id ? updated : l));
          }}
        />
      )}
      {deletingCounter && (
        <DeleteCounterModal
          counter={deletingCounter}
          onClose={() => setDeletingCounter(null)}
          onDelete={(id) => {
            setLocations(prev => prev.filter(l => l.id !== id));
            if (activeLocation === id) setActiveLocation(null);
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// Admin CRUD Modals
// -------------------------------------------------------------------------------------------------

function EditCounterModal({ counter, onClose, onSave }: { counter: ZakatCounter, onClose: () => void, onSave: (c: ZakatCounter) => void }) {
  const [name, setName] = useState(counter.name);
  const [address, setAddress] = useState(counter.address);
  const [startDate, setStartDate] = useState(counter.start_date || "");
  const [endDate, setEndDate] = useState(counter.end_date || "");
  const [startTime, setStartTime] = useState(counter.start_time?.slice(0, 5) || "");
  const [endTime, setEndTime] = useState(counter.end_time?.slice(0, 5) || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    try {
      await Promise.race([
        supabase.from("zakat_counters").update({
          name, address, start_date: startDate, end_date: endDate,
          start_time: startTime ? `${startTime}:00` : null,
          end_time: endTime ? `${endTime}:00` : null
        }).eq("id", counter.id),
        waitMs(5000)
      ]);

      const timeStr = startTime && endTime ? `${startTime} - ${endTime}` : "Daily";

      onSave({
        ...counter,
        name, address, hours: timeStr,
        start_date: startDate, end_date: endDate,
        start_time: startTime ? `${startTime}:00` : undefined,
        end_time: endTime ? `${endTime}:00` : undefined
      });
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 transition-opacity" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 z-20 text-white/50 hover:text-white transition bg-black/20 rounded-full p-1">
          <X size={20} />
        </button>

        <div className="hero-gradient p-5 text-white overflow-hidden rounded-t-2xl relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mt-16 -mr-16 blur-2xl" />
          <h2 className="text-lg font-bold relative z-10 flex items-center gap-2"><Pencil size={18} /> Edit Zakat Counter</h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#5A7068] uppercase block mb-1">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-[#E2E8E5] rounded-lg text-sm bg-[#F8FAF9] outline-none focus:border-[#1B6B4A]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#5A7068] uppercase block mb-1">Address</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full px-3 py-2 border border-[#E2E8E5] rounded-lg text-sm bg-[#F8FAF9] outline-none focus:border-[#1B6B4A]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#5A7068] uppercase block mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-[#E2E8E5] rounded-lg text-sm bg-[#F8FAF9] outline-none focus:border-[#1B6B4A]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#5A7068] uppercase block mb-1">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-[#E2E8E5] rounded-lg text-sm bg-[#F8FAF9] outline-none focus:border-[#1B6B4A]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#5A7068] uppercase block mb-1">Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-3 py-2 border border-[#E2E8E5] rounded-lg text-sm bg-[#F8FAF9] outline-none focus:border-[#1B6B4A]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#5A7068] uppercase block mb-1">End Time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full px-3 py-2 border border-[#E2E8E5] rounded-lg text-sm bg-[#F8FAF9] outline-none focus:border-[#1B6B4A]" />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="w-full py-3.5 btn-primary text-sm mt-3 flex justify-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />} Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteCounterModal({ counter, onClose, onDelete }: { counter: ZakatCounter, onClose: () => void, onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const supabase = createClient();
    await Promise.race([
      supabase.from("zakat_counters").delete().eq("id", counter.id),
      waitMs(5000)
    ]);
    onDelete(counter.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 transition-opacity" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-red-50 border-b border-red-100 p-5 flex items-center justify-between">
          <div className="flex gap-3 items-center">
            <AlertTriangle className="text-red-500" />
            <h2 className="font-bold text-[#1A2E2A]">Delete Location?</h2>
          </div>
          <button onClick={onClose} className="text-red-500 hover:text-red-700 bg-red-100 p-1 rounded-md transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6">
          <p className="text-sm text-[#5A7068] mb-4">Are you sure you want to remove "{counter.name}"?</p>
          <button onClick={handleDelete} disabled={deleting} className="w-full py-3 bg-red-500 text-white rounded-xl font-bold flex justify-center gap-2 transition-colors">
            {deleting && <Loader2 size={16} className="animate-spin" />} {deleting ? "Deleting..." : "Delete Location"}
          </button>
        </div>
      </div>
    </div>
  );
}
