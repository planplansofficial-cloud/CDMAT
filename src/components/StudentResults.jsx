import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { databases, DATABASE_ID, COLLECTION_POLLS, COLLECTION_VOTES, Query, getPhotoUrl } from "../appwrite";
import { hashChoiceId, generateVoteId } from "../utils/crypto";
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

function StudentResults() {
  const { pollId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  useAntiCheat();

  const [poll, setPoll] = useState(null);
  const [results, setResults] = useState(null);
  const [totalVotes, setTotalVotes] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);

  const parseOptions = (poll) => {
    let raw = poll.options;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch { return []; }
    }
    if (raw && typeof raw === "object" && Array.isArray(raw.options)) {
      return raw.options;
    }
    return Array.isArray(raw) ? raw : [];
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const pollDoc = await databases.getDocument(DATABASE_ID, COLLECTION_POLLS, pollId);
        const pollData = { id: pollDoc.$id, ...pollDoc };
        pollData.options = parseOptions(pollData);
        setPoll(pollData);

        try {
          const voteId = await generateVoteId(user.id, pollId);
          await databases.getDocument(DATABASE_ID, COLLECTION_VOTES, voteId);
          setHasVoted(true);
        } catch {
          setHasVoted(false);
        }

        if (pollData.status !== "revealed") {
          return;
        }

        const votesResult = await databases.listDocuments(
          DATABASE_ID,
          COLLECTION_VOTES,
          [Query.equal("pollId", pollId)]
        );

        const voteCounts = {};
        votesResult.documents.forEach((doc) => {
          voteCounts[doc.choiceId] = (voteCounts[doc.choiceId] || 0) + 1;
        });

        const total = votesResult.total;
        setTotalVotes(total);

        const resultMap = {};
        for (const opt of pollData.options) {
          const hashedId = await hashChoiceId(opt.id, pollId);
          resultMap[opt.id] = {
            ...opt,
            votes: voteCounts[hashedId] || 0,
            percentage: total > 0
              ? Math.round(((voteCounts[hashedId] || 0) / total) * 100)
              : 0,
          };
        }
        setResults(resultMap);
      } catch {
        navigate("/student");
      }
    };
    fetchData();
  }, [pollId, user.id, navigate]);

  if (!poll) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gold text-lg font-heading">Loading...</div>
      </div>
    );
  }

  if (poll.status !== "revealed") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in-up">
        <div className="text-center">
          <div className="text-6xl mb-6 text-muted">&#128274;</div>
          <h2 className="font-heading text-2xl font-bold text-offwhite mb-3">
            Results Not Yet Available
          </h2>
          <p className="text-muted mb-6">
            The administrator has not revealed the results for this poll yet.
          </p>
          <button onClick={() => navigate("/student")} className="btn-gold">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!hasVoted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in-up">
        <div className="text-center">
          <div className="text-6xl mb-6 text-muted">&#128683;</div>
          <h2 className="font-heading text-2xl font-bold text-offwhite mb-3">
            Access Denied
          </h2>
          <p className="text-muted mb-6">You did not vote in this poll.</p>
          <button onClick={() => navigate("/student")} className="btn-gold">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const sortedResults = results ? Object.values(results).sort((a, b) => b.votes - a.votes) : [];

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
          <p className="text-muted text-sm">{poll.description}</p>
          <div className="flex items-center gap-3 mt-3">
            <span className="badge badge-revealed">
              <span>&#9733;</span> Results Revealed
            </span>
            <span className="text-muted text-sm font-mono">{totalVotes} total votes</span>
          </div>
        </div>

        {poll.mode === "candidate" ? (
          <div className="space-y-4">
            {sortedResults.map((opt, index) => (
              <div key={opt.id} className={`card ${index === 0 ? "border-gold/50" : ""}`}>
                <div className="flex items-center gap-4 mb-3">
                  <SafeImg
                    src={getPhotoUrl(opt.photoUrl)}
                    alt={opt.name}
                    className="w-12 h-12 rounded-full object-cover border border-gold/30"
                    fallback={fallbackAvatar(opt.name)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-heading text-lg font-semibold text-offwhite">{opt.name}</h4>
                      {index === 0 && (
                        <span className="text-gold text-lg" title="Winner">&#9813;</span>
                      )}
                      {index === 0 && (
                        <span className="badge badge-revealed text-xs">Winner</span>
                      )}
                    </div>
                    <p className="font-mono text-sm text-muted">Roll: {opt.roll}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-2xl font-bold text-gold">{opt.votes}</p>
                    <p className="text-muted text-sm">{opt.percentage}%</p>
                  </div>
                </div>
                <div className="w-full bg-navy rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${opt.percentage}%`,
                      background: index === 0
                        ? "linear-gradient(90deg, #c9a84c, #8a6f2e)"
                        : "rgba(201,168,76,0.3)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedResults.map((opt) => (
              <div key={opt.id} className="card">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-body text-offwhite flex-1">{opt.text}</p>
                  <div className="ml-4 text-right">
                    <span className="font-heading text-xl font-bold text-gold">{opt.votes}</span>
                    <span className="text-muted text-sm ml-1">({opt.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-navy rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${opt.percentage}%`,
                      background: "linear-gradient(90deg, #c9a84c, #8a6f2e)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <button onClick={() => navigate("/student")} className="btn-gold">
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default StudentResults;
