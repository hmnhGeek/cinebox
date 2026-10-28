import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronRight, LoaderCircle, UserRound } from "lucide-react";
import VideoCard from "../../components/videoCard/VideoCard";
import "./DiscoveryPage.css";
import discoveryhero from "../../assets/discoveryhero.jpg";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

const PAGE_SIZE = 24;

const DISCOVERY_TYPES = {
  tags: {
    title: "Tag",
    description: (name) => `Movies connected to ${name} tag.`,
    fallbackDescription: "Explore movies connected to this tag.",
    metadataKey: "tags",
  },
  genres: {
    title: "Genre",
    description: (name) => `Explore movies in ${name} genre.`,
    fallbackDescription: "Explore movies in this genre.",
    metadataKey: "genres",
  },
  actors: {
    title: "Actor",
    description: (name) => `Explore movies featuring ${name}.`,
    fallbackDescription: "Explore movies featuring this actor.",
    metadataKey: "actors",
  },
  studios: {
    title: "Studio",
    description: (name) => `Explore movies from ${name}.`,
    fallbackDescription: "Explore movies from this studio.",
    metadataKey: "studios",
  },
  directors: {
    title: "Director",
    description: (name) => `Explore movies directed by ${name}.`,
    fallbackDescription: "Explore movies directed by this person.",
    metadataKey: "directors",
  },
};

