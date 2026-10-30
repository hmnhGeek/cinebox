import { useCallback, useEffect, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useNavigationType,
  useSearchParams,
} from "react-router-dom";
import {
  AlertCircle,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { useActorsFilter } from "../../context/ActorsFilterContext";
import "./ActorsPage.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

const PAGE_SIZE = 30;
const FALLBACK_PROFILE_URL = null;

function getImageUrl(url, actorId) {
  const imageUrl =
    url || `/api/v1/people/${encodeURIComponent(actorId)}/profile/image`;

  if (!imageUrl) return FALLBACK_PROFILE_URL;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;

  return `${API_BASE_URL}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

function ActorPortrait({ actor }) {
  const [imageFailed, setImageFailed] = useState(false);

  const imageUrl = getImageUrl(actor.profileImageUrl, actor.id);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <div className="actors-card-portrait">
      {!imageFailed && imageUrl ? (
        <img
          src={imageUrl}
          alt={actor.name ? `${actor.name} portrait` : "Actor portrait"}
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="actors-card-placeholder" aria-hidden="true">
          <UsersRound size={36} strokeWidth={1.2} />
        </div>
      )}

      <div className="actors-card-image-shade" />

      <div className="actors-card-open-indicator" aria-hidden="true">
        <span>View filmography</span>
      </div>
    </div>
  );
}

function ActorsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [, setSearchParams] = useSearchParams();

  const { hasProfileImage, setHasProfileImage } = useActorsFilter();

  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const nextPageRef = useRef(0);
  const failedPageRef = useRef(0);
  const requestSequenceRef = useRef(0);
  const activeRequestRef = useRef(null);

  const [actors, setActors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);

  const urlFilter = new URLSearchParams(location.search).get("hasProfileImage");

  // Synchronize the URL and session preference.
  //
  // POP means browser Back/Forward navigation: restore the filter
  // represented by that historical URL.
  //
  // PUSH/REPLACE means normal navigation or a filter update:
  // retain the session preference and reflect it in the URL.
  useEffect(() => {
    if (navigationType === "POP") {
      const restoredValue = urlFilter === "true";

      setHasProfileImage((current) =>
        current === restoredValue ? current : restoredValue,
      );

      return;
    }

    const urlHasFilter = urlFilter === "true";

    if (urlHasFilter === hasProfileImage) {
      return;
    }

    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);

        if (hasProfileImage) {
          nextParams.set("hasProfileImage", "true");
        } else {
          nextParams.delete("hasProfileImage");
        }

        return nextParams;
      },
      {
        replace: true,
        preventScrollReset: true,
      },
    );
  }, [
    location.key,
    location.pathname,
    location.search,
    navigationType,
    urlFilter,
    hasProfileImage,
    setHasProfileImage,
    setSearchParams,
  ]);

  const loadActors = useCallback(
    async (pageToLoad, replace = false) => {
      if (loadingRef.current && !replace) return;

      if (replace) {
        activeRequestRef.current?.abort();
      }

      const controller = new AbortController();
      const requestId = ++requestSequenceRef.current;

      activeRequestRef.current = controller;
      loadingRef.current = true;
      failedPageRef.current = pageToLoad;

      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(pageToLoad),
          size: String(PAGE_SIZE),
        });

        if (hasProfileImage) {
          params.set("hasProfileImage", "true");
        }

        const response = await fetch(
          `${API_BASE_URL}/api/v1/discovery/actors?${params.toString()}`,
          {
            method: "GET",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "The actors directory endpoint was not found."
              : `Unable to load actors (HTTP ${response.status}).`,
          );
        }

        const data = await response.json();

        if (requestId !== requestSequenceRef.current) return;

        const pageActors = Array.isArray(data.content) ? data.content : [];

        setActors((current) => {
          if (replace) return pageActors;

          const existingIds = new Set(current.map((actor) => actor.id));
          const newActors = pageActors.filter(
            (actor) => !existingIds.has(actor.id),
          );

          return [...current, ...newActors];
        });

        nextPageRef.current = pageToLoad + 1;

        const morePages =
          typeof data.last === "boolean"
            ? !data.last
            : typeof data.totalPages === "number"
              ? pageToLoad + 1 < data.totalPages
              : pageActors.length === PAGE_SIZE;

        setHasMore(morePages);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        if (requestId !== requestSequenceRef.current) return;

        console.error("Failed to load actors:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while loading actors.",
        );
      } finally {
        if (requestId === requestSequenceRef.current) {
          loadingRef.current = false;
          activeRequestRef.current = null;
          setLoading(false);
        }
      }
    },
    [hasProfileImage],
  );

  useEffect(() => {
    nextPageRef.current = 0;
    failedPageRef.current = 0;

    loadActors(0, true);

    return () => {
      requestSequenceRef.current += 1;
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
      loadingRef.current = false;
    };
  }, [loadActors]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || !hasMore || loading || error) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingRef.current) {
          loadActors(nextPageRef.current);
        }
      },
      {
        root: null,
        rootMargin: "500px 0px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, loading, error, actors.length, loadActors]);

  const openActor = useCallback(
    (actor) => {
      if (!actor?.id) return;

      const returnTo = `${location.pathname}${location.search}`;

      navigate(`/discover/actors/${encodeURIComponent(actor.id)}`, {
        state: {
          returnTo,
        },
      });
    },
    [navigate, location.pathname, location.search],
  );

  const toggleProfileImageFilter = useCallback(() => {
    const nextValue = !hasProfileImage;

    setActors([]);
    setHasMore(true);
    setError("");

    nextPageRef.current = 0;
    failedPageRef.current = 0;

    // Update the shared session preference.
    setHasProfileImage(nextValue);

    // Keep the URL synchronized with the selected filter.
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);

        if (nextValue) {
          nextParams.set("hasProfileImage", "true");
        } else {
          nextParams.delete("hasProfileImage");
        }

        return nextParams;
      },
      { preventScrollReset: true },
    );
  }, [hasProfileImage, setHasProfileImage, setSearchParams]);

  const retryLoading = () => {
    const pageToRetry = failedPageRef.current;

    loadActors(pageToRetry, pageToRetry === 0);
  };

  const showAllActors = useCallback(() => {
    if (!hasProfileImage) return;

    toggleProfileImageFilter();
  }, [hasProfileImage, toggleProfileImageFilter]);

  const isEmpty = !loading && !error && actors.length === 0;

  return (
    <main className="app actors-page">
      <section className="actors-content">
        <div className="actors-page-heading">
          <div className="actors-heading-copy">
            <span className="actors-eyebrow">CINEBOX DISCOVERY</span>

            <h1>Actors</h1>

            <p>
              Explore the people behind your collection and discover their
              filmographies.
            </p>
          </div>

          <div className="actors-heading-actions">
            <button
              type="button"
              className={`actors-filter-toggle ${
                hasProfileImage ? "is-active" : ""
              }`}
              aria-pressed={hasProfileImage}
              onClick={toggleProfileImageFilter}
              title={
                hasProfileImage
                  ? "Show all actors"
                  : "Show only actors with profile photos"
              }
            >
              <ImageIcon size={15} strokeWidth={1.8} aria-hidden="true" />

              <span>With photos</span>

              <span className="actors-filter-indicator" aria-hidden="true" />
            </button>
          </div>
        </div>

        {loading && actors.length === 0 ? (
          <div className="actors-state actors-initial-loading" role="status">
            <LoaderCircle size={28} className="actors-spinner" />

            <span>
              {hasProfileImage
                ? "Finding actors with photos"
                : "Loading actors"}
            </span>

            <p>Preparing your directory...</p>
          </div>
        ) : error && actors.length === 0 ? (
          <div className="actors-state actors-error-state" role="alert">
            <AlertCircle size={28} />

            <h2>Couldn't load actors</h2>

            <p>{error}</p>

            <button
              type="button"
              className="actors-retry-button"
              onClick={retryLoading}
            >
              <RefreshCw size={15} />
              Try again
            </button>
          </div>
        ) : isEmpty ? (
          <div className="actors-state actors-empty-state">
            <ImageIcon size={30} strokeWidth={1.3} />

            <h2>
              {hasProfileImage ? "No actors with photos" : "No actors found"}
            </h2>

            <p>
              {hasProfileImage
                ? "No actors with stored profile photos were found in your collection. Try the full directory instead."
                : "Actors will appear here when they are available in your library."}
            </p>

            {hasProfileImage && (
              <button
                type="button"
                className="actors-retry-button"
                onClick={showAllActors}
              >
                <UsersRound size={15} />
                Show all actors
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="actors-grid">
              {actors.map((actor) => (
                <button
                  type="button"
                  className="actors-card"
                  key={actor.id}
                  onClick={() => openActor(actor)}
                  aria-label={`View ${actor.name || "actor"} filmography`}
                  title={actor.name || "Unknown actor"}
                >
                  <ActorPortrait actor={actor} />

                  <div className="actors-card-info">
                    <h2>{actor.name || "Unknown actor"}</h2>
                  </div>
                </button>
              ))}
            </div>

            {error && actors.length > 0 && (
              <div className="actors-load-more-error" role="alert">
                <div>
                  <AlertCircle size={17} />
                  <span>{error}</span>
                </div>

                <button type="button" onClick={retryLoading}>
                  Retry
                </button>
              </div>
            )}

            {loading && actors.length > 0 && (
              <div className="actors-load-more" role="status">
                <LoaderCircle size={20} className="actors-spinner" />
                <span>Loading more actors...</span>
              </div>
            )}

            {!hasMore && !loading && !error && (
              <div className="actors-end-message">
                <span />
                <p>You've reached the end of the directory</p>
                <span />
              </div>
            )}

            <div
              ref={sentinelRef}
              className="actors-scroll-sentinel"
              aria-hidden="true"
            />
          </>
        )}
      </section>
    </main>
  );
}

export default ActorsPage;
