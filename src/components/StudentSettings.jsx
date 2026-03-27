import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { databases, DATABASE_ID, COLLECTION_USERS, Query } from "../appwrite";
import { validatePasswordChange, sanitizeText } from "../utils/validate";
import { passwordLimiter, formatCooldown } from "../utils/rateLimit";
import { useAntiCheat } from "../hooks/useAntiCheat";
import Logo from "./Logo";

function StudentSettings() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  useAntiCheat();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const isAdmin = user?.role === "admin";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Rate limit check
    const rateCheck = passwordLimiter.check(user.id);
    if (!rateCheck.allowed) {
      setError(`Too many attempts. Try again in ${formatCooldown(rateCheck.retryAfterMs)}.`);
      return;
    }

    // Input validation
    const result = validatePasswordChange(currentPassword, newPassword, confirmPassword);
    if (!result.valid) {
      setError(result.error);
      return;
    }

    setLoading(true);

    try {
      const result = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_USERS,
        [Query.equal("userId", user.id)]
      );

      if (result.total === 0) {
        setError("User not found");
        return;
      }

      const userDoc = result.documents[0];

      if (userDoc.password !== currentPassword) {
        passwordLimiter.recordFailure(user.id);
        setError("Current password is incorrect");
        return;
      }

      await databases.updateDocument(
        DATABASE_ID,
        COLLECTION_USERS,
        userDoc.$id,
        {
          password: newPassword,
          hasChangedPassword: true,
        }
      );

      passwordLimiter.reset(user.id);
      updateUser({ hasChangedPassword: true });
      setSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError("Failed to change password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen p-4 md:p-8 animate-fade-in-up">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate("/student")} className="text-muted hover:text-gold transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <Logo size={32} />
          <h1 className="font-heading text-xl font-bold text-gold">CD-MAT</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={handleLogout} className="btn-outline text-sm px-3 py-1.5">Logout</button>
          </div>
        </div>

        <div className="card">
          <h2 className="font-heading text-xl font-bold text-offwhite mb-1">Settings</h2>
          <p className="text-muted text-sm mb-6 font-mono">{user.id}</p>

          {isAdmin ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">&#128274;</div>
              <p className="text-muted">Admin password cannot be changed from this interface.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm text-muted mb-2 font-mono">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="input-field pr-10"
                    placeholder="Enter current password"
                    required
                    maxLength={100}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-gold transition-colors"
                  >
                    {showCurrent ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted mb-2 font-mono">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field pr-10"
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                    maxLength={100}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-gold transition-colors"
                  >
                    {showNew ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted mb-2 font-mono">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  placeholder="Re-enter new password"
                  required
                  maxLength={100}
                />
              </div>

              {error && (
                <div className="bg-crimson/20 border border-crimson/40 rounded-lg px-4 py-3 text-sm text-red-300 font-mono">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-success/20 border border-success/40 rounded-lg px-4 py-3 text-sm text-green-300 font-mono">
                  {success}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-gold w-full py-3">
                {loading ? "Updating..." : "Change Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentSettings;