function resolveApiUrl(url) {
  if (!url) return null;

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function DiscoveryPage() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [failedHeroUrl, setFailedHeroUrl] = useState(null);
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [actorProfile, setActorProfile] = useState(null);

  const discoveryType = DISCOVERY_TYPES[type];
  const isActorPage = type === "actors";

  const profileImageUrl = useMemo(
    () => resolveApiUrl(actorProfile?.profileImageUrl),
    [actorProfile?.profileImageUrl],
  );

  const profileHeroUrl = useMemo(
    () => resolveApiUrl(actorProfile?.heroImageUrl),
    [actorProfile?.heroImageUrl],
  );

  const heroSrc =
    isActorPage && profileHeroUrl && failedHeroUrl !== profileHeroUrl
      ? profileHeroUrl
      : discoveryhero;

  // Load the additional actor profile only on actor discovery pages.
  useEffect(() => {
    if (!isActorPage || !id) {
      setActorProfile(null);
      return;
    }

    const controller = new AbortController();

    setActorProfile(null);
    setProfileImageFailed(false);

    async function fetchActorProfile() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/people/${encodeURIComponent(id)}/profile`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`Unable to load actor profile (${response.status}).`);
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          setActorProfile(data);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          // Profile data is supplementary. Keep movie discovery usable.
          console.warn("Unable to load actor profile.", err);
        }
      }
    }

    fetchActorProfile();

    return () => controller.abort();
  }, [isActorPage, id, retryKey]);

  const discoveryName = useMemo(() => {
    if (!discoveryType || !id) return null;

    // Prefer the canonical name returned by the actor profile API.
    if (isActorPage && actorProfile?.name) {
      return actorProfile.name;
    }

    for (const video of videos) {
      const items = video?.[discoveryType.metadataKey];

      if (!Array.isArray(items)) continue;

      const match = items.find(
        (item) =>
          item && typeof item === "object" && String(item.id) === String(id),
      );

      if (match) {
        const name = match.name || match.title;
        if (name) return name;
      }
    }

    return null;
  }, [videos, discoveryType, id, isActorPage, actorProfile?.name]);

  const discoveryDescription = discoveryName
    ? discoveryType.description(discoveryName)
    : discoveryType?.fallbackDescription;

  const fetchVideos = useCallback(
    async (signal) => {
      if (!discoveryType || !id) {
        setVideos([]);
        setTotalPages(0);
        setTotalElements(0);
        setError("This discovery page could not be found.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const url =
          `${API_BASE_URL}/api/v1/discovery/${type}/` +
          `${encodeURIComponent(id)}/videos?page=${page}&size=${PAGE_SIZE}`;

        const response = await fetch(url, { signal });

        if (!response.ok) {
          throw new Error(
            `Unable to load discovery results (${response.status}).`,
          );
        }

        const data = await response.json();

        if (signal.aborted) return;

        setVideos(Array.isArray(data.content) ? data.content : []);
        setTotalPages(Number(data.totalPages) || 0);
        setTotalElements(Number(data.totalElements) || 0);
      } catch (err) {
        if (err.name === "AbortError") return;

        setVideos([]);
        setTotalPages(0);
        setTotalElements(0);
        setError(err.message || "Something went wrong while loading movies.");
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [type, id, page, discoveryType],
  );

  useEffect(() => {
    const controller = new AbortController();

    fetchVideos(controller.signal);

    return () => controller.abort();
  }, [fetchVideos, retryKey]);

  // Reset hero loading state whenever the displayed artwork changes.
  useEffect(() => {
    setHeroImageLoaded(false);
  }, [type, id, heroSrc]);

  useEffect(() => {
    setProfileImageFailed(false);
  }, [type, id, profileImageUrl]);

  const handleHeroImageLoad = (event) => {
    if (event.currentTarget.naturalWidth > 0) {
      setHeroImageLoaded(true);
    }
  };

  const handleHeroImageError = (event) => {
    if (isActorPage && profileHeroUrl && heroSrc === profileHeroUrl) {
      // A broken actor hero should fall back to the existing artwork.
      setFailedHeroUrl(profileHeroUrl);
      setHeroImageLoaded(false);
      return;
    }

    event.currentTarget.style.visibility = "hidden";
    setHeroImageLoaded(true);
  };

  const handleVideoClick = (video) => {
    const collectionId =
      video.collectionId ||
      video.collection?.id ||
      video.collection?.collectionId;

    if (!collectionId || !video.id) {
      console.error("Cannot navigate to video: required IDs are missing.", {
        videoId: video.id,
        collectionId,
      });

      setError(
        "This movie is missing its collection information. " +
          "Include collectionId in the discovery API response to enable playback.",
      );
      return;
    }

    navigate(
      `/videos/${encodeURIComponent(collectionId)}/${encodeURIComponent(
        video.id,
      )}`,
      {
        state: {
          from: {
            type: "discovery",
            pathname: location.pathname,
            search: location.search,
          },
        },
      },
    );
  };

  const getThumbnailUrl = (video) => {
    if (!video.thumbnailUrl) return discoveryhero;

    return resolveApiUrl(video.thumbnailUrl);
  };

  const getPreviewUrl = (video) => {
    if (!video.id) return null;

    return (
      `${API_BASE_URL}/api/v1/collections/preview?mediaItemId=` +
      encodeURIComponent(video.id)
    );
  };

  const goToPage = (nextPage) => {
    if (nextPage < 0 || nextPage >= totalPages || nextPage === page) {
      return;
    }

    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const retryLoading = () => {
    setRetryKey((current) => current + 1);
  };

  if (!discoveryType) {
    return (
      <main className="discovery-page">
        <div className="discovery-state discovery-state-panel">
          <span className="discovery-eyebrow">CINEBOX DISCOVERY</span>
          <h2>Discovery unavailable</h2>
          <p>This discovery category does not exist.</p>

          <button
            className="discovery-back-button"
            onClick={() => navigate(-1)}
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
            Go back
          </button>
        </div>
      </main>
    );
  }

  const biography =
    typeof actorProfile?.biography === "string"
      ? actorProfile.biography.trim()
      : "";

  const hasActorProfileContent = isActorPage && (profileImageUrl || biography);

  return (
    <main className="discovery-page">
      <section
        className={`discovery-hero ${
          heroImageLoaded ? "hero-ready" : "hero-loading"
        } ${isActorPage ? "discovery-hero-actor" : ""}`}
        aria-label="Discovery collection"
      >
        <img
          key={`${type}-${id}-${heroSrc}`}
          className={`discovery-hero-image ${
            heroImageLoaded ? "loaded" : "loading"
          }`}
          src={heroSrc}
          alt=""
          fetchPriority="high"
          onLoad={handleHeroImageLoad}
          onError={handleHeroImageError}
          ref={(image) => {
            if (!image || !image.complete) return;

            if (image.naturalWidth > 0) {
              setHeroImageLoaded(true);
            } else {
              handleHeroImageError({ currentTarget: image });
            }
          }}
        />

        {!heroImageLoaded && (
          <div className="discovery-hero-skeleton" aria-hidden="true">
            <div className="discovery-skeleton-content">
              <div className="discovery-skeleton-back" />
              <div className="discovery-skeleton-eyebrow" />
              <div className="discovery-skeleton-title" />
              <div className="discovery-skeleton-description" />
              <div className="discovery-skeleton-divider" />
            </div>

            <div className="discovery-skeleton-bottom">
              <span className="discovery-skeleton-label" />
              <span className="discovery-skeleton-label short" />
            </div>

            <div className="discovery-skeleton-status">
              <span className="discovery-skeleton-spinner" />
              <span>Preparing your discovery experience</span>
            </div>
          </div>
        )}

        <div className="discovery-hero-overlay" />

        {heroImageLoaded && (
          <div className="discovery-hero-content">
            <button
              className="discovery-back-button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
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
              Back
            </button>

            <span className="discovery-eyebrow">
              CINEBOX <span className="discovery-eyebrow-separator">/</span>{" "}
              DISCOVERY
            </span>

            <h1>{discoveryName || `${discoveryType.title} Collection`}</h1>

            <p>{discoveryDescription}</p>

            <div className="discovery-hero-divider" />
          </div>
        )}
      </section>

      <div className="discovery-content">
        {hasActorProfileContent && (
          <section
            className="actor-profile"
            aria-label={`About ${discoveryName || "this actor"}`}
          >
            {profileImageUrl && !profileImageFailed ? (
              <div className="actor-profile-portrait">
                <img
                  src={profileImageUrl}
                  alt={discoveryName || "Actor portrait"}
                  loading="lazy"
                  onError={() => setProfileImageFailed(true)}
                />
              </div>
            ) : (
              <div className="actor-profile-portrait actor-profile-portrait-placeholder">
                <UserRound size={34} strokeWidth={1.3} aria-hidden="true" />
              </div>
            )}

            <div className="actor-profile-details">
              <span className="discovery-section-eyebrow">
                THE PERSON BEHIND THE PERFORMANCES
              </span>

              <h2>{discoveryName || "Actor profile"}</h2>

              {biography ? (
                <p className="actor-profile-biography">{biography}</p>
              ) : (
                <p className="actor-profile-empty">
                  A biography hasn't been added yet.
                </p>
              )}
            </div>
          </section>
        )}

        <section className="discovery-results-heading">
          <div className="discovery-results-title">
            <span className="discovery-section-eyebrow">
              {isActorPage ? "FILMOGRAPHY" : "YOUR DISCOVERIES"}
            </span>
          </div>

          {!loading && !error && (
            <div className="discovery-result-count">
              <span className="discovery-result-number">
                {totalElements.toLocaleString()}
              </span>

              <span>
                {totalElements === 1 ? "movie available" : "movies available"}
              </span>
            </div>
          )}
        </section>

        {error && (
          <div className="discovery-error" role="alert">
            <div className="discovery-error-copy">
              <span className="discovery-error-title">
                Something went wrong
              </span>
              <p>{error}</p>
            </div>

            <button onClick={retryLoading}>Try again</button>
          </div>
        )}

        {loading ? (
          <div className="discovery-state" aria-live="polite">
            <LoaderCircle
              className="discovery-spinner"
              size={30}
              strokeWidth={1.5}
            />
            <h2>Finding your next watch</h2>
            <p>Curating the titles in this collection...</p>
          </div>
        ) : !error && videos.length === 0 ? (
          <div className="discovery-state discovery-state-panel">
            <span className="discovery-empty-mark">
              <span />
            </span>

            <h2>Nothing here just yet</h2>

            <p>
              There are no movies associated with this{" "}
              {discoveryType.title.toLowerCase()} yet. Check back when your
              collection grows.
            </p>
          </div>
        ) : !error ? (
          <>
            <section
              className="video-grid discovery-video-grid"
              aria-label="Discovery movies"
            >
              {videos.map((video, index) => (
                <VideoCard
                  key={video.id || `${video.title}-${index}`}
                  video={video}
                  thumbnailUrl={getThumbnailUrl(video)}
                  fallbackThumbnailUrl={discoveryhero}
                  previewUrl={getPreviewUrl(video)}
                  handleClick={() => handleVideoClick(video)}
                />
              ))}
            </section>

            {totalPages > 1 && (
              <nav
                className="discovery-pagination"
                aria-label="Discovery results pages"
              >
                <button
                  className="discovery-page-button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 0}
                  aria-label="Previous page"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="17"
                    height="17"
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
                  Previous
                </button>

                <span className="discovery-page-indicator">
                  <span>PAGE</span>
                  <strong>{page + 1}</strong>
                  <span className="discovery-page-of">OF</span>
                  <strong>{totalPages}</strong>
                </span>

                <button
                  className="discovery-page-button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages - 1}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight size={17} />
                </button>
              </nav>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

export default DiscoveryPage;
