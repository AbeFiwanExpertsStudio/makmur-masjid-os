"use client";
/**
 * UserManagementSection — full-width table of all users with
 * ban / unban / promote / demote actions.
 */
import { useState } from "react";
import {
  Users,
  Search,
  Loader2,
  Ban,
  UserCheck,
  ShieldCheck,
  ShieldOff,
  MoreVertical,
} from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "react-hot-toast";

export type UserEntry = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_banned: boolean;
  total_points: number;
};

type ActionType = "ban" | "unban" | "demote" | "promote";

interface Props {
  users: UserEntry[];
  onRefresh: () => void;
  currentUserEmail?: string;
}

export default function UserManagementSection({
  users,
  onRefresh,
  currentUserEmail,
}: Props) {
  const { t } = useLanguage();
  const [userSearch, setUserSearch] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{
    type: ActionType;
    user: UserEntry;
  } | null>(null);
  const [isActioning, setIsActioning] = useState(false);

  const visibleUsers = users
    .filter((u) => u.email)
    .filter((u) => {
      if (!userSearch.trim()) return true;
      const q = userSearch.toLowerCase();
      return (
        u.email.toLowerCase().includes(q) ||
        (u.display_name || "").toLowerCase().includes(q)
      );
    });

  const handleUserAction = async () => {
    if (!actionModal || isActioning) return;

    if (
      (actionModal.type === "ban" || actionModal.type === "demote") &&
      actionModal.user.email === currentUserEmail
    ) {
      toast.error("You cannot ban or demote your own account.");
      setActionModal(null);
      return;
    }

    setIsActioning(true);
    const supabase = createClient();

    const rpcMap: Record<ActionType, string> = {
      ban: "ban_user",
      unban: "unban_user",
      demote: "demote_admin",
      promote: "promote_user_to_admin",
    };

    try {
      const { error } = await supabase.rpc(rpcMap[actionModal.type], {
        target_email: actionModal.user.email,
      });
      if (error) {
        toast.error(`Failed: ${error.message}`);
      } else {
        const msgs: Record<ActionType, string> = {
          ban: `${actionModal.user.email} has been banned.`,
          unban: `${actionModal.user.email} has been unbanned.`,
          demote: `${actionModal.user.email} has been demoted to Volunteer.`,
          promote: `${actionModal.user.email} has been promoted to Admin!`,
        };
        toast.success(msgs[actionModal.type]);
        onRefresh();
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsActioning(false);
      setActionModal(null);
    }
  };

  const actionConfig: Record<
    ActionType,
    {
      icon: typeof Ban;
      color: string;
      btnColor: string;
      title: string;
      desc: (email: string) => string;
      confirm: string;
    }
  > = {
    ban: {
      icon: Ban,
      color: "bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400",
      btnColor:
        "bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500 shadow-md shadow-red-500/20",
      title: t.adminBanTitle,
      desc: (e) => t.adminBanDesc(e),
      confirm: t.adminBanConfirm,
    },
    unban: {
      icon: UserCheck,
      color:
        "bg-emerald-50 text-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-400",
      btnColor:
        "bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-md shadow-emerald-500/20",
      title: t.adminUnbanTitle,
      desc: (e) => t.adminUnbanDesc(e),
      confirm: t.adminUnbanConfirm,
    },
    demote: {
      icon: ShieldOff,
      color:
        "bg-amber-50 text-amber-500 dark:bg-amber-900/30 dark:text-amber-400",
      btnColor:
        "bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 shadow-md shadow-amber-500/20",
      title: t.adminDemoteTitle,
      desc: (e) => t.adminDemoteDesc(e),
      confirm: t.adminDemoteConfirm,
    },
    promote: {
      icon: ShieldCheck,
      color: "bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400",
      btnColor:
        "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-md shadow-blue-500/20",
      title: t.adminPromoteTitle,
      desc: (e) => t.adminPromoteDesc(e),
      confirm: t.adminPromoteConfirm,
    },
  };

  return (
    <>
      <div className="card p-6 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-text" />
            <h2 className="font-bold text-lg text-text">
              {t.adminManageUsers}
            </h2>
            <span className="text-xs text-text-muted bg-surface-muted px-2 py-0.5 rounded-full">
              {visibleUsers.length}
            </span>
          </div>
          <div className="relative w-full sm:w-72">
            <Search
              size={14}
              className="absolute left-3 top-3 text-text-muted"
            />
            <input
              type="text"
              placeholder={t.adminSearchUsers}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-96 space-y-2 pr-1">
          {visibleUsers.map((u) => (
            <div
              key={u.id}
              className={`flex items-center justify-between rounded-xl px-4 py-3 border transition-colors ${
                u.is_banned
                  ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
                  : "bg-background border-border hover:border-primary/30"
              }`}
            >
              <div className="min-w-0 flex-1 mr-3">
                <span className="text-sm font-medium text-text block truncate">
                  {u.display_name || u.email.split("@")[0]}
                </span>
                <span className="text-xs text-text-muted truncate block">
                  {u.email}
                </span>
                {/* pts badge shown inline on mobile to free up right-side space */}
                {(u.total_points ?? 0) > 0 && (
                  <span className="sm:hidden inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 mt-1 rounded-full bg-amber-500 text-white">
                    ⭐ {u.total_points} pts
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                {/* pts badge on desktop only */}
                {(u.total_points ?? 0) > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                    ⭐ {u.total_points} pts
                  </span>
                )}
                <span
                  className={`inline-flex items-center text-[11px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full text-white ${
                    u.is_banned
                      ? "bg-red-600"
                      : u.role === "admin"
                      ? "bg-amber-600"
                      : "bg-emerald-600"
                  }`}
                >
                  {u.is_banned ? t.adminBanned : u.role}
                </span>

                {/* Mobile: three-dot dropdown */}
                <div className="relative sm:hidden">
                  <button
                    onClick={() =>
                      setOpenDropdownId(
                        openDropdownId === u.id ? null : u.id
                      )
                    }
                    className="p-1.5 rounded-full hover:bg-surface-muted transition active:scale-95"
                    aria-label="User actions"
                  >
                    <MoreVertical size={16} className="text-text-muted" />
                  </button>
                  {openDropdownId === u.id && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpenDropdownId(null)}
                      />
                      <div className="absolute right-0 top-9 z-50 bg-surface border border-border rounded-xl shadow-xl py-1.5 min-w-[150px]">
                        {u.is_banned ? (
                          <button
                            onClick={() => {
                              setActionModal({ type: "unban", user: u });
                              setOpenDropdownId(null);
                            }}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-surface-muted transition-colors"
                          >
                            <UserCheck size={14} /> {t.adminUnban}
                          </button>
                        ) : (
                          <>
                            {u.role === "volunteer" && (
                              <button
                                onClick={() => {
                                  setActionModal({ type: "promote", user: u });
                                  setOpenDropdownId(null);
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-surface-muted transition-colors"
                              >
                                <ShieldCheck size={14} /> {t.adminPromote}
                              </button>
                            )}
                            {u.role === "admin" && (
                              <button
                                onClick={() => {
                                  setActionModal({ type: "demote", user: u });
                                  setOpenDropdownId(null);
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:bg-surface-muted transition-colors"
                              >
                                <ShieldOff size={14} /> {t.adminDemote}
                              </button>
                            )}
                            <div className="h-px bg-border mx-3 my-1" />
                            <button
                              onClick={() => {
                                setActionModal({ type: "ban", user: u });
                                setOpenDropdownId(null);
                              }}
                              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-surface-muted transition-colors"
                            >
                              <Ban size={14} /> {t.adminBan}
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Desktop: inline action buttons */}
                {u.is_banned ? (
                  <button
                    onClick={() => setActionModal({ type: "unban", user: u })}
                    className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white transition-all shadow-sm hover:shadow active:scale-95"
                  >
                    <UserCheck size={11} /> {t.adminUnban}
                  </button>
                ) : (
                  <>
                    {u.role === "volunteer" && (
                      <button
                        onClick={() =>
                          setActionModal({ type: "promote", user: u })
                        }
                        className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white transition-all shadow-sm hover:shadow active:scale-95"
                      >
                        <ShieldCheck size={11} /> {t.adminPromote}
                      </button>
                    )}
                    {u.role === "admin" && (
                      <button
                        onClick={() =>
                          setActionModal({ type: "demote", user: u })
                        }
                        className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white transition-all shadow-sm hover:shadow active:scale-95"
                      >
                        <ShieldOff size={11} /> {t.adminDemote}
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setActionModal({ type: "ban", user: u })
                      }
                      className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white transition-all shadow-sm hover:shadow active:scale-95"
                    >
                      <Ban size={11} /> {t.adminBan}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {visibleUsers.length === 0 && (
            <p className="text-sm text-text-muted text-center py-8">
              {userSearch ? t.adminNoUsersSearch : t.adminNoUsers}
            </p>
          )}
        </div>
      </div>

      {/* Action Confirmation Modal */}
      {actionModal &&
        (() => {
          const config = actionConfig[actionModal.type];
          const Icon = config.icon;
          return (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="action-modal-title"
              onClick={() => setActionModal(null)}
            >
              <div
                className="bg-surface rounded-2xl w-full max-w-sm p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto ${config.color}`}
                >
                  <Icon size={24} />
                </div>
                <h3
                  id="action-modal-title"
                  className="text-lg font-bold text-text text-center mb-2"
                >
                  {config.title}
                </h3>
                <p className="text-sm text-text-muted text-center mb-6">
                  {config.desc(actionModal.user.email)}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setActionModal(null)}
                    className="flex-1 py-3 border border-border rounded-xl text-sm font-bold text-text hover:bg-surface-alt dark:hover:bg-surface-muted transition"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleUserAction}
                    disabled={isActioning}
                    className={`flex-1 py-3 text-white rounded-xl text-sm font-bold transition-all flex justify-center items-center ${config.btnColor}`}
                  >
                    {isActioning ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      config.confirm
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </>
  );
}
