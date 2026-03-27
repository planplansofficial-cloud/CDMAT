import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import StudentHome from "./components/StudentHome";
import StudentVote from "./components/StudentVote";
import StudentResults from "./components/StudentResults";
import StudentSettings from "./components/StudentSettings";
import AdminDashboard from "./components/AdminDashboard";

function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gold text-lg font-heading">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/student"} replace />;
  }

  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRole="student">
            <StudentHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/vote/:pollId"
        element={
          <ProtectedRoute allowedRole="student">
            <StudentVote />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/results/:pollId"
        element={
          <ProtectedRoute allowedRole="student">
            <StudentResults />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/settings"
        element={
          <ProtectedRoute allowedRole="student">
            <StudentSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
