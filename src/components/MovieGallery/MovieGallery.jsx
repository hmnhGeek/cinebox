import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getGalleryImages,
  resolveGalleryImageUrl,
} from "../../service/galleryApi";
import "./MovieGallery.css";

const PAGE_SIZE = 20;

function MovieGallery({ collectionId, mediaItemId }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasNext, setHasNext] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [failedImages, setFailedImages] = useState(() => new Set());

  const trackRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const nextPageRef = useRef(1);
  const requestIdRef = useRef(0);
  const touchStartXRef = useRef(null);

  const selectedImage =
    selectedIndex >= 0 ? (images[selectedIndex] ?? null) : null;

  const loadMore = useCallback(async () => {
    if (!hasNext || loadingMoreRef.current || !collectionId || !mediaItemId) {
      return 0;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError("");

    try {
      const data = await getGalleryImages(
        collectionId,
        mediaItemId,
        nextPageRef.current,
        PAGE_SIZE,
      );

      const newImages = Array.isArray(data.images) ? data.images : [];
      let addedCount = 0;

      setImages((current) => {
        const knownIds = new Set(current.map((image) => image.id));
        const uniqueNewImages = newImages.filter(
          (image) => !knownIds.has(image.id),
        );

        addedCount = uniqueNewImages.length;
        return [...current, ...uniqueNewImages];
      });

      nextPageRef.current = data.page + 1;
      setHasNext(Boolean(data.hasNext));

      return addedCount;
    } catch (err) {
      console.error("Failed to load more gallery images:", err);
      setError("Couldn't load more images. Please try again.");
      return 0;
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [collectionId, mediaItemId, hasNext]);

  const loadGallery = useCallback(
    async (signal, requestId) => {
      try {
        const data = await getGalleryImages(
          collectionId,
          mediaItemId,
          0,
          PAGE_SIZE,
          signal,
        );

        if (signal.aborted || requestId !== requestIdRef.current) {
          return;
        }

        setImages(Array.isArray(data.images) ? data.images : []);
        setHasNext(Boolean(data.hasNext));
        nextPageRef.current = 1;
      } catch (err) {
        if (err.name !== "AbortError" && requestId === requestIdRef.current) {
          console.error("Failed to load gallery:", err);
          setError("The gallery couldn't be loaded.");
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [collectionId, mediaItemId],
  );

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;

    setImages([]);
    setLoading(true);
    setLoadingMore(false);
    setError("");
    setHasNext(false);
    setSelectedIndex(-1);
    setFailedImages(new Set());

    nextPageRef.current = 1;
    loadingMoreRef.current = false;

    if (collectionId && mediaItemId) {
      loadGallery(controller.signal, requestId);
    } else {
      setLoading(false);
    }

    return () => controller.abort();
  }, [collectionId, mediaItemId, loadGallery]);

  // Fetch another page as the user approaches the end of the thumbnail strip.
  const handleTrackScroll = useCallback(() => {
    const track = trackRef.current;

    if (!track || !hasNext || loadingMoreRef.current) return;

    const remaining = track.scrollWidth - track.scrollLeft - track.clientWidth;

    if (remaining < track.clientWidth * 1.5) {
      loadMore();
    }
  }, [hasNext, loadMore]);

  const closeLightbox = useCallback(() => {
    setSelectedIndex(-1);
  }, []);

  // Do not wrap to the last image when the first image is selected.
  const showPrevious = useCallback(() => {
    setSelectedIndex((current) => (current > 0 ? current - 1 : current));
  }, []);

  // Load the next page when the user reaches the last currently loaded image.
  const showNext = useCallback(async () => {
    if (selectedIndex < 0 || loadingMoreRef.current) return;

    if (selectedIndex < images.length - 1) {
      setSelectedIndex((current) => current + 1);
      return;
    }

    if (hasNext) {
      const previousLength = images.length;
      const addedCount = await loadMore();

      if (addedCount > 0) {
        setSelectedIndex(previousLength);
      }
    }
  }, [selectedIndex, images.length, hasNext, loadMore]);

  // Keyboard controls and background scroll locking for the lightbox.
  useEffect(() => {
    if (!selectedImage) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedImage, closeLightbox, showPrevious, showNext]);

  // Preload adjacent images without wrapping around the gallery.
  useEffect(() => {
    if (selectedIndex < 0 || images.length < 2) return;

    const adjacent = [
      selectedIndex < images.length - 1 ? images[selectedIndex + 1] : null,
      selectedIndex > 0 ? images[selectedIndex - 1] : null,
    ];

    adjacent.forEach((image) => {
      if (!image) return;

      const preload = new Image();
      preload.src = resolveGalleryImageUrl(image.url);
    });
  }, [selectedIndex, images]);

  const markImageFailed = useCallback((id) => {
    setFailedImages((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX;

    if (startX == null || endX == null) return;

    const difference = endX - startX;

    if (Math.abs(difference) > 45) {
      if (difference > 0) {
        showPrevious();
      } else {
        showNext();
      }
    }

    touchStartXRef.current = null;
  };

  const isFirstImage = selectedIndex <= 0;
  const isLastImage = selectedIndex === images.length - 1 && !hasNext;

  // Render the lightbox directly under document.body.
  const lightbox = selectedImage
    ? createPortal(
        <div
          className="movie-gallery-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Gallery image viewer"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeLightbox();
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            className="movie-gallery-lightbox-arrow movie-gallery-lightbox-arrow-previous"
            onClick={showPrevious}
            disabled={isFirstImage}
            aria-label="Previous gallery image"
            style={{
              position: "absolute",
              left: "clamp(12px, 3vw, 36px)",
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 2,
              display: "grid",
              placeItems: "center",
              width: 48,
              height: 48,
              border: "1px solid rgba(196, 166, 106, 0.45)",
              borderRadius: "50%",
              background: "rgba(28, 27, 25, 0.88)",
              color: "#dec58e",
              cursor: isFirstImage ? "not-allowed" : "pointer",
              opacity: isFirstImage ? 0.35 : 1,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <img
            className="movie-gallery-lightbox-image"
            src={resolveGalleryImageUrl(selectedImage.url)}
            alt={selectedImage.filename || "Gallery image"}
            onMouseDown={(event) => event.stopPropagation()}
            onError={() => markImageFailed(selectedImage.id)}
          />

          <button
            type="button"
            className="movie-gallery-lightbox-arrow movie-gallery-lightbox-arrow-next"
            onClick={showNext}
            disabled={loadingMore || isLastImage}
            aria-label={
              loadingMore ? "Loading next gallery images" : "Next gallery image"
            }
            style={{
              position: "absolute",
              right: "clamp(12px, 3vw, 36px)",
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 2,
              display: "grid",
              placeItems: "center",
              width: 48,
              height: 48,
              border: "1px solid rgba(196, 166, 106, 0.45)",
              borderRadius: "50%",
              background: "rgba(28, 27, 25, 0.88)",
              color: "#dec58e",
              cursor: loadingMore || isLastImage ? "not-allowed" : "pointer",
              opacity: loadingMore || isLastImage ? 0.35 : 1,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>,
        document.body,
      )
    : null;

  // Hide the entire section, including its heading, when no images exist.
  if (!loading && images.length === 0 && !error) {
    return null;
  }

  return (
    <>
      <div className="detail-section movie-gallery-section">
        <h2>Frames and Stills</h2>

        <section className="movie-gallery" aria-label="Movie gallery">
          <div className="movie-gallery-heading">
            <div className="movie-gallery-count">
              {loading ? (
                "Loading images..."
              ) : (
                <>
                  <span className="count-number">
                    {images.length}
                    {hasNext ? "+" : ""}
                  </span>
                  {images.length === 1 ? "Frame" : "Frames"}
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="movie-gallery-controls">
                <button
                  type="button"
                  className="movie-gallery-arrow"
                  onClick={() =>
                    trackRef.current?.scrollBy({
                      left: -trackRef.current.clientWidth * 0.75,
                      behavior: "smooth",
                    })
                  }
                  aria-label="Scroll gallery left"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="movie-gallery-arrow"
                  onClick={() =>
                    trackRef.current?.scrollBy({
                      left: trackRef.current.clientWidth * 0.75,
                      behavior: "smooth",
                    })
                  }
                  aria-label="Scroll gallery right"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {error && images.length === 0 ? (
            <div className="movie-gallery-message" role="status">
              <p>{error}</p>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setLoading(true);

                  const controller = new AbortController();
                  const requestId = ++requestIdRef.current;

                  loadGallery(controller.signal, requestId);
                }}
              >
                Try again
              </button>
            </div>
          ) : (
            <div
              ref={trackRef}
              className="movie-gallery-track"
              onScroll={handleTrackScroll}
              aria-busy={loading || loadingMore}
            >
              {loading &&
                Array.from({ length: 4 }, (_, index) => (
                  <div
                    className="movie-gallery-skeleton"
                    key={`gallery-skeleton-${index}`}
                    aria-hidden="true"
                  />
                ))}

              {images.map((image, index) => {
                if (failedImages.has(image.id)) return null;

                return (
                  <button
                    type="button"
                    className="movie-gallery-card"
                    key={image.id}
                    onClick={() => setSelectedIndex(index)}
                    aria-label={`View image ${index + 1}: ${image.filename}`}
                  >
                    <img
                      src={resolveGalleryImageUrl(image.url)}
                      alt={image.filename || `Gallery image ${index + 1}`}
                      loading={index < 4 ? "eager" : "lazy"}
                      decoding="async"
                      onError={() => markImageFailed(image.id)}
                    />

                    <span className="movie-gallery-card-overlay">
                      <span className="movie-gallery-expand" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" />
                        </svg>
                      </span>
                    </span>
                  </button>
                );
              })}

              {loadingMore && (
                <div
                  className="movie-gallery-more-loading"
                  aria-label="Loading more images"
                >
                  <span />
                </div>
              )}
            </div>
          )}

          {error && images.length > 0 && (
            <p className="movie-gallery-inline-error" role="status">
              {error}
            </p>
          )}
        </section>
      </div>

      {lightbox}
    </>
  );
}

export default MovieGallery;
