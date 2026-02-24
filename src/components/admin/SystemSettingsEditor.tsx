"use client";
/**
 * SystemSettingsEditor — branding settings (mosque name + description).
 * Moved out of admin/page.tsx to keep the page thin.
 */
import { useState, useEffect } from "react";
import { Settings, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "react-hot-toast";

interface Props {
  initialName: string;
  initialDesc: string;
}

export default function SystemSettingsEditor({ initialName, initialDesc }: Props) {
  const { t } = useLanguage();
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState(initialDesc);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(initialName);
    setDesc(initialDesc);
  }, [initialName, initialDesc]);

  const handleSave = async () => {
    if (!name.trim() || !desc.trim()) return;
    setSaving(true);
    const supabase = createClient();
    try {
      await supabase
        .from("system_settings")
        .update({
          system_name: name.trim(),
          system_desc: desc.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const isChanged = name !== initialName || desc !== initialDesc;

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings size={18} className="text-text" />
        <h2 className="font-bold text-lg text-text">{t.adminSystemBranding}</h2>
      </div>

      <p className="text-sm text-text-muted mb-4">{t.adminBrandingDesc}</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-1 block">
            {t.adminSystemName}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-1 block">
            {t.adminDescriptionLabel}
          </label>
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !isChanged}
          className="w-full mt-2 py-2.5 btn-primary text-sm flex justify-center gap-2 disabled:opacity-50"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? t.saving : t.save}
        </button>
      </div>
    </div>
  );
}
