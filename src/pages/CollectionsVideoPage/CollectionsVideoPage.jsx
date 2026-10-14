import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import VideoGrid from "../../components/videoGrid/VideoGrid";
import {
  getCollectionVideos,
  getAllCollections,
} from "../../service/collectionApi";
import { useSync } from "../../context/SyncContext";

import "./CollectionsVideoPage.css";
import SyncModal from "../../components/SyncModal/SyncModal";

const CollectionVideosPage = () => {
  const { id } = useParams();
  const {
    syncProgress,
    isSyncModalOpen,
    setIsSyncModalOpen,
    startSynchronization,
    error,
    setError,
  } = useSync();
  const [videos, setVideos] = useState([]);
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);

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
  }, [id, setError]);

  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

  const handleSynchronize = () => {
    startSynchronization(id, () => {
      loadCollection();
    });
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
          syncProgress={syncProgress}
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
