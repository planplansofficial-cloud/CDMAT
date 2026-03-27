import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Client } from "appwrite";
import { useAuth } from "../context/AuthContext";
import { databases, DATABASE_ID, COLLECTION_POLLS, COLLECTION_VOTES, Query } from "../appwrite";
import { generateVoteId } from "../utils/crypto";
import { useAntiCheat } from "../hooks/useAntiCheat";
import Logo from "./Logo";

function StudentHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [polls, setPolls] = useState([]);
  const [votedPolls, setVotedPolls] = useState(new Set());
  useAntiCheat();
  const clientRef = useRef(null);

  useEffect(() => {
    const loadPolls = async () => {
      try {
        const result = await databases.listDocuments(DATABASE_ID, COLLECTION_POLLS);
        setPolls(result.documents.map((d) => ({ id: d.$id, ...d })));
      } catch (e) {
        console.error("Failed to load polls:", e);
      }
    };
    loadPolls();

    let unsub;
    try {
      const client = new Client()
        .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
        .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);
      clientRef.current = client;

      unsub = client.subscribe(
        `databases.${DATABASE_ID}.collections.${COLLECTION_POLLS}.documents`,
        () => {
          loadPolls();
        }
      );
    } catch {
      // Realtime unavailable
    }

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  useEffect(() => {
    const checkVotes = async () => {
      const voted = new Set();
      for (const poll of polls) {
        try {
          const voteId = await generateVoteId(user.id, poll.id);
          await databases.getDocument(DATABASE_ID, COLLECTION_VOTES, voteId);
          voted.add(poll.id);
        } catch {
          // not voted
        }
      }
      setVotedPolls(voted);
    };
    if (polls.length > 0 && user) {
      checkVotes();
    }
  }, [polls, user]);

  const activePolls = polls.filter((p) => p.status === "open" && !votedPolls.has(p.id));
  const votedPollList = polls.filter((p) => votedPolls.has(p.id) && p.status !== "revealed");
  const revealedPolls = polls.filter((p) => p.status === "revealed" && votedPolls.has(p.id));

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen p-4 md:p-8 animate-fade-in-up">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div>
              <h1 className="font-heading text-2xl font-bold text-gold">CD-MAT</h1>
              <p className="text-muted text-xs font-mono">Class Decision & Management Tool</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/student/settings")}
              className="btn-outline text-sm px-3 py-1.5"
            >
              Settings
            </button>
            <button onClick={handleLogout} className="btn-outline text-sm px-3 py-1.5">
              Logout
            </button>
          </div>
        </div>

        <div className="mb-2">
          <h2 className="font-heading text-xl font-semibold text-offwhite">
            Welcome, <span className="text-gold font-mono">{user.id}</span>
          </h2>
        </div>

        {!user.hasChangedPassword && (
          <div className="bg-yellow-900/30 border border-yellow-600/30 rounded-lg px-4 py-3 mb-6 text-sm text-yellow-300">
            You are using the default password.{" "}
            <button
              onClick={() => navigate("/student/settings")}
              className="text-gold underline hover:no-underline"
            >
              Change it now
            </button>
          </div>
        )}

        {activePolls.length > 0 && (
          <div className="mb-8">
            <h3 className="font-heading text-lg font-semibold text-offwhite mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse-dot inline-block"></span>
              Active Now
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {activePolls.map((poll) => (
                <div
                  key={poll.id}
                  onClick={() => navigate(`/student/vote/${poll.id}`)}
                  className="card card-hover cursor-pointer animate-fade-in-up"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-heading text-lg font-semibold text-offwhite">
                      {poll.title}
                    </h4>
                    <span className="badge badge-open">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot inline-block"></span>
                      Open
                    </span>
                  </div>
                  <p className="text-muted text-sm mb-3">{poll.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted">
                      {poll.mode === "candidate" ? "Candidate Selection" : "Decision Making"}
                    </span>
                    <span className="text-gold text-sm font-medium">Vote Now &rarr;</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {votedPollList.length > 0 && (
          <div className="mb-8">
            <h3 className="font-heading text-lg font-semibold text-offwhite mb-4">
              Already Voted
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {votedPollList.map((poll) => (
                <div key={poll.id} className="card opacity-75">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-heading text-lg font-semibold text-offwhite">
                      {poll.title}
                    </h4>
                    <span className="seal-stamp text-2xl" title="Vote recorded">
                      &#9733;
                    </span>
                  </div>
                  <p className="text-muted text-sm">Vote recorded. Awaiting results.</p>
                  <span className="badge badge-closed mt-2">
                    {poll.status === "closed" ? "Voting Closed" : "Vote Submitted"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {revealedPolls.length > 0 && (
          <div className="mb-8">
            <h3 className="font-heading text-lg font-semibold text-offwhite mb-4 flex items-center gap-2">
              Results Ready
              <span className="text-gold">&#9733;</span>
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {revealedPolls.map((poll) => (
                <div
                  key={poll.id}
                  onClick={() => navigate(`/student/results/${poll.id}`)}
                  className="card card-hover cursor-pointer animate-fade-in-up"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-heading text-lg font-semibold text-offwhite">
                      {poll.title}
                    </h4>
                    <span className="badge badge-revealed">
                      <span>&#9733;</span> Revealed
                    </span>
                  </div>
                  <p className="text-muted text-sm">Results are now available.</p>
                  <span className="text-gold text-sm font-medium mt-2 inline-block">
                    View Results &rarr;
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {polls.filter((p) => p.status !== "draft").length === 0 && (
          <div className="card text-center py-12">
            <p className="text-muted text-lg">No polls available at the moment.</p>
            <p className="text-muted text-sm mt-2">Check back later for active voting sessions.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentHome;
