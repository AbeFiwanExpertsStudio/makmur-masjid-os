"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft, Loader2, ChevronDown, ChevronRight, CheckCircle, Clock, Users, X } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/utils";
import Link from "next/link";
import { toast } from "react-hot-toast";

type GigRow = {
  id: string;
  title: string;
  description: string;
  gig_date: string;
  start_time: string;
  end_time: string;
  is_completed: boolean;
  is_cancelled: boolean;
  participant_count?: number;
};

type ParticipantRow = {
  id: string;
  status: string; // 'joined', 'completed', 'cancelled'
  user_id: string;
  profiles: {
    full_name: string;
  };
};

export default function AdminGigsHistoryPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  
  const [gigs, setGigs] = useState<GigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [gigsPage, setGigsPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const GIGS_PER_PAGE = 10;
  
  const [expandedGigId, setExpandedGigId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Record<string, ParticipantRow[]>>({});
  const [loadingParticipants, setLoadingParticipants] = useState<Record<string, boolean>>({});

  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsAdmin(false);
        router.replace("/");
        return;
      }

      // Quick admin check verifying user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (roleError || roleData?.role !== "admin") {
        setIsAdmin(false);
        router.replace("/");
        return;
      }

      setIsAdmin(true);
      fetchGigs();
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function fetchGigs() {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("volunteer_gigs")
      .select("id, title, description, gig_date, start_time, end_time, is_completed, is_cancelled, gig_claims(count)")
      .order("gig_date", { ascending: false })
      .order("start_time", { ascending: false });

    if (error) {
      toast.error("Failed to load gigs history.");
      console.error(error);
    } else {
      const mapped = (data || []).map((row: any) => ({
        ...row,
        participant_count: row.gig_claims?.[0]?.count ?? 0
      }));
      setGigs(mapped);
    }
    setLoading(false);
  }

  async function toggleExpandGig(gigId: string) {
    if (expandedGigId === gigId) {
      setExpandedGigId(null);
      return;
    }
    setExpandedGigId(gigId);

    // If already fetched, don't refetch
    if (participants[gigId]) return;

    setLoadingParticipants(prev => ({ ...prev, [gigId]: true }));
    const supabase = createClient();
    
    // 1. Fetch claims first using guest_uuid (user_id caused the 400 error)
    const { data: claimsData, error: claimsError } = await supabase
      .from("gig_claims")
      .select("id, guest_uuid")
      .eq("gig_id", gigId);

    if (claimsError) {
      toast.error("Failed to load participants.");
      console.error(claimsError);
      setLoadingParticipants(prev => ({ ...prev, [gigId]: false }));
      return;
    }

    // 2. Extract UUIDs and fetch profiles manually to bypass complex Supabase auth JOIN errors
    let merged: ParticipantRow[] = [];
    if (!claimsData || claimsData.length === 0) {
      setParticipants(prev => ({ ...prev, [gigId]: [] }));
      setLoadingParticipants(prev => ({ ...prev, [gigId]: false }));
      return;
    }

    const uuids = claimsData.map(c => c.guest_uuid).filter(Boolean);
    let profilesMap: Record<string, { display_name: string }> = {};

    if (uuids.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", uuids);

      if (profiles) {
        profiles.forEach(p => { profilesMap[p.id] = p; });
      }
    }

    const targetGig = gigs.find(g => g.id === gigId);
    const computedStatus = targetGig?.is_completed ? 'completed' : 'joined';

    claimsData.forEach(claim => {
      const pName = profilesMap[claim.guest_uuid]?.display_name || "Unknown User";
      merged.push({
        id: claim.id,
        user_id: claim.guest_uuid,
        status: computedStatus,
        profiles: { full_name: pName } // keeping this as full_name for the frontend typing logic
      });
    });

    setParticipants(prev => ({ ...prev, [gigId]: merged }));
    setLoadingParticipants(prev => ({ ...prev, [gigId]: false }));
  }

  const handleExportCSV = (gigId: string, gigTitle: string) => {
    const list = participants[gigId];
    if (!list || list.length === 0) {
      toast.error("No participants to export");
      return;
    }

    // Prepare CSV data
    const headers = ["Volunteer Name", "Status"];
    const rows = list.map(p => [
      `"${p.profiles?.full_name || 'Anonymous User'}"`,
      `"${p.status}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Trigger download
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Gig_Roster_${gigTitle.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (isAdmin === false) return null; // router redirecting

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin" className="p-2 bg-surface border border-border rounded-full hover:bg-background transition-colors text-text-secondary">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Shield size={22} className="text-primary" /> Gig History
          </h1>
          <p className="text-sm text-text-muted">Review past volunteer gigs and track participant completions.</p>
        </div>
      </div>

      <div className="card p-6 min-h-[50vh] flex flex-col">
        <div className="mb-6 flex flex-col md:flex-row gap-3">
          <input
            type="text"
            placeholder="Search gigs by title..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setGigsPage(1); // Reset pagination on search
            }}
            className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
          />
          <div className="flex gap-2">
            <select
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                setGigsPage(1);
              }}
              className="bg-background border border-border rounded-xl px-4 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
            >
              <option value="all">All Years</option>
              {Array.from(new Set(gigs.filter(g => g.gig_date).map(g => g.gig_date!.split('-')[0]))).sort().reverse().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setGigsPage(1);
              }}
              className="bg-background border border-border rounded-xl px-4 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary opacity-50" size={32} />
          </div>
        ) : gigs.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <Users size={32} className="mx-auto mb-3 opacity-30" />
            <p>No volunteer gigs have been created yet.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 flex-1">
              {(() => {
                let filteredGigs = gigs.filter(g => g.title.toLowerCase().includes(searchQuery.toLowerCase()));
                
                if (filterYear !== "all") {
                  filteredGigs = filteredGigs.filter(g => g.gig_date && g.gig_date.startsWith(filterYear));
                }
                
                if (filterStatus !== "all") {
                  const now = new Date();
                  if (filterStatus === "cancelled") {
                    filteredGigs = filteredGigs.filter(g => {
                      const gigEnd = new Date(`${g.gig_date}T${g.end_time}`);
                      const isGhost = !g.is_completed && gigEnd < now && (g.participant_count ?? 0) === 0;
                      return g.is_cancelled || isGhost;
                    });
                  } else {
                    const isCompleted = filterStatus === "completed";
                    filteredGigs = filteredGigs.filter(g => {
                      const gigEnd = new Date(`${g.gig_date}T${g.end_time}`);
                      const isGhost = !g.is_completed && gigEnd < now && (g.participant_count ?? 0) === 0;
                      if (isGhost || g.is_cancelled) return false;
                      return g.is_completed === isCompleted;
                    });
                  }
                }

                if (filteredGigs.length === 0 && (searchQuery || filterYear !== "all" || filterStatus !== "all")) {
                  return (
                    <div className="text-center py-12 text-text-muted">
                      <p>No gigs found matching your filters.</p>
                    </div>
                  );
                }

                return filteredGigs
                  .slice((gigsPage - 1) * GIGS_PER_PAGE, gigsPage * GIGS_PER_PAGE)
                  .map(gig => (
                    <div key={gig.id} className="border border-border rounded-xl overflow-hidden bg-surface">
                      {/* Header / Clickable row */}
                      <button
                        onClick={() => toggleExpandGig(gig.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-background transition-colors text-left"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`font-bold text-lg ${gig.is_completed ? "text-text" : "text-text"}`}>
                              {gig.title}
                            </h3>
                            {(() => {
                              const now = new Date();
                              const gigEnd = new Date(`${gig.gig_date}T${gig.end_time}`);
                              const isActuallyCancelled = gig.is_cancelled || (!gig.is_completed && gigEnd < now && (gig.participant_count ?? 0) === 0);
                              
                              if (isActuallyCancelled) {
                                return (
                                  <span className="badge badge-cancelled text-[10px] px-2 py-0.5 whitespace-nowrap font-bold flex items-center gap-1">
                                    <X size={10} /> Cancelled
                                  </span>
                                );
                              } else if (gig.is_completed) {
                                return (
                                  <span className="badge bg-primary-50 text-primary text-[10px] px-1.5 py-0.5 whitespace-nowrap">
                                    <CheckCircle size={10} className="inline mr-1" /> Awarded
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-text-muted">
                            <span className="flex items-center gap-1">
                              <Clock size={14} /> 
                              {new Date(gig.gig_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {' · '}
                              {formatTime(gig.start_time)} - {formatTime(gig.end_time)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-center p-2 text-text-muted">
                          {expandedGigId === gig.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </div>
                      </button>

                      {/* Expanded Ledger */}
                      {expandedGigId === gig.id && (
                        <div className="border-t border-border bg-background/50 p-4">
                          {loadingParticipants[gig.id] ? (
                            <div className="flex justify-center py-6">
                              <Loader2 className="animate-spin text-primary opacity-50" size={24} />
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-sm text-text-secondary flex items-center gap-2">
                                  <Users size={16} /> Participant Roster
                                </h4>
                                {participants[gig.id] && participants[gig.id].length > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExportCSV(gig.id, gig.title);
                                    }}
                                    className="text-xs font-semibold text-primary hover:text-primary-dark border border-primary/20 bg-primary/5 hover:bg-primary/10 px-2 py-1 rounded-md transition"
                                  >
                                    Export CSV
                                  </button>
                                )}
                              </div>
                              
                              {(!participants[gig.id] || participants[gig.id].length === 0) ? (
                                <div className="text-sm text-text-muted py-2 px-3 bg-surface border border-border/50 rounded-lg italic text-center">
                                  No one signed up for this gig.
                                </div>
                              ) : (
                                <div className="overflow-hidden rounded-lg border border-border bg-surface">
                                  <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-background text-text-muted uppercase text-[10px] font-bold tracking-wider">
                                      <tr>
                                        <th className="px-4 py-3">Volunteer Name</th>
                                        <th className="px-4 py-3 text-right">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {participants[gig.id].map(p => (
                                        <tr key={p.id} className="hover:bg-background/80 transition-colors">
                                          <td className="px-4 py-3 font-medium text-text">
                                            {p.profiles?.full_name || "Unknown User"}
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                            {p.status === 'completed' ? (
                                              <span className="text-green-600 font-semibold bg-green-50 px-2 py-1 rounded-md text-xs">
                                                Attended
                                              </span>
                                            ) : p.status === 'joined' ? (
                                              <span className="text-amber-600 font-semibold bg-amber-50 px-2 py-1 rounded-md text-xs">
                                                Pending
                                              </span>
                                            ) : (
                                              <span className="text-red-500 font-semibold bg-red-50 px-2 py-1 rounded-md text-xs">
                                                Cancelled
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              
                              {gig.description && (
                                <div className="mt-4 pt-4 border-t border-border/50">
                                  <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Gig Description</h4>
                                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{gig.description}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
              })()}
            </div>
            
            {/* Pagination Controls */}
            {(() => {
              let filteredGigs = gigs.filter(g => g.title.toLowerCase().includes(searchQuery.toLowerCase()));
              if (filterYear !== "all") filteredGigs = filteredGigs.filter(g => g.gig_date && g.gig_date.startsWith(filterYear));
              if (filterStatus !== "all") {
                const isCompleted = filterStatus === "completed";
                filteredGigs = filteredGigs.filter(g => g.is_completed === isCompleted);
              }

              if (filteredGigs.length <= GIGS_PER_PAGE) return null;
              
              return (
                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-sm">
                  <span className="text-text-muted">
                    Showing {(gigsPage - 1) * GIGS_PER_PAGE + 1} - {Math.min(gigsPage * GIGS_PER_PAGE, filteredGigs.length)} of {filteredGigs.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setGigsPage(p => Math.max(1, p - 1))}
                      disabled={gigsPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-border bg-surface text-text-secondary disabled:opacity-50 hover:bg-background transition"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setGigsPage(p => Math.min(Math.ceil(filteredGigs.length / GIGS_PER_PAGE), p + 1))}
                      disabled={gigsPage >= Math.ceil(filteredGigs.length / GIGS_PER_PAGE)}
                      className="px-3 py-1.5 rounded-lg border border-border bg-surface text-text-secondary disabled:opacity-50 hover:bg-background transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
