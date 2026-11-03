import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getContinueWatching } from "../../service/playbackApi";
import "./ContinueWatching.css";

const PAGE_SIZE = 20;
const LOAD_MORE_THRESHOLD = 300;

function formatRemainingTime(seconds) {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) {
    return null;
  }

  const totalMinutes = Math.ceil(Number(seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m left`;
  }

  if (hours > 0) {
    return `${hours}h left`;
  }

  return `${minutes}m left`;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

function resolveImageUrl(url) {
  if (!url) return "";

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function ContinueWatchingCard({ video, onClick }) {
  const progress = Math.min(
    100,
    Math.max(0, Number(video.progressPercent) || 0),
  );

  const imageUrl = resolveImageUrl(video.thumbnailUrl || video.posterUrl);
  const remainingTime = formatRemainingTime(video.remainingSeconds);

  return (
    <button
      type="button"
      className="continue-watching-card"
      onClick={onClick}
      aria-label={`Continue watching ${video.title || "video"}`}
    >
      <div className="continue-watching-card__image-wrapper">
        {imageUrl ? (
          <img
            className="continue-watching-card__image"
            src={imageUrl}
            alt=""
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="continue-watching-card__image-placeholder">
            <span>{(video.title || "C").charAt(0).toUpperCase()}</span>
          </div>
        )}

        <div className="continue-watching-card__play" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M8 5.5v13l10-6.5-10-6.5Z" />
          </svg>
        </div>

        <div
          className="continue-watching-card__progress-track"
          aria-label={`${Math.round(progress)} percent watched`}
        >
          <div
            className="continue-watching-card__progress-value"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="continue-watching-card__details">
        <div
          className="continue-watching-card__title"
          title={video.title || "Untitled"}
        >
          {video.title || "Untitled"}
        </div>

        <div className="continue-watching-card__meta">
          <span>{Math.round(progress)}% watched</span>

          {remainingTime && (
            <>
              <span className="continue-watching-card__separator">·</span>
              <span>{remainingTime}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function ContinueWatchingLoader() {
  return (
    <div
      className="continue-watching-loader"
      role="status"
      aria-label="Loading more videos"
    >
      <span className="continue-watching-loader__spinner" />
    </div>
  );
}

export default function ContinueWatching() {
  const navigate = useNavigate();

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalElements, setTotalElements] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const scrollContainerRef = useRef(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const nextPageRef = useRef(0);
  const mountedRef = useRef(false);

  const loadPage = useCallback(async (page) => {
    if (loadingRef.current || !hasMoreRef.current || !mountedRef.current) {
      return;
    }

    loadingRef.current = true;

    if (page === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    setLoadError(false);

    try {
      const response = await getContinueWatching({
        page,
        size: PAGE_SIZE,
      });

      if (!mountedRef.current) {
        return;
      }

      const content = Array.isArray(response?.content) ? response.content : [];

      setVideos((previous) => {
        if (page === 0) {
          return content;
        }

        const existingIds = new Set(previous.map((video) => video.mediaItemId));

        const newVideos = content.filter(
          (video) => video?.mediaItemId && !existingIds.has(video.mediaItemId),
        );

        return [...previous, ...newVideos];
      });

      if (Number.isFinite(response?.totalElements)) {
        setTotalElements(response.totalElements);
      }

      let hasNextPage;

      if (typeof response?.hasNext === "boolean") {
        hasNextPage = response.hasNext;
      } else if (Number.isFinite(response?.totalPages)) {
        hasNextPage = page + 1 < response.totalPages;
      } else {
        hasNextPage = content.length === PAGE_SIZE;
      }

      hasMoreRef.current = hasNextPage;
      nextPageRef.current = page + 1;
    } catch (error) {
      console.error("Failed to load Continue Watching:", error);

      if (mountedRef.current) {
        setLoadError(true);
      }
    } finally {
      loadingRef.current = false;

      if (mountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    loadPage(0);

    return () => {
      mountedRef.current = false;
    };
  }, [loadPage]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;

    if (!container || loadingRef.current || !hasMoreRef.current) {
      return;
    }

    const distanceFromRight =
      container.scrollWidth - container.clientWidth - container.scrollLeft;

    if (distanceFromRight <= LOAD_MORE_THRESHOLD) {
      loadPage(nextPageRef.current);
    }
  }, [loadPage]);

  /*
   * If the first page does not fill the available horizontal space,
   * fetch additional pages so the user has something to scroll through.
   * This stops automatically once the row has enough content or
   * the backend reports that there are no more pages.
   */
  useEffect(() => {
    const container = scrollContainerRef.current;

    if (
      !container ||
      loading ||
      loadingMore ||
      loadError ||
      !hasMoreRef.current
    ) {
      return;
    }

    if (container.scrollWidth <= container.clientWidth + 1) {
      loadPage(nextPageRef.current);
    }
  }, [videos, loading, loadingMore, loadError, loadPage]);

  const handleVideoClick = (video) => {
    if (!video?.mediaItemId || !video?.collectionId) {
      return;
    }

    navigate(
      `/videos/${encodeURIComponent(video.collectionId)}/${encodeURIComponent(
        video.mediaItemId,
      )}`,
    );
  };

  if (loading && videos.length === 0) {
    return null;
  }

  if (videos.length === 0) {
    return null;
  }

  const displayedCount = totalElements !== null ? totalElements : videos.length;

  return (
    <section
      className="continue-watching-section"
      aria-label="Continue watching"
    >
      <div className="continue-watching-heading">
        <div>
          <span className="continue-watching-eyebrow">
            PICK UP WHERE YOU LEFT OFF
          </span>
        </div>

        <span className="continue-watching-count">
          {displayedCount} {displayedCount === 1 ? "title" : "titles"}
        </span>
      </div>

      <div
        ref={scrollContainerRef}
        className="continue-watching-list"
        onScroll={handleScroll}
        role="region"
        aria-label="Continue watching videos. Scroll horizontally to see more."
        tabIndex={0}
      >
        {videos.map((video) => (
          <ContinueWatchingCard
            key={video.mediaItemId}
            video={video}
            onClick={() => handleVideoClick(video)}
          />
        ))}

        {loadingMore && <ContinueWatchingLoader />}

        {loadError && hasMoreRef.current && (
          <button
            type="button"
            className="continue-watching-retry"
            onClick={() => loadPage(nextPageRef.current)}
          >
            Retry loading
          </button>
        )}
      </div>
    </section>
  );
}
