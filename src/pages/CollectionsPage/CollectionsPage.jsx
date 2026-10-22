import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, RefreshCw } from "lucide-react";
import {
  getAllCollections,
  createCollection,
  deleteCollection,
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

const CollectionsPage = () => {
  const { checkSyncInProgress, startSynchronization } = useSync();

  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCollectionModalOpen, setCollectionModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    async function loadCollections() {
      try {
        const data = await getAllCollections();
        setCollections(data);
      } catch (error) {
        console.error(error);
        setError("Failed to load collections.");
      } finally {
        setLoading(false);
      }
    }

    loadCollections();
  }, []);

  const handleCreateCollection = async (request) => {
    try {
      const collection = await createCollection(request);
      setCollections((previous) => [...previous, collection]);
      startSynchronization(collection.id, () => {}, false);
      setCollectionModalOpen(false);
    } catch (error) {
      console.error("Failed to create collection:", error);
      throw error;
    }
  };

  const handleSynchronize = (event, collection) => {
    event.preventDefault();
    event.stopPropagation();

    setOpenMenuId(null);
    startSynchronization(collection.id, () => {}, true);
  };

  const handleDeleteCollection = async (event, collection) => {
    event.preventDefault();
    event.stopPropagation();

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

      setOpenMenuId((current) => (current === collection.id ? null : current));

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
              {collections.map((collection) => (
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
                      className="collection-menu-trigger"
                      aria-label={`Options for ${collection.title}`}
                      aria-expanded={openMenuId === collection.id}
                      title="Collection options"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();

                        setOpenMenuId((current) =>
                          current === collection.id ? null : collection.id,
                        );
                      }}
                    >
                      <MoreHorizontal size={19} strokeWidth={1.8} />
                    </button>

                    {openMenuId === collection.id && (
                      <div
                        className="collection-context-menu"
                        role="menu"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="collection-menu-item"
                          role="menuitem"
                          onClick={(event) =>
                            handleSynchronize(event, collection)
                          }
                        >
                          <RefreshCw size={15} strokeWidth={1.8} />
                          <span>Synchronize collection</span>
                        </button>
                      </div>
                    )}
                  </div>

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
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default CollectionsPage;
