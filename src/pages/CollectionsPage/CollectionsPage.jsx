import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import {
  getAllCollections,
  createCollection,
  deleteCollection,
  getCollectionVideos,
  getSyncStatus,
} from "../../service/collectionApi";
import {
  getMediaTechnicalInfo,
  requestMediaTechnicalInfo,
} from "../../service/mediaTechnicalInfoApi";
import CreateCollectionModal from "../../components/CreateCollectionModal/CreateCollectionModal";
import { useSync } from "../../context/SyncContext";
import cineToast from "../../components/CineToast/CineToast";
import "./CollectionsPage.css";

const MAX_TECHNICAL_INFO_ATTEMPTS = 3;
const TECHNICAL_INFO_POLL_INTERVAL = 1500;
const TECHNICAL_INFO_ATTEMPT_TIMEOUT = 15 * 60 * 1000;
const MAX_CONSECUTIVE_STATUS_ERRORS = 5;

const RETRY_DELAYS = [5000, 15000];

const CollectionIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="26"
    height="26"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3.5 6.5h6l2 2h9v10a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18.5z" />
    <path d="M3.5 9h17" />
    <path d="m10 12 5 3-5 3z" />
  </svg>
);

const SyncProgressIcon = ({ percentage = 0 }) => {
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, percentage));

  return (
    <svg
      className="sync-progress-circle"
      viewBox="0 0 24 24"
      width="21"
      height="21"
      aria-hidden="true"
    >
      <circle
        className="sync-progress-track"
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        strokeWidth="2"
      />
      <circle
        className="sync-progress-value"
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress / 100)}
      />
    </svg>
  );
};

const normalizeStatus = (status) =>
  typeof status === "string" ? status.toUpperCase() : null;

