"use client";

import { useState } from "react";
import { HandHeart, X, Heart } from "lucide-react";

const mockCampaigns = [
  { id: "c1", title: "Tabung Iftar Asnaf", description: "Providing free Iftar meals for the underprivileged families.", target: 15000, current: 8450, donors: 124 },
  { id: "c2", title: "Repair Aircond Dewan Solat", description: "Service and fix the main prayer hall air conditioning system.", target: 5000, current: 1200, donors: 38 },
  { id: "c3", title: "Sadaqah Jariyah Anak Yatim", description: "Education fund and Eid clothes for orphans.", target: 10000, current: 4500, donors: 87 },
];

export default function CrowdfundingPage() {
  const [donateModal, setDonateModal] = useState<string | null>(null);
  const activeCampaign = mockCampaigns.find((c) => c.id === donateModal);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="icon-box icon-box-gold">
          <HandHeart size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E2A]">Crowdfunding</h1>
          <p className="text-sm text-[#8FA39B]">Support mosque initiatives this Ramadan</p>
        </div>
      </div>

      <div className="space-y-4">
        {mockCampaigns.map((c) => {
          const pct = Math.round((c.current / c.target) * 100);
          return (
            <div key={c.id} className="card p-6">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-lg text-[#1A2E2A]">{c.title}</h3>
                <span className="badge bg-[#FDF6E3] text-[#D4A843]">
                  <Heart size={10} /> {c.donors} donors
                </span>
              </div>
              <p className="text-sm text-[#5A7068] mb-4">{c.description}</p>

              <div className="flex justify-between text-sm mb-2 font-medium">
                <span className="text-[#1B6B4A] font-bold text-lg">RM{c.current.toLocaleString()}</span>
                <span className="text-[#8FA39B]">of RM{c.target.toLocaleString()}</span>
              </div>
              <div className="progress-bar mb-1">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-[#8FA39B] mb-5 text-right">{pct}% funded</p>

              <button onClick={() => setDonateModal(c.id)} className="w-full py-3 btn-primary text-sm">
                <HandHeart size={16} /> Donate via DuitNow / Card
              </button>
            </div>
          );
        })}
      </div>

      {/* Donate Modal */}
      {donateModal && activeCampaign && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDonateModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="hero-gradient p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mt-16 -mr-16 blur-2xl" />
              <button onClick={() => setDonateModal(null)} className="absolute top-4 right-4 text-white/50 hover:text-white transition">
                <X size={20} />
              </button>
              <p className="text-sm text-white/60">Donate to</p>
              <h2 className="text-lg font-bold mt-1">{activeCampaign.title}</h2>
            </div>
            <div className="p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-[#8FA39B] mb-3">Select Amount</p>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[20, 50, 100].map((amt) => (
                  <button key={amt} className="btn-outline py-3 font-bold text-[#1B6B4A] text-sm hover:bg-[#EEFBF4]">
                    RM{amt}
                  </button>
                ))}
              </div>
              <button className="w-full py-3.5 btn-primary text-sm">Proceed to Payment</button>
              <p className="text-xs text-[#8FA39B] text-center mt-3">Simulated Stripe Checkout</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
