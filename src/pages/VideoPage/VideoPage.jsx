import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getVideoMetadata } from "../../service/collectionApi";
import VideoPlayer from "../../components/VideoPlayer/VideoPlayer";
import "./VideoPage.css";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")}/api/v1/collections`;

function VideoPage() {
  const { collectionId, mediaItemId } = useParams();
  const navigate = useNavigate();

  const pageRef = useRef(null);
  const lastPlaybackTimeRef = useRef(0);

  const [videoMetadata, setVideoMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playError, setPlayError] = useState("");
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  const thumbnailUrl = videoMetadata?.thumbnailUrl
    ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")}${videoMetadata.thumbnailUrl}`
    : "";

  const posterUrl = mediaItemId
    ? `${API_BASE}/poster` + `?mediaItemId=${encodeURIComponent(mediaItemId)}`
    : null;

  const videoUrl = mediaItemId
    ? `${API_BASE}/video` + `?mediaItemId=${encodeURIComponent(mediaItemId)}`
    : null;

  const handleBackToCollection = useCallback(() => {
    navigate(`/collections/${collectionId}`);
  }, [navigate, collectionId]);

  const handlePlay = useCallback(() => {
    setPlayError("");
    setIsPlayerOpen(true);
  }, []);

  const handleClosePlayer = useCallback(async () => {
    setIsPlayerOpen(false);

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.warn("Could not exit fullscreen:", err);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMetadata() {
      setLoading(true);
      setError("");
      setVideoMetadata(null);

      if (!mediaItemId) {
        setError("The movie ID is missing from the page URL.");
        setLoading(false);
        return;
      }

      try {
        const data = await getVideoMetadata(mediaItemId);

        if (!cancelled) {
          setVideoMetadata(data);
        }
      } catch (err) {
        console.error("Failed to load video metadata:", err);

        if (!cancelled) {
          setError("Couldn't load the movie details. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [mediaItemId]);

  // Close the player overlay when fullscreen ends.
  useEffect(() => {
    if (!isPlayerOpen) return;

    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        setIsPlayerOpen(false);
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isPlayerOpen]);

  // Prevent the background page from scrolling behind the player.
  useEffect(() => {
    if (!isPlayerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isPlayerOpen]);

  // Request fullscreen after the player has mounted.
  useEffect(() => {
    if (!isPlayerOpen) return;

    const enterFullscreen = async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const player = pageRef.current?.querySelector(".cine-player");

      if (!player || document.fullscreenElement) return;

      try {
        await player.requestFullscreen();
      } catch (err) {
        console.warn("Could not enter player fullscreen:", err);
      }
    };

    enterFullscreen();
  }, [isPlayerOpen]);

  const formatDate = (date) => {
    if (!date) return null;

    const parsed = new Date(`${date}T00:00:00`);

    return Number.isNaN(parsed.getTime())
      ? date
      : parsed.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
  };

  const displayList = (items) =>
    Array.isArray(items) ? items.filter(Boolean) : [];

  // Support both the previous string format and the new ID/name DTO format.
  const getItemName = (item) =>
    typeof item === "string" ? item : item?.name || "";

  const getItemKey = (item, index) =>
    typeof item === "string"
      ? `${item}-${index}`
      : `${item?.id || getItemName(item)}-${index}`;

  if (loading) {
    return (
      <main className="video-page page-message">
        <div className="movie-load-state">
          <span className="movie-load-spinner" aria-hidden="true" />
          <span className="movie-load-eyebrow">CINEBOX</span>
          <h1>Preparing your cinema</h1>
          <p>Getting everything ready for you...</p>
        </div>
      </main>
    );
  }

  if (error || !videoMetadata) {
    return (
      <main className="video-page page-message">
        <section className="movie-unavailable">
          <div className="unavailable-icon" aria-hidden="true">
            <svg
              viewBox="0 0 48 48"
              width="42"
              height="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="7" y="10" width="34" height="28" rx="4" />
              <path d="m18 10 5 7m8-7 5 7M7 24h34" />
              <path d="M24 28v4m0 3h.01" />
            </svg>
          </div>

          <span className="unavailable-eyebrow">A LITTLE DETOUR</span>

          <h1>We couldn't find this movie</h1>

          <p>
            {error ||
              "This movie's details are unavailable right now. It may have been moved or is temporarily inaccessible."}
          </p>

          <button
            type="button"
            className="unavailable-back-button"
            onClick={handleBackToCollection}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            <span>Back to videos</span>
          </button>

          <span className="unavailable-footnote">
            YOUR PERSONAL CINEMA · CINEBOX
          </span>
        </section>
      </main>
    );
  }

  const metadata = videoMetadata;
  const genres = displayList(metadata.genres);
  const tags = displayList(metadata.tags);
  const actors = displayList(metadata.actors);
  const directors = displayList(metadata.directors);
  const writers = displayList(metadata.writers);
  const studios = displayList(metadata.studios);

  return (
    <main
      ref={pageRef}
      className="video-page"
      style={{ "--movie-backdrop": `url("${thumbnailUrl}")` }}
    >
      <div className="backdrop-image" aria-hidden="true" />
      <div className="backdrop-shade" aria-hidden="true" />

      {isPlayerOpen && (
        <div
          className="cine-player-overlay"
          role="dialog"
          aria-label={`Playing ${metadata.title || "video"}`}
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleClosePlayer();
            }
          }}
        >
          <VideoPlayer
            src={videoUrl}
            poster={thumbnailUrl}
            title={metadata.title || "Untitled video"}
            autoPlay
            initialMuted
            onError={() => {
              setPlayError(
                "The video couldn't be loaded. Please check the file.",
              );
            }}
            lastPlaybackTimeRef={lastPlaybackTimeRef}
          />
        </div>
      )}

      <div className="movie-content">
        <section className="movie-hero">
          <div className="hero-copy">
            <button
              type="button"
              className="back-to-collection"
              onClick={handleBackToCollection}
              aria-label="Back to collection"
            >
              <svg
                viewBox="0 0 24 24"
                width="19"
                height="19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
              <span>Back to Collection</span>
            </button>

            <div className="eyebrow">
              <span className="eyebrow-dot" />
              YOUR PERSONAL CINEMA
            </div>

            <h1 className="hero-title">{metadata.title || "Untitled video"}</h1>

            <div className="hero-badges">
              {metadata.year != null && <span>{metadata.year}</span>}
              {metadata.mpaa && <span>{metadata.mpaa}</span>}
              {metadata.runtime != null && <span>{metadata.runtime} min</span>}
              {metadata.language && <span>{metadata.language}</span>}
            </div>

            {genres.length > 0 && (
              <div className="hero-genres">
                {genres.map((genre, index) => (
                  <span key={getItemKey(genre, index)}>
                    {getItemName(genre)}
                  </span>
                ))}
              </div>
            )}

            {metadata.outline && (
              <p className="hero-outline">{metadata.outline}</p>
            )}

            <div className="hero-actions">
              <button
                type="button"
                className="play-button"
                onClick={handlePlay}
                aria-label={`Play ${metadata.title || "video"}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="23"
                  height="23"
                  aria-hidden="true"
                >
                  <path d="M8 5.5v13l10-6.5z" fill="currentColor" />
                </svg>
                <span>Play</span>
              </button>

              <span className="play-hint">
                <svg
                  viewBox="0 0 24 24"
                  width="17"
                  height="17"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" />
                </svg>
                Fullscreen playback
              </span>
            </div>

            {playError && (
              <p className="play-error" role="alert">
                {playError}
              </p>
            )}
          </div>

          <div className="hero-poster">
            <img
              src={posterUrl}
              alt={`${metadata.title || "Movie"} poster`}
              onError={(event) => {
                event.currentTarget.style.visibility = "hidden";
              }}
            />
          </div>
        </section>

        <section className="movie-details">
          {metadata.plot && (
            <div className="detail-section synopsis-section">
              <h2>Synopsis</h2>
              <p>{metadata.plot}</p>
            </div>
          )}

          {actors.length > 0 && (
            <div className="detail-section">
              <h2>Cast</h2>

              <div className="cast-grid">
                {actors.map((actor, index) => (
                  <div
                    className="cast-card"
                    key={actor.id || `${actor.name}-${index}`}
                  >
                    <div className="cast-avatar">
                      {(actor.name || "?").charAt(0)}
                    </div>

                    <div className="cast-info">
                      <span className="cast-name">{actor.name}</span>
                      {actor.role && (
                        <span className="cast-role">{actor.role}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(directors.length > 0 || writers.length > 0) && (
            <div className="detail-section">
              <h2>Credits</h2>

              {directors.length > 0 && (
                <div className="detail-row">
                  <span>Director</span>
                  <strong>
                    {directors.map(getItemName).filter(Boolean).join(", ")}
                  </strong>
                </div>
              )}

              {writers.length > 0 && (
                <div className="detail-row">
                  <span>Writer</span>
                  <strong>
                    {writers.map(getItemName).filter(Boolean).join(", ")}
                  </strong>
                </div>
              )}
            </div>
          )}

          <div className="detail-section">
            <h2>Movie details</h2>

            <div className="details-grid">
              {[
                ["Original title", metadata.originalTitle],
                ["Sort title", metadata.sortTitle],
                ["Premiered", formatDate(metadata.premiered)],
                ["Release date", formatDate(metadata.releaseDate)],
                ["Country", metadata.country],
                ["Original country", metadata.originalCountry?.toUpperCase()],
                ["Language", metadata.language],
                ["Content rating", metadata.mpaa],
                [
                  "Runtime",
                  metadata.runtime != null
                    ? `${metadata.runtime} minutes`
                    : null,
                ],
                [
                  "Studio",
                  studios.length > 0
                    ? studios.map(getItemName).filter(Boolean).join(", ")
                    : getItemName(metadata.studio),
                ],
              ]
                .filter(([, value]) => value != null && value !== "")
                .map(([label, value]) => (
                  <div className="detail-item" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
            </div>
          </div>

          {tags.length > 0 && (
            <div className="detail-section">
              <h2>Tags</h2>

              <div className="tag-list">
                {tags.map((tag, index) => (
                  <span key={getItemKey(tag, index)}>{getItemName(tag)}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default VideoPage;
