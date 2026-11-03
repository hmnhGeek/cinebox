import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getContinueWatching } from "../../service/playbackApi";
import "./ContinueWatching.css";

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

export default function ContinueWatching() {
  const navigate = useNavigate();

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadContinueWatching = useCallback(async () => {
    try {
      const response = await getContinueWatching({
        page: 0,
        size: 20,
      });

      setVideos(Array.isArray(response?.content) ? response.content : []);
    } catch (error) {
      console.error("Failed to load Continue Watching:", error);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContinueWatching();
  }, [loadContinueWatching]);

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

  if (loading || videos.length === 0) {
    return null;
  }

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
          {videos.length} {videos.length === 1 ? "title" : "titles"}
        </span>
      </div>

      <div className="continue-watching-list">
        {videos.map((video) => (
          <ContinueWatchingCard
            key={video.mediaItemId}
            video={video}
            onClick={() => handleVideoClick(video)}
          />
        ))}
      </div>
    </section>
  );
}
