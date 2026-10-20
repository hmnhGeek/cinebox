import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import VideoGrid from "../../components/videoGrid/VideoGrid";
import {
  getCollectionVideos,
  getAllCollectionById,
} from "../../service/collectionApi";
import { useSync } from "../../context/SyncContext";
import SyncModal from "../../components/SyncModal/SyncModal";

import "./CollectionsVideoPage.css";
import "./LibraryHero.css";
import libhero from "../../assets/libhero.jpg";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");

const CollectionVideosPage = () => {
  const { id } = useParams();

  const {
    syncStatusByCollection,
    syncProgressByCollection,
    hasReceivedProgressByCollection,
    errorByCollection,
    isSyncModalOpen,
    setIsSyncModalOpen,
    startSynchronization,
  } = useSync();

  const syncStatus = syncStatusByCollection[String(id)] ?? "IDLE";
  const syncProgress = syncProgressByCollection[String(id)] ?? {};
  const hasReceivedProgress =
    hasReceivedProgressByCollection[String(id)] ?? false;
  const error = errorByCollection[String(id)] ?? null;

  const [videos, setVideos] = useState([]);
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);

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
    setCollection(null);
    setHeroImageLoaded(false);

    try {
      const [videoData, currentCollection] = await Promise.all([
        getCollectionVideos(id),
        getAllCollectionById(id),
      ]);

      if (!isMounted.current) return;

      setVideos(videoData);

      if (!currentCollection) {
        setCollection(null);
        return;
      }

      setCollection(currentCollection);
    } catch (err) {
      console.error("Failed to load collection:", err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

  const handleSynchronize = () => {
    startSynchronization(id, loadCollection, true);
  };

  // Never display an image belonging to the previous collection.
  const activeCollection =
    collection && String(collection.id) === String(id) ? collection : null;

  const heroImageUrl = activeCollection
    ? `${API_BASE_URL}/api/v1/collections/hero-image?collectionId=${encodeURIComponent(
        activeCollection.id,
      )}`
    : null;

  return (
    <div className="app">
      <main className="content">
        <section
          className={`library-hero ${
            heroImageLoaded ? "hero-ready" : "hero-loading"
          }`}
        >
          {heroImageUrl && (
            <img
              key={heroImageUrl}
              className={`library-hero-image ${
                heroImageLoaded ? "loaded" : "loading"
              }`}
              src={heroImageUrl}
              onLoad={() => setHeroImageLoaded(true)}
              onError={(event) => {
                const image = event.currentTarget;

                if (image.dataset.fallback !== "true") {
                  image.dataset.fallback = "true";
                  image.src = libhero;
                } else {
                  image.style.visibility = "hidden";
                  setHeroImageLoaded(true);
                }
              }}
              alt=""
            />
          )}

          {!heroImageLoaded && (
            <div className="library-hero-skeleton">
              <div className="hero-skeleton-content">
                <div className="hero-skeleton-eyebrow" />
                <div className="hero-skeleton-title" />
                <div className="hero-skeleton-tagline" />
                <div className="hero-skeleton-divider" />
              </div>

              <div className="hero-skeleton-bottom">
                <span className="hero-skeleton-label" />
                <span className="hero-skeleton-label hero-skeleton-label-short" />
              </div>

              <div className="hero-skeleton-status">
                <span className="hero-skeleton-spinner" />
                <span>Preparing your collection</span>
              </div>
            </div>
          )}

          <div className="library-hero-overlay" />

          {heroImageLoaded && (
            <>
              <div className="library-hero-content">
                <span className="library-hero-eyebrow">
                  YOUR PERSONAL COLLECTION
                </span>

                <h1>{activeCollection?.title || "Collection"}</h1>

                <p>
                  {activeCollection?.tagline ||
                    "Every story worth watching, all in one place."}
                </p>

                <div className="library-hero-divider" />
              </div>

              <div className="library-hero-bottom">
                <span>CURATED FOR YOUR VIEWING PLEASURE</span>
                <span className="library-hero-scroll">SCROLL TO EXPLORE ↓</span>
              </div>
            </>
          )}
        </section>

        {activeCollection && (
          <div className="collection-videos-heading">
            <button className="app-level-button" onClick={handleSynchronize}>
              {syncStatus === "QUEUED" || syncStatus === "IN_PROGRESS" ? (
                <>
                  <LoaderCircle className="syncing-button-loader" size={21} />
                  Synchronizing...
                </>
              ) : (
                <>⟳ Synchronize</>
              )}
            </button>
          </div>
        )}

        <SyncModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          syncProgress={syncProgress}
          syncStatus={syncStatus}
          hasReceivedProgress={hasReceivedProgress}
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
