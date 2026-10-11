import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import VideoGrid from "../../components/videoGrid/VideoGrid";
import {
  getCollectionVideos,
  getAllCollections,
  syncCollection,
} from "../../service/collectionApi";

import "./CollectionsVideoPage.css";

const CollectionVideosPage = () => {
  const { id } = useParams();

  const [videos, setVideos] = useState([]);
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [syncMessage, setSyncMessage] = useState("");

  const loadCollection = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [videoData, collections] = await Promise.all([
        getCollectionVideos(id),
        getAllCollections(),
      ]);

      setVideos(videoData);

      const currentCollection = collections.find(
        (item) => String(item.id) === String(id),
      );

      if (!currentCollection) {
        setError("Collection not found.");
        setCollection(null);
        return;
      }

      setCollection(currentCollection);
    } catch (err) {
      console.error(err);
      setError("Failed to load collection videos.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

  const handleSynchronize = async () => {
    setSyncing(true);
    setSyncMessage("");
    setError(null);

    try {
      await syncCollection(id);
      await loadCollection();
      setSyncMessage("Collection synchronized successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to synchronize collection.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="app">
      <main className="content">
        {collection && (
          <div className="collection-videos-heading">
            <h2>{collection.title}</h2>

            <button
              className="app-level-button"
              onClick={handleSynchronize}
              disabled={syncing || loading}
            >
              {syncing ? "Synchronizing..." : "⟳ Synchronize"}
            </button>
          </div>
        )}

        {syncMessage && <div className="success">{syncMessage}</div>}

        {loading && <div className="loading">Loading videos...</div>}

        {error && <div className="error">{error}</div>}

        {!loading && !error && videos.length === 0 && (
          <div className="empty-state">No videos found in this collection.</div>
        )}

        {!loading && !error && videos.length > 0 && (
          <VideoGrid videos={videos} collectionId={id} />
        )}
      </main>
    </div>
  );
};

export default CollectionVideosPage;
