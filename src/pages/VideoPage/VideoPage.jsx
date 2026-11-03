import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getVideoMetadata } from "../../service/collectionApi";
import {
  getMediaTechnicalInfo,
  requestMediaTechnicalInfo,
} from "../../service/mediaTechnicalInfoApi";
import {
  getPlaybackProgress,
  updatePlaybackProgress,
  markPlaybackCompleted,
} from "../../service/playbackApi";
import VideoPlayer from "../../components/VideoPlayer/VideoPlayer";
import MovieGallery from "../../components/MovieGallery/MovieGallery";
import { useSettings } from "../../context/SettingsContext";
import "./VideoPage.css";

const API_BASE = `${(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")}/api/v1/collections`;

const TECHNICAL_INFO_POLL_INTERVAL = 2000;

const ACTIVE_TECHNICAL_STATUSES = new Set([
  "PENDING",
  "PROCESSING",
  "QUEUED",
  "IN_PROGRESS",
]);

function getActorProfileImageUrl(actor) {
  const imageUrl =
    actor?.profileImageUrl ||
    actor?.profilePictureUrl ||
    actor?.imageUrl ||
    (actor?.id
      ? `/api/v1/people/${encodeURIComponent(actor.id)}/profile/image`
      : "");

  if (!imageUrl) return "";

  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

  return `${baseUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

function formatTechnicalDuration(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return null;

  const totalSeconds = Math.round(Number(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function getResolutionHeight(resolution, width, height) {
  const numericHeight = Number(height);

  if (height != null && Number.isFinite(numericHeight) && numericHeight > 0) {
    return numericHeight;
  }

  const value = String(resolution || "")
    .trim()
    .toLowerCase();

  if (!value) return null;

  if (/\b8k\b/.test(value)) return 4320;
  if (/\b4k\b|\buhd\b/.test(value)) return 2160;

  const dimensionsMatch = value.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/);

  if (dimensionsMatch) {
    return Number(dimensionsMatch[2]);
  }

  const pixelMatch = value.match(/\b(\d{3,4})\s*[pi]\b/);

  if (pixelMatch) {
    return Number(pixelMatch[1]);
  }

  const standaloneMatch = value.match(/\b(4320|2160|1440|1080|720|480)\b/);

  if (standaloneMatch) {
    return Number(standaloneMatch[1]);
  }

  const numericWidth = Number(width);

  if (
    width != null &&
    Number.isFinite(numericWidth) &&
    numericWidth > 0 &&
    numericWidth <= 4320
  ) {
    return numericWidth;
  }

  return null;
}

function getResolutionBadgeClass(resolution, width, height) {
  const resolutionHeight = getResolutionHeight(resolution, width, height);

  if (resolutionHeight == null) return "resolution-unknown";
  if (resolutionHeight >= 4320) return "resolution-4320";
  if (resolutionHeight >= 2160) return "resolution-2160";
  if (resolutionHeight >= 1440) return "resolution-1440";
  if (resolutionHeight >= 1080) return "resolution-1080";
  if (resolutionHeight >= 720) return "resolution-720";
  if (resolutionHeight >= 480) return "resolution-480";

  return "resolution-sd";
}

function formatFileSize(bytes) {
  if (bytes == null || !Number.isFinite(Number(bytes))) return null;

  const size = Number(bytes);

  if (size < 1024 ** 2) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  if (size < 1024 ** 3) {
    return `${(size / 1024 ** 2).toFixed(2)} MB`.replace(
      /(\.\d*?)0+ MB$/,
      "$1 MB",
    );
  }

  return `${(size / 1024 ** 3).toFixed(2)} GB`.replace(
    /(\.\d*?)0+ GB$/,
    "$1 GB",
  );
}

function formatFrameRate(frameRate) {
  if (frameRate == null || !Number.isFinite(Number(frameRate))) return null;

  return `${Number(frameRate)
    .toFixed(3)
    .replace(/\.?0+$/, "")} FPS`;
}

function formatCodec(codec) {
  if (!codec) return null;

  return String(codec).replace(/[_-]/g, " ").toUpperCase();
}

function VideoPage() {
  const { collectionId, mediaItemId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { settings, loading: settingsLoading } = useSettings();

  const pageRef = useRef(null);
  const lastPlaybackTimeRef = useRef(0);
  const playbackDurationRef = useRef(0);
  const technicalInfoPreferenceAppliedRef = useRef(false);

  const [videoMetadata, setVideoMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playError, setPlayError] = useState("");
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  const [playbackProgressLoading, setPlaybackProgressLoading] = useState(true);
  const [initialPlaybackTime, setInitialPlaybackTime] = useState(0);
  const [playbackCompleted, setPlaybackCompleted] = useState(false);

  const navigationTechnicalInfo = location.state?.videoTechnicalInfo || null;

  const [technicalInfo, setTechnicalInfo] = useState(null);
  const [technicalInfoLoading, setTechnicalInfoLoading] = useState(false);
  const [technicalInfoError, setTechnicalInfoError] = useState("");
  const [technicalInfoExpanded, setTechnicalInfoExpanded] = useState(false);
  const [technicalInfoRequesting, setTechnicalInfoRequesting] = useState(false);

  const defaultMuted = settings?.playback?.defaultMuted ?? true;

  const expandTechnicalInfoByDefault =
    settings?.library?.expandTechnicalInfo ?? false;

  const discoveryReturnPath =
    location.state?.from?.type === "discovery" &&
    typeof location.state.from.pathname === "string" &&
    location.state.from.pathname.startsWith("/") &&
    !location.state.from.pathname.startsWith("//")
      ? `${location.state.from.pathname}${
          typeof location.state.from.search === "string"
            ? location.state.from.search
            : ""
        }`
      : null;

  const searchReturnPath =
    location.state?.fromSearch === true &&
    typeof location.state.returnTo === "string" &&
    location.state.returnTo.startsWith("/") &&
    !location.state.returnTo.startsWith("//") &&
    location.state.returnTo.split(/[?#]/)[0] === "/search"
      ? location.state.returnTo
      : null;

  const backLabel = searchReturnPath
    ? "Back to Search Results"
    : discoveryReturnPath
      ? "Back to Discovery"
      : "Back to Collection";

  const thumbnailUrl = videoMetadata?.thumbnailUrl
    ? `${(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")}${videoMetadata.thumbnailUrl}`
    : "";

  const posterUrl = mediaItemId
    ? `${API_BASE}/poster?mediaItemId=${encodeURIComponent(mediaItemId)}`
    : null;

  const videoUrl = mediaItemId
    ? `${API_BASE}/video?mediaItemId=${encodeURIComponent(mediaItemId)}`
    : null;

  const handleBackToCollection = useCallback(() => {
    if (searchReturnPath) {
      navigate(searchReturnPath);
      return;
    }

    if (discoveryReturnPath) {
      navigate(-1);
      return;
    }

    navigate(`/collections/${encodeURIComponent(collectionId)}`);
  }, [navigate, collectionId, searchReturnPath, discoveryReturnPath]);

  /*
   * Save the latest playback position to the backend.
   *
   * This callback is shared by the player timer, pause event and close
   * handler. The backend is responsible for clamping the position and
   * marking a video completed when it crosses its completion threshold.
   */
  const savePlaybackProgress = useCallback(
    async (progress = null) => {
      if (!mediaItemId) return;

      const positionSeconds = Number(
        progress?.positionSeconds ?? lastPlaybackTimeRef.current,
      );

      const durationSeconds = Number(
        progress?.durationSeconds ?? playbackDurationRef.current,
      );

      if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
        return;
      }

      if (positionSeconds < 1) {
        return;
      }

      try {
        await updatePlaybackProgress(mediaItemId, {
          positionSeconds,
          durationSeconds:
            Number.isFinite(durationSeconds) && durationSeconds > 0
              ? durationSeconds
              : null,
        });
      } catch (err) {
        console.error("Failed to save playback progress:", err);
      }
    },
    [mediaItemId],
  );

  const handlePlaybackEnded = useCallback(async () => {
    if (!mediaItemId) return;

    try {
      await markPlaybackCompleted(mediaItemId);

      setPlaybackCompleted(true);
      setInitialPlaybackTime(0);
      lastPlaybackTimeRef.current = 0;
    } catch (err) {
      console.error("Failed to mark video as completed:", err);
    }
  }, [mediaItemId]);

  const handlePlay = useCallback(() => {
    if (playbackProgressLoading) {
      return;
    }

    setPlayError("");
    setIsPlayerOpen(true);
  }, [playbackProgressLoading]);

  const handleClosePlayer = useCallback(async () => {
    await savePlaybackProgress({
      positionSeconds: lastPlaybackTimeRef.current,
      durationSeconds: playbackDurationRef.current,
    });

    setIsPlayerOpen(false);

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.warn("Could not exit fullscreen:", err);
      }
    }
  }, [savePlaybackProgress]);

  const handleDiscover = useCallback(
    (type, item) => {
      if (!item || typeof item !== "object" || !item.id) return;

      navigate(`/discover/${type}/${encodeURIComponent(item.id)}`);
    },
    [navigate],
  );

  // Load movie metadata.
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

  // Load saved playback progress for the current media item.
  useEffect(() => {
    let cancelled = false;

    async function loadPlaybackProgress() {
      setPlaybackProgressLoading(true);
      setInitialPlaybackTime(0);
      setPlaybackCompleted(false);
      lastPlaybackTimeRef.current = 0;
      playbackDurationRef.current = 0;

      if (!mediaItemId) {
        setPlaybackProgressLoading(false);
        return;
      }

      try {
        const progress = await getPlaybackProgress(mediaItemId);

        if (cancelled) return;

        if (progress?.completed) {
          setPlaybackCompleted(true);
          setInitialPlaybackTime(0);
          lastPlaybackTimeRef.current = 0;
        } else {
          const position = Math.max(0, Number(progress?.positionSeconds) || 0);

          const duration = Math.max(0, Number(progress?.durationSeconds) || 0);

          setInitialPlaybackTime(position);
          lastPlaybackTimeRef.current = position;
          playbackDurationRef.current = duration;
        }
      } catch (err) {
        console.error("Failed to load playback progress:", err);

        if (!cancelled) {
          // A progress lookup failure should not prevent normal playback.
          setInitialPlaybackTime(0);
          lastPlaybackTimeRef.current = 0;
        }
      } finally {
        if (!cancelled) {
          setPlaybackProgressLoading(false);
        }
      }
    }

    loadPlaybackProgress();

    return () => {
      cancelled = true;
    };
  }, [mediaItemId]);

  // Load technical information for the current media item.
  useEffect(() => {
    let cancelled = false;

    async function loadTechnicalInfo() {
      setTechnicalInfo(null);
      setTechnicalInfoError("");
      setTechnicalInfoExpanded(false);
      setTechnicalInfoLoading(true);
      technicalInfoPreferenceAppliedRef.current = false;

      if (!mediaItemId) {
        setTechnicalInfoLoading(false);
        return;
      }

      try {
        const data = await getMediaTechnicalInfo(mediaItemId);

        if (!cancelled) {
          setTechnicalInfo(data);
        }
      } catch (err) {
        console.error("Failed to load technical information:", err);

        if (!cancelled) {
          setTechnicalInfoError("Technical information couldn't be loaded.");
        }
      } finally {
        if (!cancelled) {
          setTechnicalInfoLoading(false);
        }
      }
    }

    loadTechnicalInfo();

    return () => {
      cancelled = true;
    };
  }, [mediaItemId]);

  useEffect(() => {
    if (settingsLoading || technicalInfoPreferenceAppliedRef.current) {
      return;
    }

    setTechnicalInfoExpanded(expandTechnicalInfoByDefault);
    technicalInfoPreferenceAppliedRef.current = true;
  }, [settingsLoading, expandTechnicalInfoByDefault, mediaItemId]);

  // Poll while the backend is extracting technical information.
  useEffect(() => {
    const status = String(technicalInfo?.status || "").toUpperCase();

    if (!mediaItemId || !ACTIVE_TECHNICAL_STATUSES.has(status)) {
      return undefined;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const data = await getMediaTechnicalInfo(mediaItemId);

        if (!cancelled) {
          setTechnicalInfo(data);
          setTechnicalInfoError("");
        }
      } catch (err) {
        console.error("Failed to refresh technical information:", err);

        if (!cancelled) {
          setTechnicalInfoError(
            "Couldn't refresh the extraction status. Please try again.",
          );
        }
      }
    }, TECHNICAL_INFO_POLL_INTERVAL);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mediaItemId, technicalInfo]);

  const handleAnalyzeTechnicalInfo = useCallback(async () => {
    if (!mediaItemId || technicalInfoRequesting) return;

    const currentStatus = String(technicalInfo?.status || "").toUpperCase();
    const force = currentStatus === "FAILED";

    setTechnicalInfoRequesting(true);
    setTechnicalInfoError("");

    try {
      const data = await requestMediaTechnicalInfo(mediaItemId, force);
      setTechnicalInfo(data);
    } catch (err) {
      console.error("Failed to request technical information:", err);
      setTechnicalInfoError(
        err.message || "Couldn't start technical analysis.",
      );
    } finally {
      setTechnicalInfoRequesting(false);
    }
  }, [mediaItemId, technicalInfo, technicalInfoRequesting]);

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

  const getItemName = (item) =>
    typeof item === "string" ? item : item?.name || "";

  const getItemKey = (item, index) =>
    typeof item === "string"
      ? `${item}-${index}`
      : `${item?.id || getItemName(item)}-${index}`;

  const renderDiscoverableList = (items, type) =>
    items.map((item, index) => {
      const name = getItemName(item);
      const hasId = typeof item === "object" && Boolean(item?.id);

      if (!name) return null;

      return (
        <button
          type="button"
          key={getItemKey(item, index)}
          className={`metadata-link${hasId ? "" : " metadata-link-disabled"}`}
          onClick={() => handleDiscover(type, item)}
          disabled={!hasId}
          aria-label={
            hasId
              ? `Explore movies ${type === "actors" ? "featuring" : "associated with"} ${name}`
              : undefined
          }
        >
          {name}
        </button>
      );
    });

  const technicalMetadata = {
    resolution:
      videoMetadata?.resolution ?? navigationTechnicalInfo?.resolution ?? null,

    width: videoMetadata?.width ?? navigationTechnicalInfo?.width ?? null,

    height: videoMetadata?.height ?? navigationTechnicalInfo?.height ?? null,

    durationSeconds:
      videoMetadata?.durationSeconds ??
      navigationTechnicalInfo?.durationSeconds ??
      null,

    fileSizeBytes:
      videoMetadata?.fileSizeBytes ??
      navigationTechnicalInfo?.fileSizeBytes ??
      null,
  };

  const technicalStatus = String(technicalInfo?.status || "").toUpperCase();

  const hasTechnicalInfoSection =
    technicalStatus !== "" && technicalStatus !== "NOT_REQUESTED";

  const isTechnicalInfoActive =
    ACTIVE_TECHNICAL_STATUSES.has(technicalStatus) || technicalInfoRequesting;

  const isTechnicalInfoCompleted = technicalStatus === "COMPLETED";
  const isTechnicalInfoFailed = technicalStatus === "FAILED";

  const technicalDuration = formatTechnicalDuration(
    technicalInfo?.durationSeconds ?? technicalMetadata.durationSeconds,
  );

  const technicalResolution =
    technicalInfo?.resolution ||
    technicalMetadata.resolution ||
    (technicalInfo?.width != null && technicalInfo?.height != null
      ? `${technicalInfo.width} × ${technicalInfo.height}`
      : technicalMetadata.width != null && technicalMetadata.height != null
        ? `${technicalMetadata.width} × ${technicalMetadata.height}`
        : null);

  const resolutionBadgeClass = getResolutionBadgeClass(
    technicalInfo?.resolution ?? technicalMetadata.resolution,
    technicalInfo?.width ?? technicalMetadata.width,
    technicalInfo?.height ?? technicalMetadata.height,
  );

  const technicalVideoItems = [
    ["Resolution", technicalInfo?.resolution ?? technicalMetadata.resolution],
    [
      "Dimensions",
      (technicalInfo?.width ?? technicalMetadata.width) != null &&
      (technicalInfo?.height ?? technicalMetadata.height) != null
        ? `${technicalInfo?.width ?? technicalMetadata.width} × ${
            technicalInfo?.height ?? technicalMetadata.height
          }`
        : null,
    ],
    [
      "Duration",
      formatTechnicalDuration(
        technicalInfo?.durationSeconds ?? technicalMetadata.durationSeconds,
      ),
    ],
    ["Video codec", formatCodec(technicalInfo?.videoCodec)],
    ["Frame rate", formatFrameRate(technicalInfo?.frameRate)],
    [
      "File size",
      formatFileSize(
        technicalInfo?.fileSizeBytes ?? technicalMetadata.fileSizeBytes,
      ),
    ],
  ].filter(([, value]) => value != null && value !== "");

  const technicalAudioItems = [
    ["Audio codec", formatCodec(technicalInfo?.audioCodec)],
    [
      "Channels",
      technicalInfo?.audioChannels != null
        ? `${technicalInfo.audioChannels} channel${technicalInfo.audioChannels === 1 ? "" : "s"}`
        : null,
    ],
    ["Channel layout", technicalInfo?.audioChannelLayout],
  ].filter(([, value]) => value != null && value !== "");

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
            aria-label={backLabel}
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
            <span>{backLabel}</span>
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
  const primaryStudio = metadata.studio;

  const allStudios =
    studios.length > 0 ? studios : primaryStudio ? [primaryStudio] : [];

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
            initialMuted={defaultMuted}
            initialPlaybackTime={initialPlaybackTime}
            onProgress={savePlaybackProgress}
            onPause={savePlaybackProgress}
            onEnded={handlePlaybackEnded}
            onError={() => {
              setPlayError(
                "The video couldn't be loaded. Please check the file.",
              );
            }}
            lastPlaybackTimeRef={lastPlaybackTimeRef}
            playbackDurationRef={playbackDurationRef}
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
              aria-label={backLabel}
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
              <span>{backLabel}</span>
            </button>

            <div className="eyebrow">
              <span className="eyebrow-dot" />
              YOUR PERSONAL CINEMA
            </div>

            <h1 className="hero-title">{metadata.title || "Untitled video"}</h1>

            <div className="hero-badges">
              {technicalResolution && (
                <span
                  className={`resolution-badge ${resolutionBadgeClass}`}
                  title="Video resolution"
                >
                  {technicalResolution}
                </span>
              )}

              {technicalDuration && (
                <span className="duration-badge" title="Video duration">
                  {technicalDuration}
                </span>
              )}

              {metadata.year != null && <span>{metadata.year}</span>}
              {metadata.mpaa && <span>{metadata.mpaa}</span>}
              {metadata.language && <span>{metadata.language}</span>}
            </div>

            {genres.length > 0 && (
              <div className="hero-genres">
                {renderDiscoverableList(genres, "genres")}
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
                disabled={playbackProgressLoading}
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
                <span>
                  {playbackProgressLoading
                    ? "Loading..."
                    : initialPlaybackTime > 0 && !playbackCompleted
                      ? "Resume"
                      : "Play"}
                </span>
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
                {actors.map((actor, index) => {
                  const actorName = getItemName(actor);
                  const hasId = typeof actor === "object" && Boolean(actor?.id);
                  const actorImageUrl = getActorProfileImageUrl(actor);

                  return (
                    <button
                      type="button"
                      className={`cast-card cast-card-discoverable${hasId ? "" : " metadata-link-disabled"}`}
                      key={getItemKey(actor, index)}
                      onClick={() => handleDiscover("actors", actor)}
                      disabled={!hasId}
                      aria-label={
                        hasId
                          ? `Explore movies featuring ${actorName}`
                          : undefined
                      }
                    >
                      <div className="cast-avatar">
                        <span
                          className="cast-avatar-initial"
                          aria-hidden="true"
                        >
                          {(actorName || "?").charAt(0)}
                        </span>

                        {actorImageUrl && (
                          <img
                            className="cast-avatar-image"
                            src={actorImageUrl}
                            alt=""
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                      </div>

                      <div className="cast-info">
                        <span className="cast-name">{actorName}</span>
                        {actor.role && (
                          <span className="cast-role">{actor.role}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(directors.length > 0 || writers.length > 0) && (
            <div className="detail-section">
              <h2>Credits</h2>

              {directors.length > 0 && (
                <div className="detail-row">
                  <span>Director</span>
                  <strong className="metadata-link-list">
                    {renderDiscoverableList(directors, "directors")}
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
              ]
                .filter(([, value]) => value != null && value !== "")
                .map(([label, value]) => (
                  <div className="detail-item" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}

              {allStudios.length > 0 && (
                <div className="detail-item" key="Studio">
                  <span>Studio</span>
                  <strong className="metadata-link-list">
                    {renderDiscoverableList(allStudios, "studios")}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {hasTechnicalInfoSection && (
            <div className="technical-info-section">
              <button
                type="button"
                className="technical-info-toggle"
                onClick={() =>
                  setTechnicalInfoExpanded((expanded) => !expanded)
                }
                aria-expanded={technicalInfoExpanded}
                aria-controls="technical-info-panel"
              >
                <span className="technical-info-heading">
                  <span className="technical-info-icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="13" rx="2" />
                      <path d="M8 21h8m-4-4v4M7 9h4m-4 4h7" />
                    </svg>
                  </span>
                  <span>
                    <strong>Technical information</strong>
                    <small>File and playback specifications</small>
                  </span>
                </span>

                <span
                  className={`technical-info-chevron${technicalInfoExpanded ? " is-expanded" : ""}`}
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </button>

              <div
                id="technical-info-panel"
                className={`technical-info-collapse${technicalInfoExpanded ? " is-expanded" : ""}`}
                aria-hidden={!technicalInfoExpanded}
                inert={!technicalInfoExpanded}
              >
                <div className="technical-info-collapse-inner">
                  <div className="technical-info-content">
                    {technicalInfoError && (
                      <p className="technical-info-error" role="alert">
                        {technicalInfoError}
                      </p>
                    )}

                    {isTechnicalInfoActive && (
                      <div className="technical-info-message">
                        <span className="technical-info-spinner" />
                        Analysing your media file...
                      </div>
                    )}

                    {isTechnicalInfoCompleted && (
                      <>
                        {technicalVideoItems.length > 0 && (
                          <div className="technical-info-group">
                            <h3>VIDEO</h3>
                            <div className="technical-info-grid">
                              {technicalVideoItems.map(([label, value]) => (
                                <div
                                  className="technical-info-item"
                                  key={label}
                                >
                                  <span>{label}</span>
                                  <strong>{value}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {technicalAudioItems.length > 0 && (
                          <div className="technical-info-group">
                            <h3>AUDIO</h3>
                            <div className="technical-info-grid">
                              {technicalAudioItems.map(([label, value]) => (
                                <div
                                  className="technical-info-item"
                                  key={label}
                                >
                                  <span>{label}</span>
                                  <strong>{value}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {technicalVideoItems.length === 0 &&
                          technicalAudioItems.length === 0 && (
                            <p className="technical-info-empty">
                              No technical details are available for this file.
                            </p>
                          )}
                      </>
                    )}

                    {isTechnicalInfoFailed && (
                      <div className="technical-info-failed">
                        <p>
                          {technicalInfo?.error ||
                            "Technical analysis couldn't be completed."}
                        </p>
                        <button
                          type="button"
                          className="technical-info-action technical-info-retry"
                          onClick={handleAnalyzeTechnicalInfo}
                          disabled={technicalInfoRequesting}
                        >
                          Try again
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tags.length > 0 && (
            <div className="detail-section">
              <h2>Tags</h2>

              <div className="tag-list">
                {renderDiscoverableList(tags, "tags")}
              </div>
            </div>
          )}

          <MovieGallery collectionId={collectionId} mediaItemId={mediaItemId} />
        </section>
      </div>
    </main>
  );
}

export default VideoPage;
