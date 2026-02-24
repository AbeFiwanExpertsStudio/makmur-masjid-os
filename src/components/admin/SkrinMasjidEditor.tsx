"use client";
/**
 * SkrinMasjidEditor — mosque display screen configurator.
 * Moved out of admin/page.tsx to keep the page thin.
 * Includes the SortableSlideItem sub-component.
 */
import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Monitor,
  ExternalLink,
  Upload,
  ImageIcon,
  LocateFixed,
  GripVertical,
  Trash2,
  Loader2,
  LayoutGrid,
  LayoutList,
} from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import type { ScreenConfig, ScreenSlide } from "@/hooks/useScreenConfig";
import { DEFAULT_SCREEN_CONFIG } from "@/hooks/useScreenConfig";
import { toast } from "react-hot-toast";

// ── Module list ──────────────────────────────────────────────
const MODULE_LIST: { key: keyof ScreenConfig; labelKey: string; descKey: string }[] = [
  { key: "gambar_masjid", labelKey: "skrinGambar",     descKey: "skrinGambarDesc"     },
  { key: "alert_masuk",   labelKey: "skrinAlertMasuk", descKey: "skrinAlertMasukDesc" },
  { key: "alert_iqamat",  labelKey: "skrinIqamat",     descKey: "skrinIqamatDesc"     },
  { key: "slideshow",     labelKey: "skrinSlideshow",  descKey: "skrinSlideshowDesc"  },
  { key: "panel_waktu",   labelKey: "skrinPanelWaktu", descKey: "skrinPanelWaktuDesc" },
  { key: "bunyi_azan",    labelKey: "skrinAzan",       descKey: "skrinAzanDesc"       },
  { key: "ticker",        labelKey: "skrinTicker",     descKey: "skrinTickerDesc"     },
];

