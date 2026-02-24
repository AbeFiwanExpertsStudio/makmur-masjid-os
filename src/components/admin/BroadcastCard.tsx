"use client";
/**
 * BroadcastCard — admin can send, edit, and delete system broadcasts.
 * Receives the list from AdminPage (which fetches + refreshes it).
 */
import { useState } from "react";
import { Send, Loader2, Pencil, Trash2 } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";
import { toast } from "react-hot-toast";

export type BroadcastEntry = {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
};

interface Props {
  broadcasts: BroadcastEntry[];
  onRefresh: () => void;
}

export default function BroadcastCard({ broadcasts, onRefresh }: Props) {
  const { t } = useLanguage();
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [editingBroadcast, setEditingBroadcast] = useState<BroadcastEntry | null>(null);
  const [editMsg, setEditMsg] = useState("");

  const handleSend = async () => {
    if (!broadcastMsg.trim() || isSending) return;
    setIsSending(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("send_broadcast", {
        msg: broadcastMsg.trim(),
      });
      if (error) {
        toast.error(`Broadcast failed: ${error.message}`);
      } else {
        toast.success("Broadcast sent to all users!");
        setBroadcastMsg("");
        onRefresh();
        // Notify the Navbar in the same tab immediately — no WebSocket round-trip needed
        window.dispatchEvent(new CustomEvent("makmur:broadcast-sent"));
      }
    } catch {
      toast.error("Failed to send broadcast.");
    } finally {
      setIsSending(false);
    }
  };

  const handleEdit = async () => {
    if (!editingBroadcast || !editMsg.trim()) return;
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("system_broadcasts")
        .update({ message: editMsg.trim() })
        .eq("id", editingBroadcast.id);
      if (error) {
        toast.error(`Edit failed: ${error.message}`);
      } else {
        toast.success("Broadcast updated!");
        setEditingBroadcast(null);
        setEditMsg("");
        onRefresh();
        window.dispatchEvent(new CustomEvent("makmur:broadcast-sent"));
      }
    } catch {
      toast.error("Failed to edit broadcast.");
    }
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("delete_broadcast", {
        broadcast_id: id,
      });
      if (error) {
        toast.error(`Delete failed: ${error.message}`);
      } else {
        toast.success("Broadcast deleted.");
        onRefresh();
        window.dispatchEvent(new CustomEvent("makmur:broadcast-sent"));
      }
    } catch {
      toast.error("Failed to delete broadcast.");
    }
  };

  return (
    <>
      <div className="card p-6">
        <h2 className="font-bold text-lg text-text mb-2">{t.adminBroadcast}</h2>
        <p className="text-sm text-text-muted mb-4">{t.adminBroadcastDesc}</p>

        <textarea
          value={broadcastMsg}
          onChange={(e) => setBroadcastMsg(e.target.value)}
          placeholder="e.g., Tarawih delayed by 15 mins due to rain..."
          maxLength={200}
          rows={2}
          className="w-full border border-border rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background mb-1"
        />
        <p className="text-xs text-text-muted text-right mb-3">
          {broadcastMsg.length}/200
        </p>
        <button
          onClick={handleSend}
          disabled={!broadcastMsg.trim() || isSending}
          className="w-full py-3 btn-primary text-sm disabled:opacity-50 flex justify-center items-center gap-2 mb-4"
        >
          {isSending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          {isSending ? t.adminSending : t.adminBlastMsg}
        </button>

        {broadcasts.length > 0 && (
          <>
            <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">
              {t.adminRecentBroadcasts}
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {broadcasts.map((b) => (
                <div
                  key={b.id}
                  className={`flex items-start justify-between gap-2 border rounded-xl px-3 py-2.5 group ${
                    b.is_active
                      ? "bg-primary-50/30 border-primary/20 dark:bg-primary/5"
                      : "bg-background border-border opacity-50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {b.is_active ? (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-primary">
                          {t.adminBroadcastActive}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">
                          {t.adminBroadcastArchived}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text line-clamp-2">{b.message}</p>
                    <p className="text-[10px] text-text-muted mt-1">
                      {timeAgo(b.created_at, t)}
                    </p>
                  </div>

                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingBroadcast(b);
                        setEditMsg(b.message);
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-900/30 transition"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 transition"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editingBroadcast && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-broadcast-title"
          onClick={() => setEditingBroadcast(null)}
        >
          <div
            className="bg-surface rounded-2xl w-full max-w-sm p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4 mx-auto">
              <Pencil size={24} />
            </div>
            <h3
              id="edit-broadcast-title"
              className="text-lg font-bold text-text text-center mb-2"
            >
              {t.adminEditBroadcastTitle}
            </h3>
            <p className="text-xs text-text-muted text-center mb-4">
              {t.adminEditBroadcastHint}
            </p>
            <textarea
              value={editMsg}
              onChange={(e) => setEditMsg(e.target.value)}
              className="w-full border border-border rounded-xl p-3 text-sm resize-none h-24 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setEditingBroadcast(null)}
                className="flex-1 py-3 border border-border rounded-xl text-sm font-bold text-text hover:bg-background transition"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleEdit}
                disabled={!editMsg.trim()}
                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md transition disabled:opacity-50"
              >
                {t.adminSaveBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
