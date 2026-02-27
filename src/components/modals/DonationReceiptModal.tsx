"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Download, Printer, FileText, AlertCircle } from "lucide-react";
import Script from "next/script";
import { createClient } from "@/lib/supabase/client";
import ReceiptContent from "@/components/receipts/ReceiptContent";

interface DonationReceiptModalProps {
  donationId: string;
  onClose: () => void;
}

declare var html2pdf: any;

export default function DonationReceiptModal({ donationId, onClose }: DonationReceiptModalProps) {
  const [donation, setDonation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    async function fetchDonation() {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("donations")
          .select(`
            *,
            crowdfund_campaigns (
              title
            )
          `)
          .eq("id", donationId)
          .single();

        if (fetchError) throw fetchError;
        setDonation(data);
      } catch (err: any) {
        console.error("Fetch receipt modal error:", err);
        setError(err.message || "Failed to load receipt data");
      } finally {
        setLoading(false);
      }
    }

    fetchDonation();
  }, [donationId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!scriptLoaded || !donation) return;
    
    const element = document.getElementById("receipt-content-capture");
    if (!element) return;

    setIsDownloading(true);
    try {
      const opt = {
        margin:       0,
        filename:     `Donation-Receipt-${donationId.slice(0, 8)}.pdf`,
        image:        { type: 'jpeg', quality: 1.0 },
        html2canvas:  { 
          scale: 3, 
          useCORS: true, 
          logging: false,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc: Document) => {
            // Traverse all elements in the cloned document and strip oklch/lab colors
            // which html2canvas fails to parse in modern Tailwind projects
            const elements = clonedDoc.getElementsByTagName('*');
            for (let i = 0; i < elements.length; i++) {
              const el = elements[i] as HTMLElement;
              const style = window.getComputedStyle(el);
              
              // Check for problematic color functions in common properties
              ['color', 'backgroundColor', 'borderColor', 'outlineColor'].forEach(prop => {
                const value = (el.style as any)[prop] || style.getPropertyValue(prop);
                if (value && (value.includes('oklch') || value.includes('lab') || value.includes('oklab'))) {
                  // Fallback to a safe color or just remove if it's a transient variable
                  (el.style as any)[prop] = 'inherit'; 
                }
              });
            }
          }
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("PDF Download error:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" 
        onLoad={() => setScriptLoaded(true)}
      />
      
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300"
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-[32px] w-full max-w-lg shadow-[0_0_60px_rgba(0,0,0,0.4)] relative overflow-hidden flex flex-col h-[90vh] max-h-[850px] scale-up-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header/Toolbar */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 leading-none">Donation Receipt</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Digital Copy</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePrint}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                title="Browser Print"
              >
                <Printer size={20} />
              </button>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto relative bg-slate-50">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-white">
                <Loader2 className="animate-spin text-emerald-500" size={32} />
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Authenticating Receipt...</p>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center text-red-500 bg-white">
                <AlertCircle size={40} />
                <p className="text-sm font-bold">{error}</p>
                <button onClick={onClose} className="mt-4 px-6 py-2 bg-slate-100 rounded-xl text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Close</button>
              </div>
            ) : (
              <div id="receipt-content-capture" className="receipt-theme-light">
                <ReceiptContent donation={donation} />
              </div>
            )}
          </div>

          {/* Footer - Interaction */}
          {!loading && !error && (
            <div className="p-6 bg-white border-t border-slate-100 text-center flex-shrink-0">
              <button 
                onClick={handleDownloadPDF}
                disabled={!scriptLoaded || isDownloading}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-emerald-100 transition-all active:scale-[0.98] hover:translate-y-[-2px]"
              >
                {isDownloading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating Document...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Download PDF Now
                  </>
                )}
              </button>
              <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                Verified Digital Copy
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .fixed { position: static !important; }
          .receipt-capture-area { padding: 0 !important; }
        }
      `}</style>
    </>
  );
}
