import { useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

export function useAntiCheat() {
  const { logout } = useAuth();

  const handleIdleLogout = useCallback(() => {
    logout();
  }, [logout]);

  useEffect(() => {
    let idleTimer;
    let warningTimer;

    const resetTimer = () => {
      clearTimeout(idleTimer);
      clearTimeout(warningTimer);

      warningTimer = setTimeout(() => {
        console.warn("You will be logged out due to inactivity in 2 minutes.");
      }, 8 * 60 * 1000);

      idleTimer = setTimeout(() => {
        handleIdleLogout();
      }, 10 * 60 * 1000);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => document.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      clearTimeout(idleTimer);
      clearTimeout(warningTimer);
      events.forEach((event) => document.removeEventListener(event, resetTimer));
    };
  }, [handleIdleLogout]);

  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    const handleKeyDown = (e) => {
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c"))) {
        e.preventDefault();
      }
      if (e.key === "F12") {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}
