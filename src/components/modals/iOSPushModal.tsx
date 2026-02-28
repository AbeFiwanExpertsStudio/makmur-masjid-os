"use client";

import React from "react";
import { X, Share, PlusSquare, Bell } from "lucide-react";

interface IOSPushModalProps {
  onClose: () => void;
}

export default function IOSPushModal({ onClose }: IOSPushModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative animate-in slide-in-from-bottom-8 duration-500">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="text-center pt-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-5">
            <Bell size={32} />
          </div>
          
          <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight mb-2">
            Enable Push Notifications
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 px-4">
            To receive updates on your iPhone, you first need to add this app to your home screen.
          </p>

          <div className="space-y-6 text-left bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-100 dark:border-slate-800/50">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-slate-900 dark:text-white font-black text-sm shrink-0">1</div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Tap the <span className="inline-flex items-center justify-center p-1 bg-white dark:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-600 shadow-sm mx-1"><Share size={14} className="text-blue-500" /></span> <strong className="text-slate-900 dark:text-white">Share</strong> button in your browser toolbar.
              </p>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-slate-900 dark:text-white font-black text-sm shrink-0">2</div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Scroll down and select <span className="inline-flex items-center justify-center p-1 bg-white dark:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-600 shadow-sm mx-1"><PlusSquare size={14} /></span> <strong className="text-slate-900 dark:text-white">Add to Home Screen</strong>.
              </p>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-slate-900 dark:text-white font-black text-sm shrink-0">3</div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Open the app from your <strong className="text-slate-900 dark:text-white">Home Screen</strong> and go back to your profile to enable notifications.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[1.25rem] font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all active:scale-[0.98]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
