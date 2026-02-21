"use client";

import { useState } from "react";
import { Bell, Cloud, TrendingUp, BarChart3, Zap } from "lucide-react";

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
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const isWeekend = ["0", "6"].includes(String(new Date(selectedDate).getDay()));
  const tier = 2;

  return (
    <div className="min-h-screen">
      {/* Broadcast Banner */}
      <div className="hero-gradient text-white px-4 py-3 flex items-center gap-3">
        <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center shrink-0">
          <Bell size={12} />
        </div>
        <span className="text-sm"><strong>Latest Broadcast:</strong> <span className="text-white/70">Tarawih tonight at 8:45 PM, led by Sheikh Al-Afasy.</span></span>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="icon-box icon-box-primary"><BarChart3 size={22} /></div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A2E2A]">AI Resource Dashboard</h1>
            <p className="text-sm text-[#8FA39B]">Crowd prediction & resource planning</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Select Date */}
          <div className="card p-6">
            <h2 className="font-bold text-lg text-[#1A2E2A] mb-5">Select Date</h2>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-3 border border-[#E2E8E5] rounded-xl text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none bg-[#F8FAF9]"
            />
            <div className="mt-6 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[#D4A843] mb-1">Model Inputs</p>
              {[
                ["Day of Ramadan", "Auto-calculated"],
                ["Is Weekend", isWeekend ? "Yes" : "No"],
                ["Weather API", "Connected"],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm py-1.5 border-b border-dashed border-[#E2E8E5] last:border-0">
                  <span className="text-[#5A7068]">{label}</span>
                  <span className={`font-semibold ${val === "Connected" ? "text-[#1B6B4A]" : "text-[#1A2E2A]"}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prediction Results */}
          <div className="card p-6">
            <h2 className="font-bold text-lg text-[#1A2E2A] mb-5">Prediction Results</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: "TIER", value: String(tier) },
                { label: "EST. CROWD", value: "500-1000" },
                { label: "WEATHER", value: "28°C", icon: true },
                { label: "CONFIDENCE", value: "87%", highlight: true },
              ].map((item) => (
                <div key={item.label} className="bg-[#F8FAF9] border border-[#E2E8E5] rounded-xl p-3.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8FA39B] mb-1.5">{item.label}</p>
                  <p className={`text-xl font-bold ${item.highlight ? "text-[#1B6B4A]" : "text-[#1A2E2A]"} flex items-center justify-center gap-1`}>
                    {item.icon && <Cloud size={16} className="text-[#8FA39B]" />}
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-[#EEFBF4] border border-[#D5F5E3] rounded-xl p-4 flex items-start gap-3">
              <div className="icon-box icon-box-gold shrink-0 w-10 h-10"><Zap size={18} /></div>
              <div>
                <p className="font-bold text-sm text-[#1A2E2A]">AI Recommendation</p>
                <p className="text-sm text-[#5A7068] mt-0.5">Standard preparation. 500 Iftar packs recommended.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Historical Attendance — FIXED: using inline pixel heights for bars */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-bold text-lg text-[#1A2E2A]">Historical Attendance</h2>
              <p className="text-sm text-[#8FA39B]">Last 7 Days</p>
            </div>
            <div className="icon-box icon-box-primary w-10 h-10"><TrendingUp size={18} /></div>
          </div>

          {/* Chart */}
          <div className="flex gap-1">
            {/* Y axis */}
            <div className="flex flex-col justify-between text-xs text-[#8FA39B] pr-3 font-medium" style={{ height: 240 }}>
              {[1200, 900, 600, 300, 0].map((v) => <span key={v}>{v}</span>)}
            </div>

            {/* Bars container */}
            <div className="flex-1 border-l border-b border-[#E2E8E5] pl-3 pb-1">
              <div className="flex items-end justify-around gap-3" style={{ height: 240 }}>
                {attendanceData.map((d) => {
                  const barHeight = Math.round((d.value / 1200) * 220);
                  return (
                    <div key={d.day} className="flex flex-col items-center flex-1 justify-end group" style={{ height: 240 }}>
                      <div className="relative w-full flex justify-center" style={{ height: 220, display: 'flex', alignItems: 'flex-end' }}>
                        {/* Tooltip */}
                        <div className="absolute left-1/2 -translate-x-1/2 bg-[#1A2E2A] text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition whitespace-nowrap font-medium z-10" style={{ top: 220 - barHeight - 28 }}>
                          {d.value}
                        </div>
                        <div
                          className="rounded-t-lg cursor-pointer hero-gradient transition-opacity group-hover:opacity-80"
                          style={{ width: '60%', maxWidth: 48, height: barHeight }}
                        />
                      </div>
                      <span className="text-xs text-[#8FA39B] mt-2 font-medium">{d.day}</span>
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
