import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Client } from "appwrite";
import { useAuth } from "../context/AuthContext";
import { databases, storage, DATABASE_ID, COLLECTION_USERS, COLLECTION_POLLS, COLLECTION_VOTES, COLLECTION_VOTE_LOG, BUCKET_PHOTOS, ID, Query, getPhotoUrl } from "../appwrite";
import { seedUsers } from "../seed";
import { validatePollCreate, validatePhotoUpload, sanitizeText } from "../utils/validate";
import { pollCreateLimiter, uploadLimiter, formatCooldown } from "../utils/rateLimit";
import { hashPassword, hashUserId } from "../utils/crypto";
import { getUserGroup } from "../utils/groups";
import Logo from "./Logo";

function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("polls");
  const [canSeed, setCanSeed] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedDone, setSeedDone] = useState(false);

  const [pollMode, setPollMode] = useState(null);
  const [pollTitle, setPollTitle] = useState("");
  const [pollDesc, setPollDesc] = useState("");
  const [candidates, setCandidates] = useState([{ name: "", roll: "", photoUrl: "" }]);
  const [decisions, setDecisions] = useState([{ text: "" }]);
  const [visibleCount, setVisibleCount] = useState(1);
  const [createError, setCreateError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(null);
  const [allowedGroups, setAllowedGroups] = useState(["C", "D"]);

  const [polls, setPolls] = useState([]);
  const [users, setUsers] = useState([]);
  const [voteLogs, setVoteLogs] = useState([]);
  const [userHashMap, setUserHashMap] = useState({});

  useEffect(() => {
    const buildHashMap = async () => {
      const map = {};
      for (const u of users) {
        map[u.id] = await hashUserId(u.id);
      }
      setUserHashMap(map);
    };
    if (users.length > 0) buildHashMap();
  }, [users]);

  useEffect(() => {
    const checkSeed = async () => {
      try {
        const result = await databases.listDocuments(DATABASE_ID, COLLECTION_USERS);
        setCanSeed(result.total === 0);
      } catch (e) {
        setCanSeed(true);
      }
    };
    checkSeed();
  }, []);

  const loadAll = async () => {
    try {
      const p = await databases.listDocuments(DATABASE_ID, COLLECTION_POLLS);
      setPolls(p.documents.map((d) => ({ id: d.$id, ...d })));
    } catch (e) {}

    try {
      const u = await databases.listDocuments(DATABASE_ID, COLLECTION_USERS);
      setUsers(u.documents.map((d) => ({ id: d.userId, ...d })));
    } catch (e) {}

    try {
      const v = await databases.listDocuments(DATABASE_ID, COLLECTION_VOTE_LOG);
      setVoteLogs(
        v.documents
          .map((d) => ({ id: d.$id, ...d }))
          .sort((a, b) => {
            const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return tb - ta;
          })
      );
    } catch (e) {}
  };

  useEffect(() => {
    loadAll();

    let unsub1, unsub2, unsub3;
    try {
      const client = new Client()
        .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
        .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

      unsub1 = client.subscribe(
        `databases.${DATABASE_ID}.collections.${COLLECTION_POLLS}.documents`,
        () => { try { loadAll(); } catch { /* ignore */ } }
      );
      unsub2 = client.subscribe(
        `databases.${DATABASE_ID}.collections.${COLLECTION_USERS}.documents`,
        () => { try { loadAll(); } catch { /* ignore */ } }
      );
      unsub3 = client.subscribe(
        `databases.${DATABASE_ID}.collections.${COLLECTION_VOTE_LOG}.documents`,
        () => { try { loadAll(); } catch { /* ignore */ } }
      );
    } catch {
      // Realtime unavailable — data refreshes on manual actions
    }

    return () => {
      if (typeof unsub1 === "function") unsub1();
      if (typeof unsub2 === "function") unsub2();
      if (typeof unsub3 === "function") unsub3();
    };
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedUsers();
      setSeedDone(true);
      setCanSeed(false);
      loadAll();
    } catch (err) {
      console.error("Seed failed:", err);
    } finally {
      setSeeding(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const addCandidateRow = () => setCandidates([...candidates, { name: "", roll: "", photoUrl: "" }]);
  const removeCandidateRow = (index) => {
    if (candidates.length > 1) setCandidates(candidates.filter((_, i) => i !== index));
  };
  const updateCandidate = (index, field, value) => {
    const updated = [...candidates];
    updated[index][field] = value;
    setCandidates(updated);
  };

  const handlePhotoUpload = async (index, file) => {
    // Rate limit check
    const rateCheck = uploadLimiter.check("upload");
    if (!rateCheck.allowed) {
      setCreateError(`Too many uploads. Try again in ${formatCooldown(rateCheck.retryAfterMs)}.`);
      return;
    }

    // Input validation (type, size)
    const result = validatePhotoUpload(file);
    if (!result.valid) {
      setCreateError(result.error);
      return;
    }

    setUploadingPhoto(index);
    setCreateError("");
    try {
      const uploaded = await storage.createFile(BUCKET_PHOTOS, ID.unique(), file);
      uploadLimiter.reset("upload");
      updateCandidate(index, "photoUrl", uploaded.$id);
    } catch (err) {
      uploadLimiter.recordFailure("upload");
      console.error("Photo upload failed:", err);
      setCreateError("Photo upload failed. Try again.");
    } finally {
      setUploadingPhoto(null);
    }
  };

  const addDecisionRow = () => setDecisions([...decisions, { text: "" }]);
  const removeDecisionRow = (index) => {
    if (decisions.length > 1) setDecisions(decisions.filter((_, i) => i !== index));
  };
  const updateDecision = (index, value) => {
    const updated = [...decisions];
    updated[index].text = value;
    setDecisions(updated);
  };

  const handleCreatePoll = async () => {
    setCreateError("");

    // Rate limit check
    const rateCheck = pollCreateLimiter.check("create");
    if (!rateCheck.allowed) {
      setCreateError(`Too many polls created. Wait ${formatCooldown(rateCheck.retryAfterMs)}.`);
      return;
    }

    // Build options array
    let options = [];
    if (pollMode === "candidate") {
      const valid = candidates.filter((c) => c.name.trim() && c.roll.trim());
      options = valid.map((c, i) => ({
        id: `opt_${i + 1}`,
        name: sanitizeText(c.name),
        roll: sanitizeText(c.roll),
        photoUrl: c.photoUrl,
      }));
    } else {
      const valid = decisions.filter((d) => d.text.trim());
      options = valid.map((d, i) => ({
        id: `opt_${i + 1}`,
        text: sanitizeText(d.text),
      }));
    }

    // Schema-based validation
    const validation = validatePollCreate({
      title: sanitizeText(pollTitle),
      description: sanitizeText(pollDesc),
      mode: pollMode,
      options,
      visibleOptionCount: visibleCount,
    });
    if (!validation.valid) {
      setCreateError(validation.error);
      return;
    }

    try {
      // Embed allowedGroups in the options JSON to avoid schema changes
      const optionsWithMeta = { options, allowedGroups };
      await databases.createDocument(
        DATABASE_ID,
        COLLECTION_POLLS,
        ID.unique(),
        {
          title: sanitizeText(pollTitle),
          description: sanitizeText(pollDesc),
          mode: pollMode,
          status: "draft",
          createdAt: new Date().toISOString(),
          options: JSON.stringify(optionsWithMeta),
          visibleOptionCount: pollMode === "decision" ? visibleCount : 0,
        }
      );

      setPollTitle("");
      setPollDesc("");
      setPollMode(null);
      setCandidates([{ name: "", roll: "", photoUrl: "" }]);
      setDecisions([{ text: "" }]);
      setVisibleCount(1);
      setAllowedGroups(["C", "D"]);
      setActiveTab("polls");
    } catch (err) {
      console.error("Create poll failed:", err);
      setCreateError("Failed to create poll. Please try again.");
    }
  };

  const updatePollStatus = async (pollId, status) => {
    try {
      await databases.updateDocument(DATABASE_ID, COLLECTION_POLLS, pollId, { status });
    } catch (e) {
      console.error("Update poll status failed:", e);
    }
  };

  const deletePoll = async (pollId) => {
    if (confirm("Are you sure you want to delete this draft poll?")) {
      try {
        await databases.deleteDocument(DATABASE_ID, COLLECTION_POLLS, pollId);
      } catch (e) {
        console.error("Delete poll failed:", e);
      }
    }
  };

  const resetPassword = async (userId, defaultPwd) => {
    if (confirm(`Reset password for ${userId} to default?`)) {
      try {
        const result = await databases.listDocuments(
          DATABASE_ID,
          COLLECTION_USERS,
          [Query.equal("userId", userId)]
        );
        if (result.total > 0) {
          const hashedDefault = await hashPassword(defaultPwd);
          await databases.updateDocument(
            DATABASE_ID,
            COLLECTION_USERS,
            result.documents[0].$id,
            { password: hashedDefault, hasChangedPassword: false }
          );
        }
      } catch (e) {
        console.error("Reset password failed:", e);
      }
    }
  };

  const exportCSV = () => {
    if (voteLogs.length === 0) return;
    const headers = ["Timestamp", "Poll", "Choice", "User Hash"];
    const rows = voteLogs.map((log) => [
      log.timestamp || "N/A",
      log.pollTitle || "",
      log.choiceLabel || "",
      log.userHash || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cdmat-vote-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status) => {
    const map = { draft: "badge-draft", open: "badge-open", closed: "badge-closed", revealed: "badge-revealed" };
    return map[status] || "badge-draft";
  };

  const parseAllowedGroups = (poll) => {
    let raw = poll.options;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch { return ["C", "D"]; }
    }
    if (raw && typeof raw === "object" && Array.isArray(raw.allowedGroups)) {
      return raw.allowedGroups;
    }
    return ["C", "D"];
  };

  const getVoteCountForPoll = (pollId) => voteLogs.filter((l) => l.pollId === pollId).length;
  const getEligibleVoterCount = (poll) => {
    const groups = parseAllowedGroups(poll);
    if (groups.length === 0 || groups.length === 2) return studentUsers.length;
    return studentUsers.filter((u) => {
      const g = getUserGroup(u.id);
      return g && groups.includes(g);
    }).length;
  };
  const studentUsers = users.filter((u) => u.role === "student");
  const openPolls = polls.filter((p) => p.status === "open");

  const tabs = [
    { id: "polls", label: "Polls" },
    { id: "create", label: "Create Poll" },
    { id: "students", label: "Students" },
    { id: "logs", label: "Vote Log" },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8 animate-fade-in-up">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div>
              <h1 className="font-heading text-2xl font-bold text-gold">CD-MAT</h1>
              <p className="text-muted text-xs font-mono">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted">{user.id}</span>
            <button onClick={handleLogout} className="btn-outline text-sm px-3 py-1.5">Logout</button>
          </div>
        </div>

        {(canSeed || seedDone) && (
          <div className="mb-6 card text-center">
            {seedDone ? (
              <p className="text-success font-mono">Database seeded successfully!</p>
            ) : (
              <button onClick={handleSeed} disabled={seeding} className="btn-gold">
                {seeding ? "Seeding Database..." : "Seed Database"}
              </button>
            )}
          </div>
        )}

        <div className="flex gap-6 border-b border-gold/10 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 text-sm font-medium transition-colors ${activeTab === tab.id ? "tab-active" : "tab-inactive"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "polls" && (
          <div className="animate-fade-in-up">
            {polls.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-muted">No polls created yet. Go to "Create Poll" tab.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-muted text-xs font-mono uppercase tracking-wider">
                      <th className="pb-3 pr-4">Title</th>
                      <th className="pb-3 pr-4">Mode</th>
                      <th className="pb-3 pr-4">Eligible</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 pr-4">Votes</th>
                      <th className="pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {polls.map((poll) => {
                      const voteCount = getVoteCountForPoll(poll.id);
                      return (
                        <tr key={poll.id} className="border-t border-gold/10">
                          <td className="py-4 pr-4">
                            <span className="font-heading font-semibold text-offwhite">{poll.title}</span>
                          </td>
                          <td className="py-4 pr-4">
                            <span className="font-mono text-xs text-muted">
                              {poll.mode === "candidate" ? "Candidate" : "Decision"}
                            </span>
                          </td>
                          <td className="py-4 pr-4">
                            <span className="font-mono text-xs text-gold">
                              {parseAllowedGroups(poll).map((g) => `Grp ${g}`).join(", ") || "All"}
                            </span>
                          </td>
                          <td className="py-4 pr-4">
                            <span className={`badge ${getStatusBadge(poll.status)}`}>{poll.status}</span>
                          </td>
                          <td className="py-4 pr-4">
                            <span className="font-mono text-sm text-offwhite">{voteCount}/{getEligibleVoterCount(poll)}</span>
                          </td>
                          <td className="py-4">
                            <div className="flex gap-2 flex-wrap">
                              {poll.status === "draft" && (
                                <>
                                  <button onClick={() => updatePollStatus(poll.id, "open")} className="btn-gold text-xs px-3 py-1.5">Open Voting</button>
                                  <button onClick={() => deletePoll(poll.id)} className="btn-danger text-xs px-3 py-1.5">Delete</button>
                                </>
                              )}
                              {poll.status === "open" && (
                                <button onClick={() => updatePollStatus(poll.id, "closed")} className="btn-outline text-xs px-3 py-1.5">Close Voting</button>
                              )}
                              {poll.status === "closed" && (
                                <button onClick={() => updatePollStatus(poll.id, "revealed")} className="btn-gold text-xs px-3 py-1.5">Reveal Results</button>
                              )}
                              {poll.status === "revealed" && (
                                <span className="text-muted text-xs font-mono">Final</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "create" && (
          <div className="animate-fade-in-up max-w-2xl">
            {!pollMode ? (
              <div>
                <h3 className="font-heading text-lg font-semibold text-offwhite mb-4">Select Poll Mode</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div onClick={() => setPollMode("candidate")} className="card card-hover cursor-pointer text-center py-8">
                    <div className="text-4xl mb-3">&#128100;</div>
                    <h4 className="font-heading text-lg font-semibold text-offwhite mb-1">Candidate Selection</h4>
                    <p className="text-muted text-sm">Students vote for candidates</p>
                  </div>
                  <div onClick={() => setPollMode("decision")} className="card card-hover cursor-pointer text-center py-8">
                    <div className="text-4xl mb-3">&#9878;</div>
                    <h4 className="font-heading text-lg font-semibold text-offwhite mb-1">Decision Making</h4>
                    <p className="text-muted text-sm">Students choose from options</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <button onClick={() => setPollMode(null)} className="text-muted hover:text-gold">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                  </button>
                  <h3 className="font-heading text-lg font-semibold text-offwhite">
                    Create {pollMode === "candidate" ? "Candidate Selection" : "Decision Making"} Poll
                  </h3>
                </div>

                <div>
                  <label className="block text-sm text-muted mb-2 font-mono">Title</label>
                  <input type="text" value={pollTitle} onChange={(e) => setPollTitle(e.target.value)} className="input-field" placeholder="e.g. Class Rep Election" />
                </div>

                <div>
                  <label className="block text-sm text-muted mb-2 font-mono">Description</label>
                  <textarea value={pollDesc} onChange={(e) => setPollDesc(e.target.value)} className="input-field min-h-[80px] resize-y" placeholder="Optional description..." style={{ fontFamily: "'DM Sans', sans-serif" }} />
                </div>

                <div>
                  <label className="block text-sm text-muted mb-2 font-mono">Eligible Voters</label>
                  <div className="flex gap-3">
                    {["C", "D"].map((g) => (
                      <label key={g} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowedGroups.includes(g)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAllowedGroups([...allowedGroups, g]);
                            } else {
                              setAllowedGroups(allowedGroups.filter((x) => x !== g));
                            }
                          }}
                          className="w-4 h-4 accent-gold"
                        />
                        <span className="text-sm text-offwhite font-mono">Group {g}</span>
                        <span className="text-xs text-muted">
                          ({g === "C" ? "49-72" : "73-96"})
                        </span>
                      </label>
                    ))}
                  </div>
                  {allowedGroups.length === 0 && (
                    <p className="text-crimson text-xs mt-1">Select at least one group</p>
                  )}
                </div>

                {pollMode === "candidate" ? (
                  <div>
                    <label className="block text-sm text-muted mb-3 font-mono">Candidates</label>
                    {candidates.map((c, i) => (
                      <div key={i} className="card mb-3">
                        <div className="flex gap-3 items-start">
                          <div className="flex-shrink-0">
                            {c.photoUrl ? (
                              <div className="relative">
                                <img src={getPhotoUrl(c.photoUrl)} alt={c.name} className="w-20 h-20 rounded-full object-cover border border-gold/30" onError={(e) => { e.target.style.display = "none"; }} />
                                <button onClick={() => updateCandidate(i, "photoUrl", "")} className="absolute -top-1 -right-1 w-5 h-5 bg-crimson rounded-full text-white text-xs flex items-center justify-center hover:bg-red-700">&times;</button>
                              </div>
                            ) : (
                              <label className="w-20 h-20 rounded-full border-2 border-dashed border-gold/30 flex flex-col items-center justify-center cursor-pointer hover:border-gold/60 transition-colors">
                                {uploadingPhoto === i ? (
                                  <span className="text-gold text-xs animate-pulse">...</span>
                                ) : (
                                  <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                    <span className="text-muted text-[10px] mt-0.5">Photo</span>
                                  </>
                                )}
                                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handlePhotoUpload(i, e.target.files[0])} />
                              </label>
                            )}
                          </div>
                          <div className="flex-1 grid gap-3 sm:grid-cols-2">
                            <input type="text" value={c.name} onChange={(e) => updateCandidate(i, "name", e.target.value)} className="input-field" placeholder="Name" />
                            <div className="flex gap-2">
                              <input type="text" value={c.roll} onChange={(e) => updateCandidate(i, "roll", e.target.value)} className="input-field flex-1" placeholder="Roll Number" />
                              {candidates.length > 1 && (
                                <button onClick={() => removeCandidateRow(i)} className="text-crimson hover:text-red-400 px-2">&times;</button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={addCandidateRow} className="btn-outline text-sm">+ Add Candidate</button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm text-muted mb-3 font-mono">Options</label>
                    {decisions.map((d, i) => (
                      <div key={i} className="flex gap-2 mb-3">
                        <input type="text" value={d.text} onChange={(e) => updateDecision(i, e.target.value)} className="input-field" placeholder={`Option ${i + 1}`} />
                        {decisions.length > 1 && (
                          <button onClick={() => removeDecisionRow(i)} className="text-crimson hover:text-red-400 px-2">&times;</button>
                        )}
                      </div>
                    ))}
                    <button onClick={addDecisionRow} className="btn-outline text-sm mb-4">+ Add Option</button>

                    <div>
                      <label className="block text-sm text-muted mb-2 font-mono">Visible Option Count</label>
                      <input type="number" value={visibleCount} onChange={(e) => setVisibleCount(Math.max(1, Math.min(decisions.length, parseInt(e.target.value) || 1)))} className="input-field w-32" min={1} max={decisions.length} />
                      <p className="text-muted text-xs mt-1">How many options students see</p>
                    </div>
                  </div>
                )}

                {createError && (
                  <div className="bg-crimson/20 border border-crimson/40 rounded-lg px-4 py-3 text-sm text-red-300 font-mono">{createError}</div>
                )}

                <div className="flex gap-3">
                  <button onClick={handleCreatePoll} className="btn-gold">Save as Draft</button>
                  <button onClick={() => { setPollMode(null); setPollTitle(""); setPollDesc(""); }} className="btn-outline">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "students" && (
          <div className="animate-fade-in-up">
            {studentUsers.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-muted">No students found. Seed the database first.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-muted text-xs font-mono uppercase tracking-wider">
                      <th className="pb-3 pr-4">Roll ID</th>
                      <th className="pb-3 pr-4">Group</th>
                      <th className="pb-3 pr-4">Password Status</th>
                      <th className="pb-3 pr-4">Last Login</th>
                      {openPolls.length > 0 && <th className="pb-3 pr-4">Participation</th>}
                      <th className="pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentUsers.map((u) => (
                      <tr key={u.id} className="border-t border-gold/10">
                        <td className="py-3 pr-4 font-mono text-sm text-offwhite">{u.id}</td>
                        <td className="py-3 pr-4">
                          <span className="font-mono text-xs text-gold">{getUserGroup(u.id) || "-"}</span>
                        </td>
                        <td className="py-3 pr-4">
                          {u.hasChangedPassword ? (
                            <span className="text-success text-sm font-mono">Changed</span>
                          ) : (
                            <span className="text-yellow-400 text-sm font-mono">Default</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-sm text-muted font-mono">
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never"}
                        </td>
                        {openPolls.length > 0 && (
                          <td className="py-3 pr-4">
                            {openPolls.map((p) => {
                              const hasVoted = voteLogs.some((l) => l.pollId === p.id && l.userHash === userHashMap[u.id]);
                              return (
                                <span key={p.id} className={`inline-block mr-2 text-xs font-mono px-2 py-0.5 rounded ${hasVoted ? "bg-success/20 text-green-400" : "bg-muted/20 text-muted"}`}>
                                  {hasVoted ? "Voted" : "Not voted"}
                                </span>
                              );
                            })}
                          </td>
                        )}
                        <td className="py-3">
                          <button onClick={() => resetPassword(u.id, u.defaultPassword)} className="btn-outline text-xs px-3 py-1.5">Reset Password</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <div className="animate-fade-in-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading text-lg font-semibold text-offwhite">Vote Audit Log</h3>
              <button onClick={exportCSV} disabled={voteLogs.length === 0} className="btn-gold text-sm">Export CSV</button>
            </div>
            {voteLogs.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-muted">No votes recorded yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-muted text-xs font-mono uppercase tracking-wider">
                      <th className="pb-3 pr-4">Timestamp</th>
                      <th className="pb-3 pr-4">Poll</th>
                      <th className="pb-3 pr-4">Choice</th>
                      <th className="pb-3">User Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voteLogs.map((log) => (
                      <tr key={log.id} className="border-t border-gold/10">
                        <td className="py-3 pr-4 font-mono text-xs text-muted">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : "N/A"}
                        </td>
                        <td className="py-3 pr-4 text-sm text-offwhite">{log.pollTitle}</td>
                        <td className="py-3 pr-4 text-sm text-offwhite">{log.choiceLabel}</td>
                        <td className="py-3 font-mono text-xs text-gold">{log.userHash}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
