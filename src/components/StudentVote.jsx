import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Client } from "appwrite";
import { useAuth } from "../context/AuthContext";
import { databases, DATABASE_ID, COLLECTION_POLLS, COLLECTION_VOTES, COLLECTION_VOTE_LOG, ID, Query, getPhotoUrl } from "../appwrite";
import { validateVote } from "../utils/validate";
import { hashChoiceId, hashUserId, generateVoteId } from "../utils/crypto";
import { useAntiCheat } from "../hooks/useAntiCheat";
import Logo from "./Logo";

function SafeImg({ src, alt, className, fallback }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return fallback;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function StudentVote() {
  const { pollId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  useAntiCheat();

  const [poll, setPoll] = useState(null);
  const [selected, setSelected] = useState(null);
  const [hasVoted, setHasVoted] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [canConfirm, setCanConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voted, setVoted] = useState(false);
  const [pollClosed, setPollClosed] = useState(false);
  const [voteError, setVoteError] = useState("");

  const parseOptions = (poll) => {
    if (typeof poll.options === "string") {
      try { return JSON.parse(poll.options); } catch { return []; }
    }
    return poll.options || [];
  };

  useEffect(() => {
    const loadPoll = async () => {
      try {
        const doc = await databases.getDocument(DATABASE_ID, COLLECTION_POLLS, pollId);
        const data = { id: doc.$id, ...doc };
        data.options = parseOptions(data);
        setPoll(data);
        if (data.status === "closed" || data.status === "revealed") {
          setPollClosed(true);
        }
      } catch {
        navigate("/student");
      }
    };
    loadPoll();

    let unsub;
    try {
      const client = new Client()
        .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
        .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

      unsub = client.subscribe(
        `databases.${DATABASE_ID}.collections.${COLLECTION_POLLS}.documents.${pollId}`,
        (response) => {
          if (response.events.includes("databases.*.collections.*.documents.*.update")) {
            loadPoll();
          }
        }
      );
    } catch {
      // Realtime unavailable — poll won't auto-refresh
    }

    return () => { if (typeof unsub === "function") unsub(); };
  }, [pollId, navigate]);

  useEffect(() => {
    const checkVote = async () => {
      try {
        const voteId = await generateVoteId(user.id, pollId);
        await databases.getDocument(DATABASE_ID, COLLECTION_VOTES, voteId);
        setHasVoted(true);
      } catch {
        setHasVoted(false);
      }
    };
    checkVote();
  }, [user.id, pollId]);

  useEffect(() => {
    if (!showConfirm) return;
    if (countdown <= 0) {
      setCanConfirm(true);
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [showConfirm, countdown]);

  const handleVote = async () => {
    if (!selected || submitting) return;
    setVoteError("");

    const validResult = validateVote(selected, poll.options || []);
    if (!validResult.valid) {
      setVoteError(validResult.error);
      return;
    }

    setSubmitting(true);

    try {
      const voteId = await generateVoteId(user.id, pollId);
      const choiceLabel = poll.mode === "candidate"
        ? `${selected.name} (Roll ${selected.roll})`
        : selected.text;

      const hashedChoiceId = await hashChoiceId(selected.id, pollId);
      const hashedUserHash = await hashUserId(user.id);

      await databases.createDocument(
        DATABASE_ID,
        COLLECTION_VOTES,
        voteId,
        {
          userId: user.id,
          pollId: pollId,
          choiceId: hashedChoiceId,
          timestamp: new Date().toISOString(),
        }
      );

      try {
        await databases.createDocument(
          DATABASE_ID,
          COLLECTION_VOTE_LOG,
          ID.unique(),
          {
            userHash: hashedUserHash,
            pollId: pollId,
            pollTitle: poll.title,
            choiceId: hashedChoiceId,
            choiceLabel: choiceLabel,
            timestamp: new Date().toISOString(),
          }
        );
      } catch {
        // VoteLog is audit-only — vote itself is already recorded
      }

      setVoted(true);
      setShowConfirm(false);
    } catch (err) {
      const msg = err?.message || "";
      if (msg.includes("already exists") || err?.code === 409) {
        // Already voted — show as voted
        setHasVoted(true);
        setShowConfirm(false);
      } else {
        setVoteError("Failed to submit vote. Please try again.");
      }
      setSubmitting(false);
    }
  };

  if (hasVoted === null || !poll) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gold text-lg font-heading">Loading...</div>
      </div>
    );
  }

  if (hasVoted || voted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in-up">
        <div className="text-center">
          <div className="seal-stamp text-8xl mb-6 text-gold">&#9733;</div>
          <h2 className="font-heading text-2xl font-bold text-gold mb-3">
            Your vote has been recorded.
          </h2>
          <p className="text-muted mb-6">Thank you for participating.</p>
          <button onClick={() => navigate("/student")} className="btn-gold">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (pollClosed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in-up">
        <div className="text-center">
          <div className="text-6xl mb-6 text-muted">&#128274;</div>
          <h2 className="font-heading text-2xl font-bold text-offwhite mb-3">
            Voting is Closed
          </h2>
          <p className="text-muted mb-6">This poll is no longer accepting votes.</p>
          <button onClick={() => navigate("/student")} className="btn-gold">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const fallbackAvatar = (name) => (
    <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-gold font-heading font-bold text-lg">
      {(name || "?").charAt(0)}
    </div>
  );

  return (
    <div className="min-h-screen p-4 md:p-8 animate-fade-in-up">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate("/student")} className="text-muted hover:text-gold transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <Logo size={32} />
          <h1 className="font-heading text-xl font-bold text-gold">CD-MAT</h1>
        </div>

        <div className="card mb-6">
          <h2 className="font-heading text-2xl font-bold text-offwhite mb-2">{poll.title}</h2>
          {poll.description && <p className="text-muted">{poll.description}</p>}
          <span className="badge badge-open mt-3">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot inline-block"></span>
            Voting Open
          </span>
        </div>

        <div className="mb-6">
          <h3 className="font-heading text-lg font-semibold text-offwhite mb-4">
            {poll.mode === "candidate" ? "Select a Candidate" : "Choose an Option"}
          </h3>

          {poll.mode === "candidate" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {poll.options.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setSelected(opt)}
                  className={`card cursor-pointer transition-all ${
                    selected?.id === opt.id
                      ? "border-gold bg-gold/5 ring-1 ring-gold/30"
                      : "card-hover"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <SafeImg
                      src={getPhotoUrl(opt.photoUrl)}
                      alt={opt.name}
                      className="w-12 h-12 rounded-full object-cover border border-gold/30"
                      fallback={fallbackAvatar(opt.name)}
                    />
                    <div>
                      <p className="font-heading font-semibold text-offwhite">{opt.name}</p>
                      <p className="font-mono text-sm text-muted">Roll: {opt.roll}</p>
                    </div>
                  </div>
                  {selected?.id === opt.id && (
                    <div className="mt-3 text-gold text-sm font-medium flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Selected
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {poll.options.slice(0, poll.visibleOptionCount || poll.options.length).map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setSelected(opt)}
                  className={`card cursor-pointer transition-all ${
                    selected?.id === opt.id
                      ? "border-gold bg-gold/5 ring-1 ring-gold/30"
                      : "card-hover"
                  }`}
                >
                  <p className="font-body text-offwhite">{opt.text}</p>
                  {selected?.id === opt.id && (
                    <div className="mt-2 text-gold text-sm font-medium flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Selected
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <button
            onClick={() => {
              setShowConfirm(true);
              setCountdown(3);
              setCanConfirm(false);
              setVoteError("");
            }}
            disabled={!selected}
            className="btn-gold px-8 py-3 text-lg"
          >
            Cast Vote
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full animate-fade-in-up">
            <h3 className="font-heading text-xl font-bold text-offwhite mb-4">Confirm Your Vote</h3>
            <div className="bg-navy/50 rounded-lg p-4 mb-4">
              <p className="text-muted text-sm mb-1">You are voting for:</p>
              <p className="font-heading text-lg text-gold font-semibold">
                {poll.mode === "candidate"
                  ? `${selected?.name} (Roll ${selected?.roll})`
                  : selected?.text}
              </p>
            </div>
            <p className="text-muted text-sm mb-4">
              This action is <strong className="text-crimson">irreversible</strong>. You will not be able to change your vote.
            </p>
            {voteError && (
              <div className="bg-crimson/20 border border-crimson/40 rounded-lg px-4 py-3 mb-4 text-sm text-red-300 font-mono">
                {voteError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); setVoteError(""); }}
                className="btn-outline flex-1"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleVote}
                disabled={!canConfirm || submitting}
                className="btn-gold flex-1"
              >
                {submitting
                  ? "Submitting..."
                  : canConfirm
                  ? "Confirm Vote"
                  : `Wait ${countdown}s...`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentVote;
