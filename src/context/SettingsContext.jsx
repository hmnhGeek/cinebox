import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getSettings,
  updateSettings as saveSettings,
} from "../service/settingsApi";

const DEFAULT_SETTINGS = {
  playback: {
    defaultMuted: true,
  },
  discovery: {
    actors: {
      showOnlyWithProfile: false,
    },
  },
  library: {
    expandTechnicalInfo: false,
  },
  home: {
    showMediaBar: true,
  },
};

const SettingsContext = createContext(null);

function normalizeSettings(data) {
  return {
    playback: {
      defaultMuted:
        typeof data?.playback?.defaultMuted === "boolean"
          ? data.playback.defaultMuted
          : DEFAULT_SETTINGS.playback.defaultMuted,
    },
    discovery: {
      actors: {
        showOnlyWithProfile:
          typeof data?.discovery?.actors?.showOnlyWithProfile === "boolean"
            ? data.discovery.actors.showOnlyWithProfile
            : DEFAULT_SETTINGS.discovery.actors.showOnlyWithProfile,
      },
    },
    library: {
      expandTechnicalInfo:
        typeof data?.library?.expandTechnicalInfo === "boolean"
          ? data.library.expandTechnicalInfo
          : DEFAULT_SETTINGS.library.expandTechnicalInfo,
    },
    home: {
      showMediaBar:
        typeof data?.home?.showMediaBar === "boolean"
          ? data.home.showMediaBar
          : DEFAULT_SETTINGS.home.showMediaBar,
    },
  };
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSettings() {
      setLoading(true);
      setError("");

      try {
        const data = await getSettings({
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setSettings(normalizeSettings(data));
        }
      } catch (err) {
        if (err?.name === "AbortError") return;

        console.error("Failed to load application settings:", err);

        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Couldn't load application settings.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => controller.abort();
  }, []);

  const updateSettings = useCallback(async (updates) => {
    setUpdating(true);

    try {
      const data = await saveSettings(updates);

      setSettings(normalizeSettings(data));
      setError("");

      return normalizeSettings(data);
    } catch (err) {
      console.error("Failed to update application settings:", err);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, []);

  const retryLoadSettings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getSettings();
      setSettings(normalizeSettings(data));
    } catch (err) {
      console.error("Failed to reload application settings:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Couldn't load application settings.",
      );

      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      settings,
      loading,
      error,
      updating,
      updateSettings,
      retryLoadSettings,
    }),
    [settings, loading, error, updating, updateSettings, retryLoadSettings],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider.");
  }

  return context;
}
