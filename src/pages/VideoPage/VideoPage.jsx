import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getVideoMetadata } from "../../service/collectionApi";
import "./VideoPage.css";

const API_BASE = "http://localhost:8080/api/v1/collections";

function VideoPage() {
  const { collectionId, videoFolderPath } = useParams();

  const [videoMetadata, setVideoMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playError, setPlayError] = useState("");

  const videoRef = useRef(null);

  const encodedFolder = encodeURIComponent(videoFolderPath || "");

  const thumbnailUrl =
    `${API_BASE}/thumbnail?collectionId=${collectionId}` +
    `&videoFolder=${encodedFolder}`;

  const posterUrl =
    `${API_BASE}/poster?collectionId=${collectionId}` +
    `&videoFolder=${encodedFolder}`;

  const videoUrl =
    `${API_BASE}/video?collectionId=${collectionId}` +
    `&videoFolder=${encodedFolder}`;

  useEffect(() => {
    let cancelled = false;

    async function loadMetadata() {
      setLoading(true);
      setError("");
      setVideoMetadata(null);

      try {
        const data = await getVideoMetadata(collectionId, videoFolderPath);

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
  }, [collectionId, videoFolderPath]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      // The user exited fullscreen, e.g. by pressing Escape.
      if (!document.fullscreenElement) {
        const video = videoRef.current;

        if (video && !video.paused) {
          video.pause();
        }
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  async function handlePlay() {
    const video = videoRef.current;
    if (!video) return;

    setPlayError("");
    video.controls = true;

    // Call both APIs directly from the user's click.
    let fullscreenPromise;

    try {
      if (video.requestFullscreen) {
        fullscreenPromise = video.requestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        // Safari on iPhone.
        video.webkitEnterFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request failed:", err);
    }

    let playbackPromise;

    try {
      playbackPromise = video.play();
    } catch (err) {
      console.error("Playback failed:", err);
      setPlayError("Unable to start playback. Please try again.");
      return;
    }

    const results = await Promise.allSettled(
      [fullscreenPromise, playbackPromise].filter(Boolean),
    );

    const playbackFailed = results.some(
      (result) =>
        result.status === "rejected" &&
        result.reason &&
        result.reason.name !== "TypeError",
    );

    if (playbackFailed || video.paused) {
      setPlayError(
        "Couldn't start the video. Check that the video is accessible and try again.",
      );
    }
  }

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

  if (loading) {
    return <div className="video-page page-message">Loading movie...</div>;
  }

  if (error || !videoMetadata) {
    return (
      <div className="video-page page-message">
        {error || "Movie details are unavailable."}
      </div>
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
      className="video-page"
      style={{ "--movie-backdrop": `url("${thumbnailUrl}")` }}
    >
      {/* Blurred backdrop and cinematic gradients */}
      <div className="backdrop-image" aria-hidden="true" />
      <div className="backdrop-shade" aria-hidden="true" />

      {/* Video stays hidden until it enters fullscreen */}
      <video
        ref={videoRef}
        className="fullscreen-video"
        src={videoUrl}
        poster={thumbnailUrl}
        preload="metadata"
        playsInline
        controls={false}
        muted
        controlsList="nodownload"
        disablePictureInPicture
        onError={() =>
          setPlayError("The video couldn't be loaded. Please check its URL.")
        }
      />

      <div className="movie-content">
        <section className="movie-hero">
          <div className="hero-copy">
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
                {genres.map((genre) => (
                  <span key={genre}>{genre}</span>
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
                aria-label={`Play ${metadata.title || "video"} in fullscreen`}
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
                  <div className="cast-card" key={`${actor.name}-${index}`}>
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
                  <strong>{directors.join(", ")}</strong>
                </div>
              )}
              {writers.length > 0 && (
                <div className="detail-row">
                  <span>Writer</span>
                  <strong>{writers.join(", ")}</strong>
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
                  studios.length > 0 ? studios.join(", ") : metadata.studio,
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
                {tags.map((tag) => (
                  <span key={tag}>{tag}</span>
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
