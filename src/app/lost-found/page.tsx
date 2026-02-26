"use client";

import { useAuth } from "@/components/providers/AuthContext";
import { useLanguage } from "@/components/providers/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import React, { useEffect, useState, useCallback } from "react";
import {
  Search, Plus, X, Loader2, AlertTriangle, LogIn,
  PackageSearch, CheckCircle2, Trash2,
  MapPin, Phone, Tag, Clock, Pencil,
  Camera, ImagePlus, XCircle,
} from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { toast } from "react-hot-toast";
import type { LostFoundItem, LostFoundType, LostFoundStatus } from "@/types/database";

/* ── Category config ── */
const CATEGORIES = [
  { value: "shoes", icon: "👟" },
  { value: "bag", icon: "🎒" },
  { value: "phone", icon: "📱" },
  { value: "wallet", icon: "👛" },
  { value: "clothing", icon: "👕" },
  { value: "keys", icon: "🔑" },
  { value: "other", icon: "📦" },
] as const;

function categoryLabel(value: string, t: any) {
  const map: Record<string, string> = {
    shoes: t.lfCategoryShoes,
    bag: t.lfCategoryBag,
    phone: t.lfCategoryPhone,
    wallet: t.lfCategoryWallet,
    clothing: t.lfCategoryClothing,
    keys: t.lfCategoryKeys,
    other: t.lfCategoryOther,
  };
  return map[value] ?? value;
}

function categoryIcon(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.icon ?? "📦";
}

function timeAgo(dateStr: string, t: any): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t.justNow;
  if (mins < 60) return t.minAgo(mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t.hrsAgo(hrs);
  const days = Math.floor(hrs / 24);
  return days === 1 ? t.yesterday : t.daysAgo(days);
}

