"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Search, MapPin, Clock } from "lucide-react";
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
}

export default function ZakatLocatorPage() {
  const { isAdmin, isAnonymous } = useAuth();
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [locations, setLocations] = useState<ZakatCounter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchCounters = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.from("zakat_counters").select("*");
        if (error || !data) {
          if (mounted) setIsLoading(false);
          return;
        }

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
            // strip milliseconds from postgres time for smooth string compare
            const cleanStartTime = zc.start_time.split('.')[0];
            const cleanEndTime = zc.end_time.split('.')[0];

            if (currentDate < zc.start_date) {
              computedStatus = "scheduled";
            } else if (currentDate > zc.end_date) {
              computedStatus = "expired";
            } else { // We are within the date range
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

          return {
            id: zc.id,
            name: zc.name,
            lat: zc.latitude,
            lng: zc.longitude,
            address: zc.address || "",
            hours: zc.hours || "",
            status: computedStatus,
          };
        }).filter(loc => loc.status !== "expired");

        if (mounted) {
          setLocations(parsedLocations);
          setIsLoading(false);
          // Auto-select first active or scheduled
          const firstValid = parsedLocations.find(l => l.status !== "expired");
          if (firstValid) setActiveLocation(firstValid.id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchCounters();
    return () => { mounted = false; };
  }, []);

  const handleAddCounter = async (newLoc: { id: string; name: string; lat: number; lng: number; status: "active" | "scheduled" | "expired"; address: string; start_date?: string; end_date?: string; start_time?: string; end_time?: string }) => {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("zakat_counters").insert({
        name: newLoc.name,
        latitude: newLoc.lat,
        longitude: newLoc.lng,
        address: newLoc.address,
        start_date: newLoc.start_date,
        end_date: newLoc.end_date,
        start_time: newLoc.start_time,
        end_time: newLoc.end_time,
        is_active: true,
      });
      if (error) throw error;
      
      // Update local UI immediately
      const timeStr = newLoc.start_time && newLoc.end_time ? `${newLoc.start_time.slice(0,5)} - ${newLoc.end_time.slice(0,5)}` : newLoc.address;
      setLocations((prev) => [...prev, { 
        id: newLoc.id,
        name: newLoc.name,
        lat: newLoc.lat,
        lng: newLoc.lng,
        status: newLoc.status,
        address: newLoc.address,
        hours: timeStr
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
              placeholder="Search by area or mosque..."
              className="w-full bg-[#F8FAF9] text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none border border-[#E2E8E5] focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] transition"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {locations.map((loc) => (
            <div
              key={loc.id}
              onClick={() => setActiveLocation(loc.id)}
              className={`card p-4 cursor-pointer ${activeLocation === loc.id ? "border-[#1B6B4A] bg-[#EEFBF4]" : ""}`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-[#1A2E2A] text-sm">{loc.name}</h3>
                <span className={`badge text-[10px] ${
                  loc.status === "active" ? "bg-[#EEFBF4] text-[#1B6B4A]" :
                  loc.status === "scheduled" ? "bg-[#FFF9EE] text-[#D4A843]" :
                  "bg-[#F1F5F3] text-[#8FA39B]"
                }`}>
                  {loc.status === "active" ? "● ACTIVE" : loc.status === "scheduled" ? "SCHEDULED" : "EXPIRED"}
                </span>
              </div>
              <div className="space-y-1.5 mt-2">
                <div className="flex items-start gap-2 text-[#5A7068] text-xs">
                  <MapPin size={13} className="mt-0.5 shrink-0" /> {loc.address}
                </div>
                <div className="flex items-start gap-2 text-[#5A7068] text-xs">
                  <Clock size={13} className="mt-0.5 shrink-0" /> {loc.hours}
                </div>
              </div>
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
            locations={locations}
            activeLocationId={activeLocation}
            isAdmin={isAdmin}
            onAddCounter={handleAddCounter}
          />
        )}
      </div>
    </div>
  );
}
