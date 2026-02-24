"use client";

import { useState, useEffect } from "react";
import { Cloud, TrendingUp, BarChart3, Zap, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAiCrowdPrediction, CrowdPrediction } from "@/lib/ai/getAiPrediction";
import { useLanguage } from "@/components/providers/LanguageContext";
import BroadcastTicker from "@/components/layout/BroadcastTicker";

const attendanceData = [
  { day: "Mon", value: 320 },
  { day: "Tue", value: 210 },
  { day: "Wed", value: 480 },
  { day: "Thu", value: 390 },
  { day: "Fri", value: 1100 },
  { day: "Sat", value: 720 },
  { day: "Sun", value: 680 },
];

export default function DashboardPage() {
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const isWeekend = ["0", "6"].includes(String(new Date(selectedDate).getDay()));
  
  const [weatherData, setWeatherData] = useState<{ temp: number; code: number; desc: string } | null>(null);
  const [prediction, setPrediction] = useState<CrowdPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch latest broadcast from DB + subscribe to real-time updates
  const [latestBroadcast, setLatestBroadcast] = useState<string>("");
  useEffect(() => {
    const supabase = createClient();
    async function fetchBroadcast() {
      const { data } = await supabase
        .from('system_broadcasts')
        .select('message')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (data) setLatestBroadcast(data.message);
    }
    fetchBroadcast();

    const channel = supabase
      .channel("dashboard-broadcasts")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_broadcasts" }, fetchBroadcast)
      .subscribe();

    const onBroadcastSent = () => fetchBroadcast();
    window.addEventListener("makmur:broadcast-sent", onBroadcastSent);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("makmur:broadcast-sent", onBroadcastSent);
    };
  }, []);

  // Fetch Weather and AI Prediction when date changes
  useEffect(() => {
    async function fetchPredictionData() {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Fetch Weather from Open-Meteo (Kuala Lumpur coordinates)
        // Using forecast for future dates, or current weather for today
        const lat = 3.1390;
        const lon = 101.6869;
        
        // Calculate days difference to see if we need forecast or historical
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(selectedDate);
        target.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(target.getTime() - today.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let weatherCode = 0; // Default clear sky
        let temp = 28;
        let desc = "Clear";

        // Open-Meteo only provides 16 days forecast for free
        // DISABLED WEATHER API TO AVOID USAGE LIMITS
        /*
        if (diffDays <= 16 && target >= today) {
          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max&timezone=Asia%2FSingapore&start_date=${selectedDate}&end_date=${selectedDate}`
          );
          
          if (weatherRes.ok) {
            const wData = await weatherRes.json();
            if (wData.daily && wData.daily.weather_code && wData.daily.weather_code.length > 0) {
              weatherCode = wData.daily.weather_code[0];
              temp = Math.round(wData.daily.temperature_2m_max[0]);
              
              // Simple WMO code mapping
              if (weatherCode <= 3) desc = "Clear/Cloudy";
              else if (weatherCode <= 49) desc = "Fog/Mist";
              else if (weatherCode <= 69) desc = "Rain";
              else if (weatherCode <= 79) desc = "Snow";
              else desc = "Storm";
            }
          }
        }
        */

        setWeatherData({ temp, code: weatherCode, desc });

        // 2. Call AI Predictor
        const aiResult = await getAiCrowdPrediction(selectedDate, weatherCode, isWeekend);
        setPrediction(aiResult);

      } catch (err: any) {
        console.error("Failed to fetch prediction data:", err);
        setError(err.message || "Failed to load prediction");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPredictionData();
  }, [selectedDate, isWeekend]);

  return (
    <div className="min-h-screen">
      {/* Broadcast Banner */}
      {latestBroadcast && <BroadcastTicker message={latestBroadcast} />}

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="icon-box icon-box-primary"><BarChart3 size={22} /></div>
          <div>
            <h1 className="text-2xl font-bold text-text">{t.dashboardTitle}</h1>
            <p className="text-sm text-text-muted">{t.dashboardSubtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Select Date */}
          <div className="card p-6">
            <h2 className="font-bold text-lg text-text mb-5">{t.dashboardSelectDate}</h2>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
            />
            <div className="mt-6 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gold mb-1">{t.dashboardModelInputs}</p>
              {[
                [t.dashboardDayOfRamadan, t.dashboardAutoCalc],
                [t.dashboardIsWeekend, isWeekend ? t.yes : t.no],
                [t.dashboardWeatherAPI, weatherData ? `${weatherData.desc} (${weatherData.temp}°C)` : t.loading],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm py-1.5 border-b border-dashed border-border last:border-0">
                  <span className="text-text-secondary">{label}</span>
                  <span className={`font-semibold ${val === "Connected" || val?.includes("°C") ? "text-primary" : "text-text"}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prediction Results */}
          <div className="card p-6 relative">
            {isLoading && (
              <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            )}
            <h2 className="font-bold text-lg text-text mb-5">{t.dashboardPredictionResults}</h2>
            
            {error ? (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
                <p className="font-bold mb-1">{t.dashboardPredictionError}</p>
                <p>{error}</p>
                <p className="mt-2 text-xs opacity-80">{t.dashboardPredictorHint}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: t.dashboardTier, value: prediction ? String(prediction.predicted_tier) : "-" },
                    { label: t.dashboardCrowd, value: prediction ? `${prediction.recommended_food_packs - 50}-${prediction.recommended_food_packs + 50}` : "-" },
                    { label: t.dashboardWeather, value: weatherData ? `${weatherData.temp}°C` : "-", icon: true },
                    { label: t.dashboardConfidence, value: "87%", highlight: true },
                  ].map((item) => (
                    <div key={item.label} className="bg-background border border-border rounded-xl p-3.5 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">{item.label}</p>
                      <p className={`text-xl font-bold ${item.highlight ? "text-primary" : "text-text"} flex items-center justify-center gap-1`}>
                        {item.icon && <Cloud size={16} className="text-text-muted" />}
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="bg-primary-50 border border-[#D5F5E3] rounded-xl p-4 flex items-start gap-3">
                  <div className="text-gold shrink-0 mt-0.5"><Zap size={22} /></div>
                  <div>
                    <p className="font-bold text-sm text-text">{t.dashboardAiReco}</p>
                    <p className="text-sm text-text-secondary mt-0.5">
                      {prediction ? prediction.recommendation : t.dashboardLoadingReco}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Historical Attendance — FIXED: using inline pixel heights for bars */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-bold text-lg text-text">{t.dashboardHistorical}</h2>
              <p className="text-sm text-text-muted">{t.dashboardLast7Days}</p>
            </div>
            <div className="icon-box icon-box-primary w-10 h-10"><TrendingUp size={18} /></div>
          </div>

          {/* Chart */}
          <div className="flex gap-1">
            {/* Y axis */}
            <div className="flex flex-col justify-between text-xs text-text-muted pr-3 font-medium" style={{ height: 240 }}>
              {[1200, 900, 600, 300, 0].map((v) => <span key={v}>{v}</span>)}
            </div>

            {/* Bars container */}
            <div className="flex-1 border-l border-b border-border pl-3 pb-1">
              <div className="flex items-end justify-around gap-3" style={{ height: 240 }}>
                {attendanceData.map((d) => {
                  const barHeight = Math.round((d.value / 1200) * 220);
                  return (
                    <div key={d.day} className="flex flex-col items-center flex-1 justify-end group" style={{ height: 240 }}>
                      <div className="relative w-full flex justify-center" style={{ height: 220, display: 'flex', alignItems: 'flex-end' }}>
                        {/* Tooltip */}
                        <div className="absolute left-1/2 -translate-x-1/2 bg-surface border border-border text-text shadow-md text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition whitespace-nowrap font-medium z-10" style={{ top: 220 - barHeight - 28 }}>
                          {d.value}
                        </div>
                        <div
                          className="rounded-t-lg cursor-pointer hero-gradient transition-opacity group-hover:opacity-80"
                          style={{ width: '60%', maxWidth: 48, height: barHeight }}
                        />
                      </div>
                      <span className="text-xs text-text-muted mt-2 font-medium">{d.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
