import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import VideoGrid from "../../components/videoGrid/VideoGrid";
import {
  getCollectionVideos,
  getAllCollections,
  syncCollection,
  getPreviewProgress,
} from "../../service/collectionApi";

import "./CollectionsVideoPage.css";
import SyncModal from "../../components/SyncModal/SyncModal";

const CollectionVideosPage = () => {
  const { id } = useParams();

  const [videos, setVideos] = useState([]);
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncProgress, setSyncProgress] = useState({});

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadCollection = useCallback(async () => {
    if (!isMounted.current) return;
    setLoading(true);
    setError(null);

    try {
      const [videoData, collections] = await Promise.all([
        getCollectionVideos(id),
        getAllCollections(),
      ]);

      if (!isMounted.current) return;

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
      if (isMounted.current) {
        setError("Failed to load collection videos.");
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

  const handleSynchronize = async () => {
    setSyncing(true);
    setIsSyncModalOpen(true);
    setSyncProgress({});
    setSyncMessage("");
    setError(null);

    let progressTimer;

    try {
      progressTimer = window.setInterval(async () => {
        if (!isMounted.current) return;
        try {
          const result = await getPreviewProgress();
          if (isMounted.current) {
            setSyncProgress(result ?? {});
          }
        } catch (err) {
          console.error("Failed to fetch preview progress:", err);
        }
      }, 1000);

      await syncCollection(id);

      try {
        const finalResult = await getPreviewProgress();
        if (Object.entries(finalResult).length === 0) {
          if (progressTimer) {
            window.clearInterval(progressTimer);
          }
          setSyncing(false);
          setSyncMessage("Collection synchronized successfully.");
        }
        if (isMounted.current) {
          setSyncProgress(finalResult ?? {});
        }
      } catch (e) {
        // ignore final poll error
      }

      await loadCollection();
    } catch (err) {
      console.error(err);
      if (isMounted.current) {
        setError("Failed to synchronize collection.");
      }
    } finally {
      if (isMounted.current) {
        setSyncing(false);
      }
    }
  };

  return (
    <div className="app">
      <main className="content">
        {collection && (
          <div className="collection-videos-heading">
            <h2>{collection.title}</h2>

            <button className="app-level-button" onClick={handleSynchronize}>
              ⟳ Synchronize
            </button>
          </div>
        )}

        <SyncModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          syncing={syncing}
          syncProgress={syncProgress}
          syncMessage={syncMessage}
          error={error}
          collectionId={id}
        />

        {loading && <div className="loading">Loading videos...</div>}
        {error && !isSyncModalOpen && <div className="error">{error}</div>}
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
