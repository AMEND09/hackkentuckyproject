import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { WordmarkWipe } from "./WordmarkWipe";

const BOOT_KEY = "dart_boot_splash_seen";
/** Wait for the wipe reveal to finish before flashing out. */
const WIPE_MS = 2200;
/** Scale-up + dissolve duration. */
const FLASH_MS = 750;

/**
 * Full-screen white wordmark wipe shown on first load / while the session
 * is resolving. After the wipe, the mark scales up and fades as the site
 * comes through underneath.
 */
export function AppSplash({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const [visible, setVisible] = useState(() => {
    try {
      return sessionStorage.getItem(BOOT_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [exiting, setExiting] = useState(false);
  const [wipeDone, setWipeDone] = useState(false);

  // Hand off from the HTML launch lockup as soon as React mounts.
  useEffect(() => {
    document.getElementById("dart-boot")?.remove();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => setWipeDone(true), WIPE_MS);
    return () => window.clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (!visible || loading || !wipeDone || exiting) return;
    setExiting(true);
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(BOOT_KEY, "1");
      } catch {
        /* ignore */
      }
      setVisible(false);
    }, FLASH_MS);
    return () => window.clearTimeout(t);
  }, [visible, loading, wipeDone, exiting]);

  return (
    <>
      {children}
      {visible && (
        <div
          className={`dart-splash-screen ${exiting ? "is-exiting" : ""}`}
          role="status"
          aria-live="polite"
          aria-label="Loading DART"
        >
          <div className="dart-splash-mark">
            <WordmarkWipe size="md" />
          </div>
        </div>
      )}
    </>
  );
}
