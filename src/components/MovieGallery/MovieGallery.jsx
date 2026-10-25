import { useCallback, useEffect, useRef, useState } from "react";
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

  const selectedImage = selectedIndex >= 0 ? images[selectedIndex] : null;

  const loadMore = useCallback(async () => {
    if (!hasNext || loadingMoreRef.current || !collectionId || !mediaItemId) {
      return;
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

      setImages((current) => {
        const knownIds = new Set(current.map((image) => image.id));

        return [
          ...current,
          ...newImages.filter((image) => !knownIds.has(image.id)),
        ];
      });

      nextPageRef.current = data.page + 1;
      setHasNext(Boolean(data.hasNext));
    } catch (err) {
      console.error("Failed to load more gallery images:", err);
      setError("Couldn't load more images. Please try again.");
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

  // Fetch another page as the user approaches the end of the strip.
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

  const showPrevious = useCallback(() => {
    setSelectedIndex((current) =>
      current > 0 ? current - 1 : images.length - 1,
    );
  }, [images.length]);

  const showNext = useCallback(() => {
    setSelectedIndex((current) =>
      current < images.length - 1 ? current + 1 : 0,
    );
  }, [images.length]);

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

  // Preload adjacent images for smoother lightbox navigation.
  useEffect(() => {
    if (selectedIndex < 0 || images.length < 2) return;

    const adjacent = [
      images[(selectedIndex + 1) % images.length],
      images[(selectedIndex - 1 + images.length) % images.length],
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
      if (difference > 0) showPrevious();
      else showNext();
    }

    touchStartXRef.current = null;
  };

  // Avoid showing an empty gallery when no images exist.
  if (!loading && images.length === 0 && !error) {
    return null;
  }

  return (
    <>
      <section className="movie-gallery" aria-label="Movie gallery">
        <div className="movie-gallery-heading">
          <div className="movie-gallery-heading-copy">
            <span className="movie-gallery-eyebrow">BEHIND THE FRAME</span>

            <h2>Frames &amp; Stills</h2>
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

      {selectedImage && (
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
          <div className="movie-gallery-lightbox-top">
            <div className="movie-gallery-lightbox-brand">
              <span className="movie-gallery-lightbox-mark" />

              <span>
                CINEBOX <span>/ FRAMES &amp; STILLS</span>
              </span>
            </div>

            <button
              type="button"
              className="movie-gallery-close"
              onClick={closeLightbox}
              aria-label="Close gallery"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m18 6-12 12M6 6l12 12" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            className="movie-gallery-lightbox-nav movie-gallery-lightbox-prev"
            onClick={showPrevious}
            aria-label="Previous image"
            disabled={images.length < 2}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <div className="movie-gallery-lightbox-content">
            <img
              key={selectedImage.id}
              src={resolveGalleryImageUrl(selectedImage.url)}
              alt={selectedImage.filename || "Gallery image"}
              onError={() => markImageFailed(selectedImage.id)}
            />

            <div className="movie-gallery-lightbox-caption">
              <span>{selectedImage.filename}</span>

              <span>
                {selectedIndex + 1} <i>/</i> {images.length}
                {hasNext ? "+" : ""}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="movie-gallery-lightbox-nav movie-gallery-lightbox-next"
            onClick={showNext}
            aria-label="Next image"
            disabled={images.length < 2}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          <div className="movie-gallery-lightbox-footer">
            <span>ESC TO CLOSE</span>

            <span>
              ← PREVIOUS <i>/</i> NEXT →
            </span>
          </div>
        </div>
      )}
    </>
  );
}

export default MovieGallery;