// ── SortableSlideItem ────────────────────────────────────────
function SortableSlideItem({
  slide,
  onDelete,
}: {
  slide: ScreenSlide;
  onDelete: (s: ScreenSlide) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative rounded-xl overflow-hidden border border-border group"
    >
      <button
        {...attributes}
        {...listeners}
        className="absolute top-1.5 left-1.5 z-10 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={11} />
      </button>
      <img
        src={slide.url}
        alt={slide.caption}
        className="w-full h-24 object-cover"
      />
      {slide.caption && (
        <p className="text-xs text-text-muted px-2 py-1 truncate bg-surface">
          {slide.caption}
        </p>
      )}
      <button
        onClick={() => onDelete(slide)}
        className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

// ── SkrinMasjidEditor ────────────────────────────────────────
export default function SkrinMasjidEditor() {
  const { t, language } = useLanguage();
  const supabase = createClient();

  const [cfg, setCfg] = useState<ScreenConfig>(DEFAULT_SCREEN_CONFIG);
  const [slides, setSlides] = useState<ScreenSlide[]>([]);
  const [loadingCfg, setLoadingCfg] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const [photoUploading, setPhotoUploading] = useState(false);
  const [slideFile, setSlideFile] = useState<File | null>(null);
  const [slideCaption, setSlideCaption] = useState("");
  const [slideUploading, setSlideUploading] = useState(false);
  const [iqamatDelay, setIqamatDelay] = useState(cfg.alert_iqamat.delay_minutes);
  const [slideInterval, setSlideInterval] = useState(cfg.slideshow.interval_seconds);

  useEffect(() => {
    const load = async () => {
      const [sRes, slRes] = await Promise.all([
        supabase
          .from("system_settings")
          .select("screen_config")
          .eq("id", 1)
          .single(),
        supabase.from("screen_slides").select("*").order("sort_order"),
      ]);
      if (sRes.data?.screen_config) {
        const merged = { ...DEFAULT_SCREEN_CONFIG, ...sRes.data.screen_config };
        setCfg(merged);
        setIqamatDelay(merged.alert_iqamat.delay_minutes);
        setSlideInterval(merged.slideshow.interval_seconds);
      }
      if (slRes.data) setSlides(slRes.data);
      setLoadingCfg(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePartial = async (partial: Partial<ScreenConfig>) => {
    const updated = { ...cfg, ...partial };
    setCfg(updated);
    await supabase
      .from("system_settings")
      .update({ screen_config: updated })
      .eq("id", 1);
  };

  const toggleModule = async (key: keyof ScreenConfig) => {
    const module = cfg[key] as Record<string, unknown>;
    await savePartial({ [key]: { ...module, enabled: !module.enabled } });
  };

  const handlePhotoUpload = async (file: File) => {
    setPhotoUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `mosque-bg-${Date.now()}.${ext}`;
      const { data: uploadData, error } = await supabase.storage
        .from("screen-assets")
        .upload(fileName, file, { upsert: true });
      if (error) {
        toast.error("Upload failed.");
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("screen-assets").getPublicUrl(uploadData.path);
      await savePartial({ gambar_masjid: { ...cfg.gambar_masjid, url: publicUrl } });
      toast.success("Mosque photo updated!");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSlideUpload = async () => {
    if (!slideFile) return;
    setSlideUploading(true);
    try {
      const ext = slideFile.name.split(".").pop();
      const fileName = `slide-${Date.now()}.${ext}`;
      const { data: uploadData, error } = await supabase.storage
        .from("screen-slides")
        .upload(fileName, slideFile);
      if (error) {
        toast.error("Slide upload failed.");
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage
        .from("screen-slides")
        .getPublicUrl(uploadData.path);
      const { data: newSlide } = await supabase
        .from("screen_slides")
        .insert({
          url: publicUrl,
          caption: slideCaption.trim(),
          sort_order: slides.length,
        })
        .select()
        .single();
      if (newSlide) setSlides((prev) => [...prev, newSlide]);
      setSlideFile(null);
      setSlideCaption("");
      toast.success("Slide added!");
    } finally {
      setSlideUploading(false);
    }
  };

  const handleDeleteSlide = async (slide: ScreenSlide) => {
    await supabase.from("screen_slides").delete().eq("id", slide.id);
    setSlides((prev) => prev.filter((s) => s.id !== slide.id));
    toast.success("Slide removed.");
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = slides.findIndex((s) => s.id === active.id);
    const newIdx = slides.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(slides, oldIdx, newIdx);
    setSlides(reordered);
    await Promise.all(
      reordered.map((s, i) =>
        supabase.from("screen_slides").update({ sort_order: i }).eq("id", s.id)
      )
    );
  };

  const [zoneDetecting, setZoneDetecting] = useState(false);
  const detectZone = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation tidak disokong.");
      return;
    }
    setZoneDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://api.waktusolat.app/zones/${coords.latitude}/${coords.longitude}`
          );
          const data: { zone: string; district: string } = await res.json();
          if (!data.zone) throw new Error("no zone");
          const updated = { ...cfg, zone: data.zone };
          setCfg(updated);
          await supabase
            .from("system_settings")
            .update({ screen_config: updated })
            .eq("id", 1);
          toast.success(`Zon dikesan: ${data.zone} (${data.district})`);
        } catch {
          toast.error("Gagal mengesan zon. Cuba lagi.");
        } finally {
          setZoneDetecting(false);
        }
      },
      () => {
        toast.error("Akses lokasi ditolak.");
        setZoneDetecting(false);
      }
    );
  };

  if (loadingCfg) {
    return (
      <div className="card p-6 flex items-center gap-2 text-text-muted text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading screen settings…
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="icon-box icon-box-primary"><Monitor size={20} /></div>
          <div>
            <h2 className="font-bold text-lg text-text">{t.skrinTitle}</h2>
            <p className="text-sm text-text-muted mt-0.5">{t.skrinDesc}</p>
          </div>
        </div>
        <a
          href="/paparan-masjid"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/30 rounded-lg px-3 py-2 hover:bg-primary/10 transition whitespace-nowrap"
        >
          <ExternalLink size={13} /> {t.skrinOpenDisplay}
        </a>
      </div>

      {/* Live Preview */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-2 block">
          Live Preview
        </label>
        <div
          className="relative overflow-hidden rounded-2xl border border-border bg-black"
          style={{ height: 165 }}
        >
          <iframe
            src="/paparan-masjid"
            className="absolute top-0 left-0 pointer-events-none border-0"
            style={{
              width: "334%",
              height: "334%",
              transform: "scale(0.3)",
              transformOrigin: "top left",
            }}
          />
        </div>
      </div>

      {/* Zone Selector */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-1 block">
          {t.skrinZone}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={cfg.zone}
            onChange={(e) => setCfg((prev) => ({ ...prev, zone: e.target.value }))}
            onBlur={() => savePartial({ zone: cfg.zone })}
            placeholder="e.g. WLY01, SGR01"
            className="flex-1 border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
          />
          <button
            onClick={detectZone}
            disabled={zoneDetecting}
            title="Kesan zon dari lokasi anda"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm text-text-secondary hover:border-primary hover:text-primary transition disabled:opacity-50"
          >
            {zoneDetecting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <LocateFixed size={14} />
            )}
            {zoneDetecting ? "…" : "Auto"}
          </button>
        </div>
      </div>

      {/* Module Toggles */}
      <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
        {MODULE_LIST.map(({ key, labelKey, descKey }) => {
          const module = cfg[key] as Record<string, unknown>;
          const enabled = Boolean(module?.enabled);
          return (
            <div
              key={key}
              className="flex items-center justify-between p-4 bg-surface"
            >
              <div>
                <p className="text-sm font-semibold text-text">
                  {(t as Record<string, unknown>)[labelKey] as string}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {(t as Record<string, unknown>)[descKey] as string}
                </p>
              </div>
              <button
                onClick={() => toggleModule(key)}
                className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${
                  enabled
                    ? "bg-primary justify-end"
                    : "bg-border justify-start"
                }`}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Mosque Photo Upload */}
      {cfg.gambar_masjid.enabled && (
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-text-secondary block">
            {t.skrinUploadPhoto}
          </label>
          {cfg.gambar_masjid.url && (
            <img
              src={cfg.gambar_masjid.url}
              alt="Mosque"
              className="w-full h-36 object-cover rounded-xl border border-border"
            />
          )}
          <div className="flex items-center gap-3">
            <label className="flex-1 flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-border rounded-xl text-sm text-text-muted hover:border-primary hover:text-primary transition cursor-pointer">
              {photoUploading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Upload size={15} />
              )}
              {photoUploading ? t.skrinUploading : t.skrinUploadPhoto}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePhotoUpload(f);
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Iqamat Delay */}
      {cfg.alert_iqamat.enabled && (
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-1 block">
            {t.skrinIqamatDelay}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={60}
              value={iqamatDelay}
              onChange={(e) => setIqamatDelay(Number(e.target.value))}
              className="w-24 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary bg-background"
            />
            <button
              onClick={() =>
                savePartial({
                  alert_iqamat: {
                    ...cfg.alert_iqamat,
                    delay_minutes: iqamatDelay,
                  },
                })
              }
              className="py-2 px-4 btn-primary text-sm"
            >
              {t.skrinSaveSettings}
            </button>
          </div>
        </div>
      )}

      {/* Panel Waktu Layout */}
      {cfg.panel_waktu.enabled && (
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-2 block">
            {language === "en"
              ? "Prayer Time Panel Layout"
              : "Susun Atur Panel Waktu Solat"}
          </label>
          <div className="flex gap-2">
            {(["horizontal", "vertical"] as const).map((opt) => {
              const active = (cfg.panel_waktu.layout ?? "horizontal") === opt;
              return (
                <button
                  key={opt}
                  onClick={() =>
                    savePartial({
                      panel_waktu: { ...cfg.panel_waktu, layout: opt },
                    })
                  }
                  className={`flex items-center gap-2 flex-1 justify-center py-2.5 rounded-xl border text-sm font-semibold transition ${
                    active
                      ? "bg-primary text-white border-primary"
                      : "border-border text-text-secondary hover:border-primary hover:text-primary"
                  }`}
                >
                  {opt === "horizontal" ? (
                    <LayoutGrid size={15} />
                  ) : (
                    <LayoutList size={15} />
                  )}
                  {opt === "horizontal"
                    ? language === "en"
                      ? "Horizontal"
                      : "Mendatar"
                    : language === "en"
                    ? "Vertical"
                    : "Menegak"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Slideshow Interval */}
      {cfg.slideshow.enabled && (
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-1 block">
            {t.skrinSlideInterval}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={3}
              max={120}
              value={slideInterval}
              onChange={(e) => setSlideInterval(Number(e.target.value))}
              className="w-24 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary bg-background"
            />
            <button
              onClick={() =>
                savePartial({
                  slideshow: {
                    ...cfg.slideshow,
                    interval_seconds: slideInterval,
                  },
                })
              }
              className="py-2 px-4 btn-primary text-sm"
            >
              {t.skrinSaveSettings}
            </button>
          </div>
        </div>
      )}

      {/* Slide Manager */}
      {cfg.slideshow.enabled && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">
            {t.skrinSlideshow}
          </p>

          {slides.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6 rounded-xl border border-dashed border-border">
              {t.skrinNoSlides}
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={slides.map((s) => s.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {slides.map((slide) => (
                    <SortableSlideItem
                      key={slide.id}
                      slide={slide}
                      onDelete={handleDeleteSlide}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Upload new slide */}
          <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <ImageIcon size={14} className="text-text-muted" />
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                {t.skrinUploadSlide}
              </span>
            </div>
            <label className="flex items-center justify-center gap-2 py-2 border border-border rounded-xl text-sm text-text-muted hover:border-primary hover:text-primary transition cursor-pointer w-full">
              <Upload size={14} />
              {slideFile ? slideFile.name : t.skrinUploadSlide}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setSlideFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <input
              type="text"
              value={slideCaption}
              onChange={(e) => setSlideCaption(e.target.value)}
              placeholder={t.skrinSlideCaption}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary bg-background"
            />
            <button
              onClick={handleSlideUpload}
              disabled={!slideFile || slideUploading}
              className="w-full py-2.5 btn-primary text-sm flex justify-center gap-2 disabled:opacity-50"
            >
              {slideUploading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Upload size={15} />
              )}
              {slideUploading ? t.skrinUploading : t.skrinAddSlide}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
