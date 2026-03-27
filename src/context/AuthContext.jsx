import { createContext, useContext, useState, useEffect } from "react";
import { databases, DATABASE_ID, COLLECTION_USERS, Query } from "../appwrite";
import { hashPassword } from "../utils/crypto";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem("cdmat_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        sessionStorage.removeItem("cdmat_user");
      }
    }
    setLoading(false);
  }, []);

  const login = async (id, password) => {
    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_USERS,
      [Query.equal("userId", id)]
    );

    if (result.total === 0) {
      throw new Error("Invalid credentials");
    }

    const userDoc = result.documents[0];
    const hashedInput = await hashPassword(password);

    if (userDoc.password !== hashedInput) {
      throw new Error("Invalid credentials");
    }

    const sessionUser = {
      id: userDoc.userId,
      role: userDoc.role,
      hasChangedPassword: userDoc.hasChangedPassword,
    };

    try {
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTION_USERS,
        userDoc.$id,
        { lastLogin: new Date().toISOString() }
      );
    } catch (e) {
      // non-critical
    }

    sessionStorage.setItem("cdmat_user", JSON.stringify(sessionUser));
    setUser(sessionUser);
    return sessionUser;
  };

  const logout = () => {
    sessionStorage.removeItem("cdmat_user");
    setUser(null);
  };

  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    sessionStorage.setItem("cdmat_user", JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
