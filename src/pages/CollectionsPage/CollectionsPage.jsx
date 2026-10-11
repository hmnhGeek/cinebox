import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllCollections,
  createCollection,
  deleteCollection,
} from "../../service/collectionApi";
import CreateCollectionModal from "../../components/CreateCollectionModal/CreateCollectionModal";
import "./CollectionsPage.css";

const CollectionsPage = () => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCollectionModalOpen, setCollectionModalOpen] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

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
      setCollectionModalOpen(false);
    } catch (error) {
      console.error("Failed to create collection:", error);
      throw error;
    }
  };

  const handleDeleteCollection = async (event, collection) => {
    event.stopPropagation();
    try {
      await deleteCollection(collection.id);

      setCollections((previous) =>
        previous.filter((item) => item.id !== collection.id),
      );
    } catch (error) {
      console.error("Failed to delete collection:", error);
      window.alert(error.message || "Failed to delete collection.");
    }
  };

  const handleCardKeyDown = (event, collectionId) => {
    if (event.target !== event.currentTarget) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate(`/collections/${collectionId}`);
    }
  };

  return (
    <div className="app">
      <CreateCollectionModal
        isOpen={isCollectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        onCreate={handleCreateCollection}
      />

      <main className="content">
        <div className="collections-heading">
          <h2>My Collections</h2>

          <button
            className="app-level-button"
            onClick={() => setCollectionModalOpen(true)}
          >
            &#43; Add Collection
          </button>
        </div>

        {loading && <div className="loading">Loading collections...</div>}

        {error && <div className="error">{error}</div>}

        {!loading && !error && collections.length === 0 && (
          <div className="empty-state">
            <div className="empty-collection-icon">▤</div>
            <h3>No collections yet</h3>
            <p>Create a collection to organize your content.</p>
          </div>
        )}

        {!loading && !error && collections.length > 0 && (
          <div className="collections-grid">
            {collections.map((collection) => (
              <div
                className="collection-card"
                key={collection.id}
                onClick={() => navigate(`/collections/${collection.id}`)}
                onKeyDown={(event) => handleCardKeyDown(event, collection.id)}
                role="button"
                tabIndex={0}
              >
                <button
                  type="button"
                  className="delete-collection-button"
                  aria-label={`Delete ${collection.title}`}
                  title="Delete collection"
                  onClick={(event) => handleDeleteCollection(event, collection)}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  &times;
                </button>

                <div className="collection-card-icon">
                  <span>▤</span>
                </div>

                <div className="collection-card-info">
                  <h3 title={collection.title}>{collection.title}</h3>

                  <p className="collection-folder" title={collection.folder}>
                    {collection.folder}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default CollectionsPage;
