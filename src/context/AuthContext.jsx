import { createContext, useContext, useState, useEffect } from "react";
import { databases, DATABASE_ID, COLLECTION_USERS, Query } from "../appwrite";
import { hashPassword } from "../utils/crypto";
import { getUserGroup } from "../utils/groups";
import { signJwt, verifyJwt } from "../utils/jwt";

const AuthContext = createContext(null);
const JWT_STORAGE_KEY = "cdmat_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const token = sessionStorage.getItem(JWT_STORAGE_KEY);
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const payload = await verifyJwt(token);
        setUser({
          id: payload.sub,
          role: payload.role,
          group: payload.group,
          hasChangedPassword: payload.hasChangedPassword,
        });
      } catch {
        sessionStorage.removeItem(JWT_STORAGE_KEY);
      }
      setLoading(false);
    };
    restoreSession();
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
      group: getUserGroup(userDoc.userId),
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

    const token = await signJwt({
      sub: sessionUser.id,
      role: sessionUser.role,
      group: sessionUser.group,
      hasChangedPassword: sessionUser.hasChangedPassword,
    });
    sessionStorage.setItem(JWT_STORAGE_KEY, token);
    setUser(sessionUser);
    return sessionUser;
  };

  const logout = () => {
    sessionStorage.removeItem(JWT_STORAGE_KEY);
    setUser(null);
  };

  const updateUser = async (updates) => {
    const updated = { ...user, ...updates };
    const token = await signJwt({
      sub: updated.id,
      role: updated.role,
      group: updated.group,
      hasChangedPassword: updated.hasChangedPassword,
    });
    sessionStorage.setItem(JWT_STORAGE_KEY, token);
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
