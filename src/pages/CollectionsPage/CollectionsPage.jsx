import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import {
  getAllCollections,
  createCollection,
  deleteCollection,
  getSyncStatus,
} from "../../service/collectionApi";
import CreateCollectionModal from "../../components/CreateCollectionModal/CreateCollectionModal";
import { useSync } from "../../context/SyncContext";
import cineToast from "../../components/CineToast/CineToast";
import "./CollectionsPage.css";

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

const CollectionsPage = () => {
  const { checkSyncInProgress, startSynchronization } = useSync();

  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCollectionModalOpen, setCollectionModalOpen] = useState(false);
  const [error, setError] = useState(null);

  const [activeSyncIds, setActiveSyncIds] = useState(() => new Set());
  const [syncProgress, setSyncProgress] = useState({});

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

  // Poll catalog sync status while a card is synchronizing.
  useEffect(() => {
    if (activeSyncIds.size === 0) {
      return;
    }

    let cancelled = false;
    let polling = false;

    const pollSyncStatus = async () => {
      if (polling) {
        return;
      }

      polling = true;

      try {
        await Promise.all(
          [...activeSyncIds].map(async (collectionId) => {
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
                  percentage,
                },
              }));

              if (result.status === "COMPLETED" || result.status === "FAILED") {
                setActiveSyncIds((previous) => {
                  const next = new Set(previous);
                  next.delete(collectionId);
                  return next;
                });

                if (result.status === "FAILED") {
                  const collection = collections.find(
                    (item) => item.id === collectionId,
                  );

                  cineToast.error(
                    `Failed to synchronize "${collection?.title ?? "collection"}". Please try again.`,
                    {
                      title: "Synchronization failed",
                      duration: 5000,
                    },
                  );
                }
              }
            } catch (error) {
              // Keep the button disabled and retry if a status request fails.
              console.error(
                `Failed to fetch sync status for collection ${collectionId}:`,
                error,
              );
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
  }, [activeSyncIds, collections]);

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

    setSyncProgress((previous) => ({
      ...previous,
      [collection.id]: {
        status: "QUEUED",
        percentage: 0,
      },
    }));

    // Disable the button immediately, before the first status response.
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
                          ? `Synchronizing ${collection.title}: ${percentage}%`
                          : `Synchronize ${collection.title}`
                      }
                      aria-busy={isSyncing}
                      title={
                        isSyncing
                          ? `Synchronizing: ${percentage}%`
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
