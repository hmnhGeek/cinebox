import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";
import { syncCollection, getPreviewProgress } from "../service/collectionApi";

const SyncContext = createContext(null);

export const SyncProvider = ({ children }) => {
  const [syncProgress, setSyncProgress] = useState({});
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [error, setError] = useState(null);

  const isMounted = useRef(true);

  const checkSyncInProgress = useCallback(async (collectionId) => {
    const progress = await getPreviewProgress();

    return Object.keys(progress ?? {}).some((path) =>
      path.includes(String(collectionId)),
    );
  }, []);

  const startSynchronization = async (collectionId, onComplete) => {
    setIsSyncModalOpen(true);
    setSyncProgress({});
    setError(null);

    let progressTimer;

    try {
      progressTimer = window.setInterval(async () => {
        try {
          const result = await getPreviewProgress();
          setSyncProgress(result ?? {});
        } catch (err) {
          console.error("Failed to fetch preview progress:", err);
        }
      }, 1000);

      await syncCollection(collectionId);

      if (progressTimer) {
        window.clearInterval(progressTimer);
      }

      const finalResult = await getPreviewProgress();
      setSyncProgress(finalResult ?? {});

      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error(err);
      setError("Failed to synchronize collection.");
    } finally {
      if (progressTimer) {
        window.clearInterval(progressTimer);
      }
    }
  };

  return (
    <SyncContext.Provider
      value={{
        syncProgress,
        isSyncModalOpen,
        setIsSyncModalOpen,
        checkSyncInProgress,
        startSynchronization,
        error,
        setError,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
};
