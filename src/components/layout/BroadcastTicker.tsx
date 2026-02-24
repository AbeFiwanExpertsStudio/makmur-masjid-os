"use client";

import { Radio } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageContext";

interface Props {
  message: string;
}

// Threshold: scroll if message is longer than this many characters
const SCROLL_THRESHOLD = 50;

/**
 * BroadcastTicker
 * Shows a short message statically; scrolls long messages as a looping ticker.
 * Pauses on hover. No external dependencies.
 *
 * The scrolling span contains two identical halves: [msg + spacer] [msg + spacer]
 * so that translateX(-50%) moves exactly one half, creating a seamless loop.
 *
 * Using long-form animation-name/timing/iteration CSS properties instead of
 * the shorthand so that the inline animationDuration style is not reset to 0s.
 */
export default function BroadcastTicker({ message }: Props) {
  const { t } = useLanguage();
  const shouldScroll = message.length > SCROLL_THRESHOLD;
  const duration = `${Math.max(14, message.length * 0.22)}s`;

  return (
    <div className="hero-gradient text-white">
      <div className="container mx-auto px-4 py-2.5 max-w-5xl flex items-center gap-3">
        {/* Icon pill */}
        <div className="shrink-0 flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest">
          <Radio size={11} className="animate-pulse" />
          <span>{t.siaran}</span>
        </div>

        {/* Ticker strip */}
        {shouldScroll ? (
          <div
            className="flex-1 overflow-hidden relative min-w-0"
            style={{ maskImage: "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)" }}
          >
            {/* key forces remount (restart animation) on message change */}
            <span
              key={message}
              className="text-sm font-medium whitespace-nowrap inline-block animate-ticker-banner"
              style={{ animationDuration: duration }}
            >
              {message}
              <span className="inline-block w-24" />
              {message}
              <span className="inline-block w-24" />
            </span>
          </div>
        ) : (
          <p className="flex-1 text-sm font-medium text-white leading-snug min-w-0">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
