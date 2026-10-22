import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, RefreshCw, Trash2, LoaderCircle } from "lucide-react";

import {
  getAllCollections,
  createCollection,
  deleteCollection,
} from "../../service/collectionApi";

import CreateCollectionModal from "../../components/CreateCollectionModal/CreateCollectionModal";
import SyncModal from "../../components/SyncModal/SyncModal";
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

const CollectionsPage = () => {
  const {
    checkSyncInProgress,
    startSynchronization,
    syncStatusByCollection,
    syncProgressByCollection,
    hasReceivedProgressByCollection,
    errorByCollection,
    isSyncModalOpen,
    setIsSyncModalOpen,
  } = useSync();

  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCollectionModalOpen, setCollectionModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [syncCollectionId, setSyncCollectionId] = useState(null);

  useEffect(() => {
    async function loadCollections() {
      try {
        const data = await getAllCollections();
        setCollections(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load collections.");
      } finally {
        setLoading(false);
      }
    }

    loadCollections();
  }, []);

  // Close the card menu when clicking elsewhere or pressing Escape.
  useEffect(() => {
    if (!openMenuId) return;

    const handlePointerDown = (event) => {
      if (!event.target.closest(".collection-card-actions")) {
        setOpenMenuId(null);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  const handleCreateCollection = async (request) => {
    try {
      const collection = await createCollection(request);
      setCollections((previous) => [...previous, collection]);

      // Catalog sync is started by the backend when the collection is created.
      // Do not start a second sync here.
      setCollectionModalOpen(false);
    } catch (err) {
      console.error("Failed to create collection:", err);
      throw err;
    }
  };

  const handleSynchronizeCollection = async (event, collection) => {
    event.preventDefault();
    event.stopPropagation();

    setOpenMenuId(null);

    const status = syncStatusByCollection[String(collection.id)];

    if (status === "QUEUED" || status === "IN_PROGRESS") {
      cineToast.error(`"${collection.title}" is already being synchronized.`, {
        title: "Synchronization in progress",
        duration: 4000,
      });
      return;
    }

    try {
      // Check the existing sync context before starting another sync.
      const isSyncing = await checkSyncInProgress(collection.id);

      if (isSyncing) {
        cineToast.error(
          `"${collection.title}" is already being synchronized.`,
          {
            title: "Synchronization in progress",
            duration: 4000,
          },
        );
        return;
      }

      setSyncCollectionId(String(collection.id));

      // Reuse the existing progress tracking and SyncModal.
      startSynchronization(collection.id, () => {}, true);
    } catch (err) {
      console.error("Failed to start collection synchronization:", err);

      cineToast.error(
        err.message || "Failed to start collection synchronization.",
        {
          title: "Synchronization failed",
          duration: 5000,
        },
      );
    }
  };

  const handleDeleteCollection = async (event, collection) => {
    event.preventDefault();
    event.stopPropagation();

    setOpenMenuId(null);

    try {
      const isSyncing = await checkSyncInProgress(collection.id);

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

      cineToast.success(`"${collection.title}" deleted successfully.`, {
        title: "Collection deleted",
      });
    } catch (err) {
      console.error("Failed to delete collection:", err);

      cineToast.error(err.message || "Failed to delete collection.", {
        title: "Couldn't delete collection",
        duration: 5000,
      });
    }
  };

  const activeSyncId = String(syncCollectionId ?? "");
  const syncStatus = syncStatusByCollection[activeSyncId] ?? "IDLE";
  const syncProgress = syncProgressByCollection[activeSyncId] ?? {};
  const hasReceivedProgress =
    hasReceivedProgressByCollection[activeSyncId] ?? false;
  const syncError = errorByCollection[activeSyncId] ?? null;

  return (
    <div className="app collections-page">
      <CreateCollectionModal
        isOpen={isCollectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        onCreate={handleCreateCollection}
      />

      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        syncProgress={syncProgress}
        syncStatus={syncStatus}
        hasReceivedProgress={hasReceivedProgress}
        error={syncError}
        collectionId={activeSyncId}
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
                const status =
                  syncStatusByCollection[String(collection.id)] ?? "IDLE";

                const isSyncing =
                  status === "QUEUED" || status === "IN_PROGRESS";

                const isMenuOpen = openMenuId === String(collection.id);

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

                    <div className="collection-card-actions">
                      <button
                        type="button"
                        className={`collection-menu-trigger ${
                          isMenuOpen ? "is-open" : ""
                        }`}
                        aria-label={`More actions for ${collection.title}`}
                        aria-haspopup="menu"
                        aria-expanded={isMenuOpen}
                        title="Collection options"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();

                          setOpenMenuId((current) =>
                            current === String(collection.id)
                              ? null
                              : String(collection.id),
                          );
                        }}
                      >
                        <MoreHorizontal size={20} strokeWidth={2} />
                      </button>

                      {isMenuOpen && (
                        <div
                          className="collection-context-menu"
                          role="menu"
                          aria-label={`${collection.title} actions`}
                        >
                          <button
                            type="button"
                            className="collection-menu-item"
                            role="menuitem"
                            disabled={isSyncing}
                            onClick={(event) =>
                              handleSynchronizeCollection(event, collection)
                            }
                          >
                            {isSyncing ? (
                              <LoaderCircle
                                size={16}
                                className="collection-menu-spinner"
                              />
                            ) : (
                              <RefreshCw size={16} />
                            )}
                            <span>
                              {isSyncing
                                ? "Synchronizing..."
                                : "Synchronize collection"}
                            </span>
                          </button>

                          <div className="collection-menu-divider" />

                          <button
                            type="button"
                            className="collection-menu-item collection-menu-item-danger"
                            role="menuitem"
                            onClick={(event) =>
                              handleDeleteCollection(event, collection)
                            }
                          >
                            <Trash2 size={16} />
                            <span>Delete collection</span>
                          </button>
                        </div>
                      )}
                    </div>
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
