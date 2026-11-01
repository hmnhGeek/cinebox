import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import VideoGrid from "../../components/videoGrid/VideoGrid";
import {
  getCollectionVideos,
  getAllCollectionById,
} from "../../service/collectionApi";

import "./CollectionsVideoPage.css";
import "./LibraryHero.css";
import libhero from "../../assets/libhero.jpg";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

const PAGE_SIZE = 24;
const SORT_BY = "title";
const SORT_DIRECTION = "asc";
const OBSERVER_ROOT_MARGIN = "600px 0px";

const CollectionVideosPage = () => {
  const { id } = useParams();

  const [videos, setVideos] = useState([]);
  const [collection, setCollection] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [loadError, setLoadError] = useState(null);
  const [loadMoreError, setLoadMoreError] = useState(null);

  const [totalElements, setTotalElements] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [heroImageLoaded, setHeroImageLoaded] = useState(false);

  const isMounted = useRef(false);
  const sentinelRef = useRef(null);

  // Identifies the currently active collection-loading operation.
  const requestIdRef = useRef(0);

  // Synchronous pagination guards prevent duplicate requests.
  const nextPageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);

  // Prevents the fallback scroll handler from scheduling duplicate work.
  const fallbackLoadScheduledRef = useRef(false);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  /**
   * Resets all pagination-related refs and state.
   */
  const resetPagination = useCallback(() => {
    nextPageRef.current = 1;
    hasMoreRef.current = false;
    loadingMoreRef.current = false;
    fallbackLoadScheduledRef.current = false;

    setVideos([]);
    setTotalElements(0);
    setHasMore(false);
    setLoadingMore(false);
    setLoadMoreError(null);
  }, []);

  /**
   * Loads the next page of videos.
   *
   * Used by IntersectionObserver, the fallback scroll handler,
   * and the manual retry button.
   */
  const loadNextPage = useCallback(async () => {
    if (!isMounted.current || loadingMoreRef.current || !hasMoreRef.current) {
      return;
    }

    const currentRequestId = requestIdRef.current;
    const requestedPage = nextPageRef.current;

    loadingMoreRef.current = true;

    setLoadingMore(true);
    setLoadMoreError(null);

    try {
      const pageData = await getCollectionVideos(id, {
        page: requestedPage,
        size: PAGE_SIZE,
        sortBy: SORT_BY,
        direction: SORT_DIRECTION,
      });

      // Ignore stale responses.
      if (!isMounted.current || currentRequestId !== requestIdRef.current) {
        return;
      }

      if (!pageData || !Array.isArray(pageData.content)) {
        throw new Error("Invalid paginated collection response.");
      }

      // Append only videos that are not already present.
      setVideos((currentVideos) => {
        const existingIds = new Set(
          currentVideos
            .map((video) => video?.id)
            .filter((videoId) => videoId != null),
        );

        const newVideos = pageData.content.filter((video) => {
          if (video?.id == null) {
            return true;
          }

          if (existingIds.has(video.id)) {
            return false;
          }

          existingIds.add(video.id);
          return true;
        });

        return [...currentVideos, ...newVideos];
      });

      // Advance only after a successful response.
      nextPageRef.current = requestedPage + 1;

      const nextHasMore =
        typeof pageData.last === "boolean"
          ? !pageData.last
          : typeof pageData.totalPages === "number"
            ? requestedPage + 1 < pageData.totalPages
            : pageData.content.length === PAGE_SIZE;

      hasMoreRef.current = nextHasMore;
      setHasMore(nextHasMore);

      if (typeof pageData.totalElements === "number") {
        setTotalElements(pageData.totalElements);
      }
    } catch (error) {
      if (!isMounted.current || currentRequestId !== requestIdRef.current) {
        return;
      }

      console.error("Failed to load more collection videos:", error);

      // Keep existing videos and the current page index intact.
      setLoadMoreError("Unable to load more videos. Please try again.");
    } finally {
      if (isMounted.current && currentRequestId === requestIdRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [id]);

  /**
   * Loads collection details and the first page of videos.
   */
  const loadCollection = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;

    resetPagination();

    setLoading(true);
    setLoadError(null);
    setCollection(null);
    setHeroImageLoaded(false);

    try {
      const [videoPage, currentCollection] = await Promise.all([
        getCollectionVideos(id, {
          page: 0,
          size: PAGE_SIZE,
          sortBy: SORT_BY,
          direction: SORT_DIRECTION,
        }),
        getAllCollectionById(id),
      ]);

      if (!isMounted.current || currentRequestId !== requestIdRef.current) {
        return;
      }

      if (!videoPage || !Array.isArray(videoPage.content)) {
        throw new Error("Invalid paginated collection response.");
      }

      setVideos(videoPage.content);

      const total =
        typeof videoPage.totalElements === "number"
          ? videoPage.totalElements
          : videoPage.content.length;

      setTotalElements(total);

      const nextHasMore =
        typeof videoPage.last === "boolean"
          ? !videoPage.last
          : typeof videoPage.totalPages === "number"
            ? videoPage.totalPages > 1
            : videoPage.content.length === PAGE_SIZE;

      hasMoreRef.current = nextHasMore;
      setHasMore(nextHasMore);

      // The next page after page 0 is page 1.
      nextPageRef.current = 1;

      setCollection(currentCollection || null);

      // Avoid leaving the hero skeleton visible indefinitely
      // if the collection details endpoint returns no collection.
      if (!currentCollection) {
        setHeroImageLoaded(true);
      }
    } catch (error) {
      console.error("Failed to load collection:", error);

      if (isMounted.current && currentRequestId === requestIdRef.current) {
        setLoadError("Failed to load collection. Please try again.");
      }
    } finally {
      if (isMounted.current && currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [id, resetPagination]);

  useEffect(() => {
    loadCollection();

    return () => {
      // Invalidate requests belonging to this collection.
      requestIdRef.current += 1;
    };
  }, [loadCollection]);

  /**
   * Infinite-scroll observer.
   *
   * Starts fetching before the user reaches the bottom of the grid.
   */
  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || loading || loadError || !hasMore || videos.length === 0) {
      return undefined;
    }

    if (!("IntersectionObserver" in window)) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry?.isIntersecting) {
          loadNextPage();
        }
      },
      {
        root: null,
        rootMargin: OBSERVER_ROOT_MARGIN,
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [loading, loadError, hasMore, videos.length, loadNextPage]);

  /**
   * Fallback for browsers without IntersectionObserver.
   */
  useEffect(() => {
    if (
      "IntersectionObserver" in window ||
      loading ||
      loadError ||
      !hasMore ||
      videos.length === 0
    ) {
      return undefined;
    }

    const handleScroll = () => {
      if (
        loadingMoreRef.current ||
        !hasMoreRef.current ||
        fallbackLoadScheduledRef.current
      ) {
        return;
      }

      const scrollPosition = window.innerHeight + window.scrollY;

      const threshold = document.documentElement.scrollHeight - 600;

      if (scrollPosition >= threshold) {
        fallbackLoadScheduledRef.current = true;

        loadNextPage().finally(() => {
          fallbackLoadScheduledRef.current = false;
        });
      }
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    // Also check immediately in case the page is already near its bottom.
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [loading, loadError, hasMore, videos.length, loadNextPage]);

  // Never display an image belonging to the previous collection.
  const activeCollection =
    collection && String(collection.id) === String(id) ? collection : null;

  const heroImageUrl = activeCollection
    ? `${API_BASE_URL}/api/v1/collections/hero-image?collectionId=${encodeURIComponent(
        activeCollection.id,
      )}`
    : null;

  const displayedTotal = totalElements;

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

        {/* Collection movie count */}
        {!loading && !loadError && (
          <section className="collection-results-heading">
            <div className="collection-results-title">
              <span className="collection-section-eyebrow">
                YOUR COLLECTION
              </span>
            </div>

            <div className="collection-result-count">
              <span className="collection-result-number">
                {displayedTotal.toLocaleString()}
              </span>

              <span>
                {displayedTotal === 1 ? "movie available" : "movies available"}
              </span>
            </div>
          </section>
        )}

        {loading && <div className="loading">Loading videos...</div>}

        {!loading && loadError && <div className="error">{loadError}</div>}

        {!loading && !loadError && videos.length === 0 && (
          <div className="empty-state">No videos found in this collection.</div>
        )}

        {!loading && !loadError && videos.length > 0 && (
          <>
            <VideoGrid videos={videos} collectionId={id} />

            {/* Infinite-scroll sentinel */}
            {hasMore && (
              <div
                ref={sentinelRef}
                className="collection-load-more-trigger"
                aria-hidden="true"
              />
            )}

            {/* Loading indicator for subsequent pages */}
            {loadingMore && (
              <div
                className="collection-load-more"
                role="status"
                aria-live="polite"
              >
                <span className="collection-load-more-spinner" />
                <span>Loading more titles</span>
              </div>
            )}

            {/* Retry without losing the already-loaded videos */}
            {loadMoreError && (
              <div className="collection-load-more-error" role="alert">
                <span>{loadMoreError}</span>

                <button
                  type="button"
                  className="collection-load-more-retry"
                  onClick={loadNextPage}
                  disabled={loadingMore}
                >
                  Retry
                </button>
              </div>
            )}

            {!hasMore && videos.length > 0 && (
              <div className="collection-end-message">
                You've reached the end of your collection.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default CollectionVideosPage;
