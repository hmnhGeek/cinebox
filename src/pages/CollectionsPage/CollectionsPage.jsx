import { useEffect, useState } from "react";
import { getAllCollections } from "../../service/collectionApi";
import "./CollectionsPage.css";
import { useNavigate } from "react-router-dom";
import CreateCollectionModal from "../../components/CreateCollectionModal/CreateCollectionModal";

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
    const collection = await createCollection(request);

    // Optionally refresh your collections list here.
    console.log("Created collection:", collection);
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
            <p>Create a collection to organize your videos.</p>
          </div>
        )}

        {!loading && !error && collections.length > 0 && (
          <div className="collections-grid">
            {collections.map((collection) => (
              <div
                className="collection-card"
                key={collection.id}
                onClick={() => navigate(`/collections/${collection.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    navigate(`/collections/${collection.id}`);
                  }
                }}
                role="button"
                tabIndex={0}
              >
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
