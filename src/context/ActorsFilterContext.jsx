import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { useSettings } from "./SettingsContext";

const ActorsFilterContext = createContext(null);

export function ActorsFilterProvider({ children }) {
  const location = useLocation();
  const navigationType = useNavigationType();

  const { settings, loading: settingsLoading } = useSettings();

  const previousPathRef = useRef(location.pathname);

  const [hasProfileImage, setHasProfileImageState] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const isActorsPage = location.pathname === "/actors";
    const wasActorsPage = previousPathRef.current === "/actors";

    if (!isActorsPage) {
      if (wasActorsPage) {
        setInitialized(false);
      }

      previousPathRef.current = location.pathname;
      return;
    }

    // Wait until the saved application preference is available.
    if (settingsLoading) {
      return;
    }

    // Initialize when entering the Actors page.
    // Also restore the filter when browser Back/Forward is used.
    //
    // Ordinary query-string changes (such as manually toggling the filter)
    // must not overwrite the user's current selection.
    const shouldRestoreFilter =
      !wasActorsPage || !initialized || navigationType === "POP";

    if (shouldRestoreFilter) {
      const params = new URLSearchParams(location.search);

      const nextValue = params.has("hasProfileImage")
        ? params.get("hasProfileImage") === "true"
        : settings.discovery.actors.showOnlyWithProfile;

      setHasProfileImageState(nextValue);
      setInitialized(true);
    }

    previousPathRef.current = location.pathname;
  }, [
    location.pathname,
    location.search,
    navigationType,
    settingsLoading,
    settings.discovery.actors.showOnlyWithProfile,
    initialized,
  ]);

  const setHasProfileImage = useCallback((value) => {
    setHasProfileImageState((current) =>
      typeof value === "function" ? value(current) : Boolean(value),
    );
  }, []);

  return (
    <ActorsFilterContext.Provider
      value={{
        hasProfileImage,
        setHasProfileImage,
        initialized,
      }}
    >
      {children}
    </ActorsFilterContext.Provider>
  );
}

export function useActorsFilter() {
  const context = useContext(ActorsFilterContext);

  if (!context) {
    throw new Error(
      "useActorsFilter must be used within an ActorsFilterProvider.",
    );
  }

  return context;
}