const CollectionsPage = () => {
  const { checkSyncInProgress, startSynchronization } = useSync();

  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCollectionModalOpen, setCollectionModalOpen] = useState(false);
  const [error, setError] = useState(null);

  const [activeSyncIds, setActiveSyncIds] = useState(() => new Set());
  const [syncProgress, setSyncProgress] = useState({});

  // Keep the latest state accessible to the long-running polling effect.
  const activeSyncIdsRef = useRef(activeSyncIds);
  const collectionsRef = useRef(collections);

  activeSyncIdsRef.current = activeSyncIds;
  collectionsRef.current = collections;

  // Tracks the current synchronization stage for each collection.
  const syncStagesRef = useRef(new Map());

  useEffect(() => {
    let cancelled = false;

    async function loadCollections() {
      try {
        const data = await getAllCollections();

        if (!cancelled) {
          setCollections(data);
        }
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setError("Failed to load collections.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCollections();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * This effect intentionally runs only once.
   *
   * The refs above provide the latest active collection IDs and collection
   * details without restarting existing synchronization workflows whenever
   * React state changes.
   */
  useEffect(() => {
    let cancelled = false;
    let polling = false;

    const wait = (milliseconds) =>
      new Promise((resolve) => {
        window.setTimeout(resolve, milliseconds);
      });

    const getCollectionTitle = (collectionId) => {
      return (
        collectionsRef.current.find((item) => item.id === collectionId)
          ?.title ?? "collection"
      );
    };

    const finishSynchronization = (
      collectionId,
      failed = false,
      failureMessage = null,
    ) => {
      if (cancelled) {
        return;
      }

      syncStagesRef.current.delete(collectionId);

      setSyncProgress((previous) => ({
        ...previous,
        [collectionId]: {
          status: failed ? "FAILED" : "COMPLETED",
          stage: "COMPLETED",
          percentage: 100,
        },
      }));

      setActiveSyncIds((previous) => {
        const next = new Set(previous);
        next.delete(collectionId);
        return next;
      });

      if (failed) {
        cineToast.error(
          failureMessage ||
            `Synchronization of "${getCollectionTitle(collectionId)}" completed with errors.`,
          {
            title: "Synchronization completed with errors",
            duration: 6000,
          },
        );
      }
    };

    /*
     * Processes one media item.
     *
     * A failed extraction is retried by submitting a new request.
     * Subsequent requests use force=true so that a FAILED record is not
     * incorrectly treated as a completed cached extraction.
     */
    const synchronizeMediaItem = async (mediaItemId) => {
      for (let attempt = 1; attempt <= MAX_TECHNICAL_INFO_ATTEMPTS; attempt++) {
        if (cancelled) {
          return "CANCELLED";
        }

        try {
          console.info(
            `Technical information extraction: ${mediaItemId}, attempt ${attempt}/${MAX_TECHNICAL_INFO_ATTEMPTS}`,
          );

          const response = await requestMediaTechnicalInfo(
            mediaItemId,
            attempt > 1,
          );

          let status = normalizeStatus(response?.status);

          if (status === "COMPLETED") {
            return "COMPLETED";
          }

          if (status === "FAILED") {
            throw new Error(
              response?.error || "Technical information extraction failed.",
            );
          }

          const attemptStartedAt = Date.now();
          let consecutiveStatusErrors = 0;

          /*
           * Poll only this media item while it is active.
           * A terminal FAILED status exits this loop immediately.
           */
          while (!cancelled) {
            if (
              Date.now() - attemptStartedAt >=
              TECHNICAL_INFO_ATTEMPT_TIMEOUT
            ) {
              throw new Error("Technical information extraction timed out.");
            }

            await wait(TECHNICAL_INFO_POLL_INTERVAL);

            if (cancelled) {
              return "CANCELLED";
            }

            try {
              const result = await getMediaTechnicalInfo(mediaItemId);

              consecutiveStatusErrors = 0;
              status = normalizeStatus(result?.status);

              if (status === "COMPLETED") {
                return "COMPLETED";
              }

              if (status === "FAILED") {
                throw new Error(
                  result?.error || "Technical information extraction failed.",
                );
              }

              if (status === "NOT_REQUESTED") {
                throw new Error(
                  "Technical information extraction was not started.",
                );
              }

              // QUEUED and PROCESSING are the only normal active states.
              // Unknown/null states are allowed a bounded time to resolve.
            } catch (error) {
              if (normalizeStatus(error?.message) === "FAILED") {
                throw error;
              }

              /*
               * A failed status request is not itself an extraction failure.
               * Allow a few consecutive temporary API errors before retrying
               * the extraction request.
               */
              if (
                error?.message === "Technical information extraction failed." ||
                error?.message ===
                  "Technical information extraction was not started."
              ) {
                throw error;
              }

              consecutiveStatusErrors++;

              console.error(
                `Failed to fetch technical information status for ${mediaItemId}:`,
                error,
              );

              if (consecutiveStatusErrors >= MAX_CONSECUTIVE_STATUS_ERRORS) {
                throw new Error(
                  "Unable to retrieve technical information status.",
                );
              }
            }
          }

          return "CANCELLED";
        } catch (error) {
          if (cancelled) {
            return "CANCELLED";
          }

          console.warn(
            `Technical information attempt ${attempt} failed for ${mediaItemId}:`,
            error,
          );

          if (attempt >= MAX_TECHNICAL_INFO_ATTEMPTS) {
            return "FAILED";
          }

          const retryDelay = RETRY_DELAYS[attempt - 1];

          console.info(
            `Retrying technical information extraction for ${mediaItemId} in ${retryDelay / 1000} seconds.`,
          );

          await wait(retryDelay);
        }
      }

      return "CANCELLED";
    };

    /*
     * Stage 2: process technical information jobs sequentially.
     *
     * The backend currently has one technical-info worker. Sequential
     * submission prevents the frontend from flooding its executor queue.
     */
    const synchronizeTechnicalInformation = async (collectionId) => {
      try {
        const videos = await getCollectionVideos(collectionId);

        if (cancelled) {
          return;
        }

        const mediaItemIds = [
          ...new Set(
            (Array.isArray(videos) ? videos : [])
              .map((video) => video?.id)
              .filter((id) => typeof id === "string" && id.trim()),
          ),
        ];

        if (mediaItemIds.length === 0) {
          finishSynchronization(collectionId);
          return;
        }

        syncStagesRef.current.set(collectionId, "TECHNICAL_INFO");

        setSyncProgress((previous) => ({
          ...previous,
          [collectionId]: {
            status: "IN_PROGRESS",
            stage: "TECHNICAL_INFO",
            percentage: 0,
          },
        }));

        let processedCount = 0;
        let failedCount = 0;

        for (const mediaItemId of mediaItemIds) {
          if (cancelled) {
            return;
          }

          const result = await synchronizeMediaItem(mediaItemId);

          if (result === "CANCELLED") {
            return;
          }

          processedCount++;

          if (result === "FAILED") {
            failedCount++;
          }

          const percentage = Math.round(
            (processedCount / mediaItemIds.length) * 100,
          );

          setSyncProgress((previous) => ({
            ...previous,
            [collectionId]: {
              status: "IN_PROGRESS",
              stage: "TECHNICAL_INFO",
              percentage,
            },
          }));
        }

        if (cancelled) {
          return;
        }

        if (failedCount > 0) {
          finishSynchronization(
            collectionId,
            true,
            `Technical information synchronization completed with ${failedCount} failed out of ${mediaItemIds.length} movies in "${getCollectionTitle(collectionId)}".`,
          );
        } else {
          finishSynchronization(collectionId);
        }
      } catch (error) {
        console.error(
          `Failed to synchronize technical information for collection ${collectionId}:`,
          error,
        );

        finishSynchronization(
          collectionId,
          true,
          `Catalog synchronization completed, but technical information synchronization could not be completed for "${getCollectionTitle(collectionId)}".`,
        );
      }
    };

    const pollSyncStatus = async () => {
      if (polling || cancelled) {
        return;
      }

      polling = true;

      try {
        const collectionIds = [...activeSyncIdsRef.current];

        await Promise.all(
          collectionIds.map(async (collectionId) => {
            if (cancelled) {
              return;
            }

            const stage = syncStagesRef.current.get(collectionId) || "CATALOG";

            /*
             * Stage 1: catalog synchronization.
             */
            if (stage === "CATALOG") {
              try {
                const result = await getSyncStatus(collectionId);

                if (cancelled) {
                  return;
                }

                const percentage = Number.isFinite(result.percentage)
                  ? Math.min(100, Math.max(0, result.percentage))
                  : 0;

                setSyncProgress((previous) => ({
                  ...previous,
                  [collectionId]: {
                    status: result.status,
                    stage: "CATALOG",
                    percentage,
                  },
                }));

                if (result.status === "FAILED") {
                  finishSynchronization(
                    collectionId,
                    true,
                    `Failed to synchronize "${getCollectionTitle(collectionId)}". Please try again.`,
                  );

                  return;
                }

                if (result.status === "COMPLETED") {
                  /*
                   * Change stage before making further requests.
                   * This prevents duplicate technical-info workflows.
                   */
                  syncStagesRef.current.set(
                    collectionId,
                    "TECHNICAL_INFO_STARTING",
                  );

                  setSyncProgress((previous) => ({
                    ...previous,
                    [collectionId]: {
                      status: "IN_PROGRESS",
                      stage: "TECHNICAL_INFO_STARTING",
                      percentage: 0,
                    },
                  }));

                  await synchronizeTechnicalInformation(collectionId);
                }
              } catch (error) {
                // Retry catalog status polling on the next interval.
                console.error(
                  `Failed to fetch sync status for collection ${collectionId}:`,
                  error,
                );
              }
            }
          }),
        );
      } finally {
        polling = false;
      }
    };

    pollSyncStatus();

    const intervalId = window.setInterval(pollSyncStatus, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleCreateCollection = async (request) => {
    try {
      const collection = await createCollection(request);

      setCollections((previous) => [...previous, collection]);

      // Collection creation already starts catalog sync on the backend.
      setCollectionModalOpen(false);
    } catch (error) {
      console.error("Failed to create collection:", error);
      throw error;
    }
  };

  const handleSynchronize = (event, collection) => {
    event.preventDefault();
    event.stopPropagation();

    if (activeSyncIds.has(collection.id)) {
      return;
    }

    syncStagesRef.current.set(collection.id, "CATALOG");

    setSyncProgress((previous) => ({
      ...previous,
      [collection.id]: {
        status: "QUEUED",
        stage: "CATALOG",
        percentage: 0,
      },
    }));

    setActiveSyncIds((previous) => {
      const next = new Set(previous);
      next.add(collection.id);
      return next;
    });

    try {
      // false avoids opening the existing synchronization modal.
      startSynchronization(collection.id, () => {}, false);
    } catch (error) {
      console.error("Failed to start collection synchronization:", error);

      syncStagesRef.current.delete(collection.id);

      setActiveSyncIds((previous) => {
        const next = new Set(previous);
        next.delete(collection.id);
        return next;
      });

      cineToast.error("Failed to start collection synchronization.", {
        title: "Synchronization failed",
        duration: 5000,
      });
    }
  };

  const handleDeleteCollection = async (event, collection) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      const isLocallySyncing = activeSyncIds.has(collection.id);

      const isSyncing =
        isLocallySyncing || (await checkSyncInProgress(collection.id));

      if (isSyncing) {
        cineToast.error(
          `Cannot delete "${collection.title}" while synchronization is in progress.`,
          {
            title: "Collection is busy",
            duration: 5000,
          },
        );

        return;
      }

      await deleteCollection(collection.id);

      setCollections((previous) =>
        previous.filter((item) => item.id !== collection.id),
      );

      syncStagesRef.current.delete(collection.id);

      setSyncProgress((previous) => {
        const next = { ...previous };
        delete next[collection.id];
        return next;
      });

      cineToast.success(`"${collection.title}" deleted successfully.`, {
        title: "Collection deleted",
      });
    } catch (error) {
      console.error("Failed to delete collection:", error);

      cineToast.error(error.message || "Failed to delete collection.", {
        title: "Couldn't delete collection",
        duration: 5000,
      });
    }
  };

  return (
    <div className="app collections-page">
      <CreateCollectionModal
        isOpen={isCollectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        onCreate={handleCreateCollection}
      />

      <main className="content collections-content">
        <header className="collections-heading">
          <div className="collections-heading-copy">
            <span className="collections-eyebrow">YOUR LIBRARY</span>
            <p>All your content, organized your way.</p>
          </div>

          <button
            type="button"
            className="app-level-button collections-add-button"
            onClick={() => setCollectionModalOpen(true)}
          >
            <span className="add-button-icon" aria-hidden="true">
              +
            </span>
            <span>Add Collection</span>
          </button>
        </header>

        {loading && (
          <div className="collections-message" role="status">
            <span className="collections-loader" aria-hidden="true" />
            <p>Loading your collections...</p>
          </div>
        )}

        {!loading && error && (
          <div className="collections-message collections-error" role="alert">
            <span className="message-symbol" aria-hidden="true">
              !
            </span>
            <h3>Couldn't load collections</h3>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && collections.length === 0 && (
          <section className="collections-empty">
            <div className="empty-icon-tile">
              <CollectionIcon />
            </div>

            <h2>Your library starts here</h2>

            <p>
              Create your first collection to bring your movie library together
              in one place.
            </p>

            <button
              type="button"
              className="app-level-button collections-empty-button"
              onClick={() => setCollectionModalOpen(true)}
            >
              <span aria-hidden="true">+</span>
              Create your first collection
            </button>
          </section>
        )}

        {!loading && !error && collections.length > 0 && (
          <section
            className="collections-section"
            aria-label="Your collections"
          >
            <div className="collections-section-heading">
              <h2>All collections</h2>

              <span className="collections-count">
                {collections.length}{" "}
                {collections.length === 1 ? "collection" : "collections"}
              </span>
            </div>

            <div className="collections-grid">
              {collections.map((collection) => {
                const isSyncing = activeSyncIds.has(collection.id);

                const percentage = syncProgress[collection.id]?.percentage ?? 0;

                const syncStage = syncProgress[collection.id]?.stage;

                const syncStageLabel =
                  syncStage === "TECHNICAL_INFO" ||
                  syncStage === "TECHNICAL_INFO_STARTING"
                    ? "Synchronizing technical information"
                    : "Synchronizing collection";

                return (
                  <article className="collection-card" key={collection.id}>
                    <Link
                      className="collection-card-link"
                      to={`/collections/${collection.id}`}
                      aria-label={`Open collection ${collection.title}`}
                    >
                      <div className="collection-card-top">
                        <div className="collection-card-icon">
                          <CollectionIcon />
                        </div>
                      </div>

                      <div className="collection-card-info">
                        <h3 title={collection.title}>{collection.title}</h3>

                        <p
                          className="collection-folder"
                          title={collection.folder}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H10l2 2h7.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
                          </svg>

                          <span>{collection.folder}</span>
                        </p>
                      </div>
                    </Link>

                    <button
                      type="button"
                      className={`synchronize-collection-button${isSyncing ? " is-syncing" : ""}`}
                      aria-label={
                        isSyncing
                          ? `${syncStageLabel} for ${collection.title}: ${percentage}%`
                          : `Synchronize ${collection.title}`
                      }
                      aria-busy={isSyncing}
                      title={
                        isSyncing
                          ? `${syncStageLabel}: ${percentage}%`
                          : "Synchronize collection"
                      }
                      disabled={isSyncing}
                      onClick={(event) => handleSynchronize(event, collection)}
                    >
                      {isSyncing ? (
                        <SyncProgressIcon percentage={percentage} />
                      ) : (
                        <RefreshCw size={17} strokeWidth={1.7} />
                      )}
                    </button>

                    <button
                      type="button"
                      className="delete-collection-button"
                      aria-label={`Delete ${collection.title}`}
                      title="Delete collection"
                      onClick={(event) =>
                        handleDeleteCollection(event, collection)
                      }
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="17"
                        height="17"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M4 7h16M10 11v6m4-6v6M5.5 7l1 13h11l1-13M9 7V4h6v3" />
                      </svg>
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default CollectionsPage;
