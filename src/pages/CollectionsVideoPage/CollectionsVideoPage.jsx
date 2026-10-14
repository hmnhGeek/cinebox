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

const CollectionVideosPage = () => {
  const { id } = useParams();

  const [videos, setVideos] = useState([]);
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncProgress, setSyncProgress] = useState({});

  // Track component mounted state to prevent memory leaks & state updates on unmount
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
    setSyncProgress({});
    setSyncMessage("");
    setError(null);

    let progressTimer;

    try {
      // 1. Start polling immediately
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

      // 2. Trigger the synchronization
      await syncCollection(id);

      // Optional: Fetch one last time to ensure 100% state is captured
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
        {syncing && (
          <div className="sync-progress-container">
            <div className="sync-progress-heading">
              <span>Generating video previews...</span>
            </div>

            {Object.entries(syncProgress).map(([path, progress]) => {
              const percentage = Math.min(100, Math.max(0, progress));

              // Display the movie folder name instead of the full Windows/Unix path.
              const videoName = path.split(/[\\/]/).slice(-2, -1)[0] || path;

              return (
                <div className="sync-progress-item" key={path}>
                  <div className="sync-progress-info">
                    <span title={path}>{videoName}</span>
                    <span>{percentage}%</span>
                  </div>

                  <div
                    className="sync-progress-track"
                    role="progressbar"
                    aria-label={`Preview generation progress for ${videoName}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percentage}
                  >
                    <div
                      className="sync-progress-fill"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
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