/* ═══════════════════════════════════════════════════════════ */
/*  Main Page                                                  */
/* ═══════════════════════════════════════════════════════════ */
export default function LostFoundPage() {
  const { user, isAnonymous, isAdmin, setShowLoginModal } = useAuth();
  const { t, language } = useLanguage();

  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<"all" | LostFoundType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showPostModal, setShowPostModal] = useState(false);
  const [editingItem, setEditingItem] = useState<LostFoundItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<LostFoundItem | null>(null);
  const [claimingItem, setClaimingItem] = useState<LostFoundItem | null>(null);
  const [postType, setPostType] = useState<LostFoundType>("lost");

  // Pagination
  const ITEMS_PER_PAGE = 6;
  const [page, setPage] = useState(1);

  /* ── Fetch ── */
  const fetchItems = useCallback(async () => {
    try {
      const supabase = createClient();
      const since60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("lost_found_items")
        .select("*")
        // Always show open/unclaimed items; show resolved/claimed only within 60 days
        .or(`status.eq.open,status.eq.unclaimed,created_at.gte.${since60}`)
        .order("created_at", { ascending: false });

      if (error) {
        setFetchError(error.message);
        setItems([]);
      } else {
        setFetchError(null);
        setItems((data as LostFoundItem[]) ?? []);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    const supabase = createClient();
    const channel = supabase
      .channel("lost-found-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "lost_found_items" }, () => fetchItems())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchItems]);

  /* ── Filter logic ── */
  const filtered = items.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (statusFilter === "open" && item.status !== "open") return false;
    if (statusFilter === "resolved" && item.status !== "resolved") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.title.toLowerCase().includes(q) ||
        (item.description ?? "").toLowerCase().includes(q) ||
        (item.location_found ?? "").toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  /* ── Mark resolved ── */
  const handleResolve = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("lost_found_items")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t.lfMarkedResolved);
      fetchItems();
    }
  };

  /* ── Mark Claimed ── */
  const handleClaim = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("lost_found_items")
      .update({ status: "claimed" })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t.lfMarkedClaimed);
      setClaimingItem(null);
      fetchItems();
    }
  };

  /* ── Delete ── */
  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("lost_found_items").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t.lfPostDeleted);
      setDeletingItem(null);
      fetchItems();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="text-primary"><PackageSearch size={28} strokeWidth={2.5} /></div>
          <div>
            <h1 className="text-2xl font-bold text-text">{t.lfTitle}</h1>
            <p className="text-sm text-text-muted">{t.lfSubtitle}</p>
          </div>
        </div>
        {!isAnonymous && user && (
          <button
            onClick={() => { setEditingItem(null); setPostType("lost"); setShowPostModal(true); }}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <Plus size={16} /> {t.lfPostItem}
          </button>
        )}
      </div>

      {/* Login notice */}
      {isAnonymous && (
        <div className="card p-4 mb-6 flex items-center gap-3 border-l-4 border-l-primary">
          <div className="text-primary"><LogIn size={24} strokeWidth={2.5} /></div>
          <p className="text-sm text-text-secondary">{t.lfLoginNotice}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Type filter pills */}
        <div className="flex gap-1.5 p-1 bg-surface-alt rounded-xl border border-border/60">
          {(["all", "lost", "found"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setTypeFilter(f); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                typeFilter === f
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-muted hover:text-text hover:bg-surface"
              }`}
            >
              {f === "all" ? t.lfAll : f === "lost" ? t.lfLost : t.lfFound}
            </button>
          ))}
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1.5 p-1 bg-surface-alt rounded-xl border border-border/60">
          {(["all", "open", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setStatusFilter(f); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === f
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-muted hover:text-text hover:bg-surface"
              }`}
            >
              {f === "all" ? t.lfAll : f === "open" ? t.lfOpen : t.lfResolved}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder={t.lfSearchPlaceholder}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 gap-3 text-text-muted">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">{t.loading}</span>
        </div>
      )}

      {/* Error */}
      {!loading && fetchError && (
        <div className="card p-8 text-center">
          <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="font-semibold text-text mb-1">{t.loadFailed}</p>
          <p className="text-sm text-text-muted mb-4">{fetchError}</p>
          <button onClick={fetchItems} className="px-5 py-2 btn-primary text-sm">{t.retry}</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !fetchError && filtered.length === 0 && (
        <div className="card p-8 text-center">
          <PackageSearch size={40} className="text-text-muted mx-auto mb-3 opacity-40" />
          <p className="font-semibold text-text mb-1">
            {searchQuery || typeFilter !== "all" || statusFilter !== "all" ? t.lfNoItemsFilter : t.lfNoItems}
          </p>
        </div>
      )}

      {/* Item cards */}
      <div className="space-y-3">
        {paginated.map((item) => {
          const isOwner = user?.id === item.posted_by;
          const canManage = isOwner || isAdmin;

          return (
            <div
              key={item.id}
              className={`card p-4 transition-all ${
                item.status !== "open" ? "opacity-60" : ""
              }`}
            >
              <div className="flex gap-3">
                {/* Category icon */}
                <div className="w-12 h-12 rounded-xl bg-surface-alt flex items-center justify-center text-2xl shrink-0 border border-border/40">
                  {categoryIcon(item.category)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-text text-sm leading-tight">{item.title}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {/* Type badge */}
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          item.type === "lost"
                            ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                        }`}>
                          {item.type === "lost" ? t.lfLost : t.lfFound}
                        </span>
                        {/* Category badge */}
                        <span className="text-[10px] font-medium text-text-muted bg-surface-alt px-2 py-0.5 rounded-full border border-border/40">
                          <Tag size={9} className="inline mr-0.5 -mt-px" />
                          {categoryLabel(item.category, t)}
                        </span>
                        {/* Status badge */}
                        {item.status === "claimed" && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                            <CheckCircle2 size={9} className="inline mr-0.5 -mt-px" />
                            {t.lfClaimed}
                          </span>
                        )}
                        {item.status === "resolved" && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            <CheckCircle2 size={9} className="inline mr-0.5 -mt-px" />
                            {t.lfResolved}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {item.description && (
                    <p className="text-xs text-text-secondary mt-2 line-clamp-2">{item.description}</p>
                  )}

                  {/* Image */}
                  {item.image_url && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-border/40 max-w-[200px]">
                      <img src={item.image_url} alt={item.title} className="w-full h-28 object-cover" />
                    </div>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center gap-3 mt-2 flex-wrap text-[11px] text-text-muted">
                    {item.location_found && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} /> {item.location_found}
                      </span>
                    )}
                    {item.contact_info && (
                      <span className="flex items-center gap-1">
                        <Phone size={11} /> {item.contact_info}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {t.lfPostedAgo(timeAgo(item.created_at, t))}
                    </span>
                  </div>

                  {/* Actions */}
                  {canManage && (
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {/* Mark Claimed — open items only */}
                      {item.status === "open" && (
                        <button
                          onClick={() => setClaimingItem(item)}
                          className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        >
                          <CheckCircle2 size={13} /> {t.lfMarkClaimed}
                        </button>
                      )}
                      {/* Mark Resolved — open or claimed */}
                      {(item.status === "open" || item.status === "claimed") && (
                        <button
                          onClick={() => handleResolve(item.id)}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        >
                          <CheckCircle2 size={13} /> {t.lfMarkResolved}
                        </button>
                      )}
                      {/* Edit — open items, owner only */}
                      {item.status === "open" && isOwner && (
                        <button
                          onClick={() => { setEditingItem(item); setPostType(item.type); setShowPostModal(true); }}
                          className="text-xs font-semibold text-primary hover:text-primary-dark flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-primary-50 transition-colors"
                        >
                          <Pencil size={13} /> {t.edit}
                        </button>
                      )}
                      {/* Delete — always available to owner / admin */}
                      <button
                        onClick={() => setDeletingItem(item)}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 size={13} /> {t.delete}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <Pagination page={page} total={filtered.length} perPage={ITEMS_PER_PAGE} onChange={setPage} />

      {/* ── Post / Edit Modal ── */}
      {showPostModal && (
        <PostModal
          item={editingItem}
          defaultType={postType}
          onClose={() => { setShowPostModal(false); setEditingItem(null); }}
          onSaved={() => { setShowPostModal(false); setEditingItem(null); fetchItems(); }}
          t={t}
          language={language}
          userId={user?.id ?? ""}
        />
      )}

      {/* ── Claim Confirm Modal ── */}
      {claimingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl shadow-xl max-w-sm w-full p-6 border border-border/60">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={24} className="text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-text text-center mb-2">{t.lfMarkClaimed}</h3>
            <p className="text-sm text-text-secondary text-center mb-1">{t.lfClaimedConfirm}</p>
            <p className="text-sm font-semibold text-text text-center mb-6">"{claimingItem.title}"</p>
            <div className="flex gap-3">
              <button onClick={() => setClaimingItem(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-alt transition-colors">
                {t.cancel}
              </button>
              <button onClick={() => handleClaim(claimingItem.id)} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors shadow-md">
                {t.lfMarkClaimed}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl shadow-xl max-w-sm w-full p-6 border border-border/60">
            <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-text text-center mb-2">{t.lfDeletePost}</h3>
            <p className="text-sm text-text-secondary text-center mb-1">{t.lfDeleteConfirm}</p>
            <p className="text-sm font-semibold text-text text-center mb-6">"{deletingItem.title}"</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingItem(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-alt transition-colors">
                {t.cancel}
              </button>
              <button onClick={() => handleDelete(deletingItem.id)} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors shadow-md">
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  Post / Edit Modal                                          */
/* ═══════════════════════════════════════════════════════════ */
function PostModal({
  item,
  defaultType,
  onClose,
  onSaved,
  t,
  language,
  userId,
}: {
  item: LostFoundItem | null;
  defaultType: LostFoundType;
  onClose: () => void;
  onSaved: () => void;
  t: any;
  language: string;
  userId: string;
}) {
  const isEdit = !!item;
  const [type, setType] = useState<LostFoundType>(item?.type ?? defaultType);
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [category, setCategory] = useState(item?.category ?? "other");
  const [locationFound, setLocationFound] = useState(item?.location_found ?? "");
  const [contactInfo, setContactInfo] = useState(item?.contact_info ?? "");
  const [saving, setSaving] = useState(false);

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(item?.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t.lfImgTooBig);
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    // Reset the input so the same file can be reselected
    e.target.value = "";
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const supabase = createClient();

    // Upload image if a new file was selected
    let imageUrl: string | null = item?.image_url ?? null;
    if (imageFile) {
      setUploading(true);
      const ext = imageFile.name.split(".").pop() ?? "jpg";
      const fileName = `${userId}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("lost-found")
        .upload(fileName, imageFile, { upsert: true });
      setUploading(false);
      if (uploadError) {
        toast.error(uploadError.message);
        setSaving(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("lost-found").getPublicUrl(uploadData.path);
      imageUrl = publicUrl;
    } else if (imagePreview === null) {
      // User cleared a previously existing image
      imageUrl = null;
    }

    const payload = {
      type,
      title: title.trim(),
      description: description.trim() || null,
      category,
      location_found: locationFound.trim() || null,
      contact_info: contactInfo.trim() || null,
      image_url: imageUrl,
      ...(isEdit ? {} : { posted_by: userId }),
    };

    const { error } = isEdit
      ? await supabase.from("lost_found_items").update(payload).eq("id", item!.id)
      : await supabase.from("lost_found_items").insert(payload);

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    toast.success(
      isEdit ? t.lfPostUpdated : t.lfPostSubmitted
    );
    onSaved();
  };

  const isBusy = saving || uploading;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto border border-border/60">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/60 sticky top-0 bg-surface z-10 rounded-t-2xl">
          <h3 className="text-lg font-bold text-text">
            {isEdit ? t.lfEditPost : type === "lost" ? t.lfReportLost : t.lfReportFound}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-alt rounded-xl transition-colors">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Type toggle */}
          {!isEdit && (
            <div className="flex gap-2 p-1 bg-surface-alt rounded-xl border border-border/60">
              <button
                onClick={() => setType("lost")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  type === "lost" ? "bg-red-500 text-white shadow-sm" : "text-text-muted hover:text-text"
                }`}
              >
                {t.lfLost}
              </button>
              <button
                onClick={() => setType("found")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  type === "found" ? "bg-emerald-500 text-white shadow-sm" : "text-text-muted hover:text-text"
                }`}
              >
                {t.lfFound}
              </button>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.lfItemTitle}</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={t.lfItemPlaceholder}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.lfCategory}</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition-all ${
                    category === cat.value
                      ? "border-primary bg-primary-50 text-primary dark:bg-primary/10"
                      : "border-border/40 text-text-muted hover:bg-surface-alt"
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span>{categoryLabel(cat.value, t)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Photo capture / upload ── */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              {t.lfImageUpload}
            </label>

            {/* Contextual hint */}
            <p className={`text-xs px-3 py-2 rounded-lg mb-2 ${
              type === "found"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
            }`}>
              {type === "found" ? t.lfImageHintFound : t.lfImageHintLost}
            </p>

            {imagePreview ? (
              /* Preview */
              <div className="relative rounded-xl overflow-hidden border border-border/40">
                <img src={imagePreview} alt="preview" className="w-full h-44 object-cover" />
                <button
                  onClick={clearImage}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                >
                  <XCircle size={18} />
                </button>
                {uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 size={24} className="text-white animate-spin" />
                  </div>
                )}
              </div>
            ) : (
              /* Upload buttons */
              <div className="grid grid-cols-2 gap-2">
                {/* Camera — opens device camera on mobile */}
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/50 hover:bg-surface-alt transition-all text-text-muted hover:text-primary"
                >
                  <Camera size={22} />
                  <span className="text-xs font-medium">
                    {t.lfTakePhoto}
                  </span>
                </button>

                {/* Gallery */}
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/50 hover:bg-surface-alt transition-all text-text-muted hover:text-primary"
                >
                  <ImagePlus size={22} />
                  <span className="text-xs font-medium">
                    {t.lfChoosePhoto}
                  </span>
                </button>
              </div>
            )}

            {/* Hidden inputs */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              {type === "found" ? t.lfLocationFound : t.lfLocationLost}
            </label>
            <input
              type="text" value={locationFound} onChange={(e) => setLocationFound(e.target.value)}
              placeholder={
                type === "found"
                  ? t.lfLocationFoundPlaceholder
                  : t.lfLocationLostPlaceholder
              }
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.lfDescription}</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder={t.lfDescriptionPlaceholder}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* Contact */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.lfContact}</label>
            <input
              type="text" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)}
              placeholder={t.lfContactPlaceholder}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSave}
            disabled={!title.trim() || isBusy}
            className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <><Loader2 size={16} className="animate-spin" /> {t.lfUploadingPhoto}</>
            ) : saving ? (
              <><Loader2 size={16} className="animate-spin" /> {t.saving}</>
            ) : (
              isEdit ? t.save : t.lfPostItem
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

