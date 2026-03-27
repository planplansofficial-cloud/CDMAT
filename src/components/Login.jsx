import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { validateLogin, sanitizeText } from "../utils/validate";
import { loginLimiter, formatCooldown } from "../utils/rateLimit";
import Logo from "./Logo";

function Login() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(user.role === "admin" ? "/admin" : "/student", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Rate limit check
    const rateCheck = loginLimiter.check("login");
    if (!rateCheck.allowed) {
      setError(`Too many attempts. Try again in ${formatCooldown(rateCheck.retryAfterMs)}.`);
      return;
    }

    // Input validation
    const trimmedId = sanitizeText(id);
    const result = validateLogin(trimmedId, password);
    if (!result.valid) {
      setError(result.error);
      return;
    }

    setLoading(true);

    try {
      const loggedInUser = await login(trimmedId, password);
      loginLimiter.reset("login");
      navigate(loggedInUser.role === "admin" ? "/admin" : "/student", { replace: true });
    } catch (err) {
      loginLimiter.recordFailure("login");
      // Generic error — don't reveal whether ID exists
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size={64} />
          </div>
          <h1 className="font-heading text-3xl font-bold text-gold mb-2">CD-MAT</h1>
          <p className="text-muted text-sm">Class Decision & Management and Allocation Tool</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm text-muted mb-2 font-mono">ID</label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="input-field"
                placeholder="Enter your ID"
                required
                autoComplete="off"
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-2 font-mono">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="Enter your password"
                  required
                  maxLength={100}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-gold transition-colors"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-crimson/20 border border-crimson/40 rounded-lg px-4 py-3 text-sm text-red-300 font-mono">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full py-3 text-base"
            >
              {loading ? "Authenticating..." : "Login"}
            </button>
          </form>
        </div>

        <p className="text-center text-muted text-xs mt-6 font-mono">
          Tamper-proof class voting platform
        </p>
      </div>
    </div>
  );
}

export default Login;
