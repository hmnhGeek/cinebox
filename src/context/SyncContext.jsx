import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";

import {
  syncCollection,
  getPreviewProgress,
  getSyncStatus,
} from "../service/collectionApi";

const SyncContext = createContext(null);

const ACTIVE_STATUSES = ["QUEUED", "IN_PROGRESS"];

export const SyncProvider = ({ children }) => {
  const [syncStatusByCollection, setSyncStatusByCollection] = useState({});
  const [syncProgressByCollection, setSyncProgressByCollection] = useState({});
  const [hasReceivedProgressByCollection, setHasReceivedProgressByCollection] =
    useState({});
  const [errorByCollection, setErrorByCollection] = useState({});
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Each collection gets its own polling timer and in-flight guard.
  const timersRef = useRef(new Map());
  const pollingRef = useRef(new Set());

  const stopPolling = useCallback((collectionId) => {
    const key = String(collectionId);
    const timer = timersRef.current.get(key);

    if (timer !== undefined) {
      window.clearInterval(timer);
      timersRef.current.delete(key);
    }

    pollingRef.current.delete(key);
  }, []);

  const checkSyncInProgress = useCallback(async (collectionId) => {
    try {
      const response = await getSyncStatus(collectionId);
      return ACTIVE_STATUSES.includes(response?.status);
    } catch (err) {
      console.error("Failed to check sync status:", err);
      // Fail safely if status cannot be verified.
      return true;
    }
  }, []);

  const startSynchronization = useCallback(
    async (collectionId, onComplete, openModal) => {
      const key = String(collectionId);

      // Restart polling only for this collection.
      stopPolling(key);

      setIsSyncModalOpen(openModal);

      setSyncStatusByCollection((prev) => ({
        ...prev,
        [key]: "QUEUED",
      }));

      setSyncProgressByCollection((prev) => ({
        ...prev,
        [key]: {},
      }));

      setHasReceivedProgressByCollection((prev) => ({
        ...prev,
        [key]: false,
      }));

      setErrorByCollection((prev) => ({
        ...prev,
        [key]: null,
      }));

      let finished = false;

      const pollStatus = async () => {
        if (pollingRef.current.has(key) || finished) return;

        pollingRef.current.add(key);

        try {
          const response = await getSyncStatus(key);
          const status = response?.status;

          if (!status) {
            throw new Error("Sync-status response has no status.");
          }

          setSyncStatusByCollection((prev) => ({
            ...prev,
            [key]: status,
          }));

          if (status === "FAILED") {
            finished = true;
            stopPolling(key);

            setErrorByCollection((prev) => ({
              ...prev,
              [key]: "Synchronization failed. Please try again.",
            }));

            return;
          }

          if (status === "COMPLETED") {
            finished = true;
            stopPolling(key);

            setSyncProgressByCollection((prev) => ({
              ...prev,
              [key]: {},
            }));

            setHasReceivedProgressByCollection((prev) => ({
              ...prev,
              [key]: true,
            }));

            try {
              await onComplete?.();
            } catch (err) {
              console.error("Failed to refresh collection:", err);
            }

            return;
          }

          if (ACTIVE_STATUSES.includes(status)) {
            const result = (await getPreviewProgress()) ?? {};

            setHasReceivedProgressByCollection((prev) => ({
              ...prev,
              [key]: true,
            }));

            // Preserve your current progress-key convention.
            const collectionProgress = Object.fromEntries(
              Object.entries(result).filter(([path]) => path.includes(key)),
            );

            // Don't erase the previous progress during an empty response.
            if (Object.keys(collectionProgress).length > 0) {
              setSyncProgressByCollection((prev) => ({
                ...prev,
                [key]: collectionProgress,
              }));
            }
          }
        } catch (err) {
          console.error(`Failed to poll collection ${key}:`, err);
          // Keep polling after transient network errors.
        } finally {
          pollingRef.current.delete(key);
        }
      };

      try {
        await syncCollection(key);
        await pollStatus();

        if (!finished) {
          const timer = window.setInterval(pollStatus, 1000);
          timersRef.current.set(key, timer);
        }
      } catch (err) {
        console.error(`Failed to start sync for ${key}:`, err);

        finished = true;
        stopPolling(key);

        setSyncStatusByCollection((prev) => ({
          ...prev,
          [key]: "FAILED",
        }));

        setErrorByCollection((prev) => ({
          ...prev,
          [key]: "Failed to start synchronization. Please try again.",
        }));
      }
    },
    [stopPolling],
  );

  return (
    <SyncContext.Provider
      value={{
        syncStatusByCollection,
        syncProgressByCollection,
        hasReceivedProgressByCollection,
        errorByCollection,
        isSyncModalOpen,
        setIsSyncModalOpen,
        checkSyncInProgress,
        startSynchronization,
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
