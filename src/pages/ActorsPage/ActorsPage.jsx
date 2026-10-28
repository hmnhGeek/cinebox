import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, LoaderCircle, RefreshCw, UsersRound } from "lucide-react";
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
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const nextPageRef = useRef(0);
  const failedPageRef = useRef(0);

  const [actors, setActors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);

  const loadActors = useCallback(async (pageToLoad, replace = false) => {
    if (loadingRef.current) return;

    loadingRef.current = true;
    failedPageRef.current = pageToLoad;
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/discovery/actors?page=${pageToLoad}&size=${PAGE_SIZE}`,
        {
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
      console.error("Failed to load actors:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading actors.",
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActors(0, true);
  }, [loadActors]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || !hasMore || loading || error) return undefined;

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

      navigate(`/discover/actors/${encodeURIComponent(actor.id)}`);
    },
    [navigate],
  );

  const retryLoading = () => {
    loadActors(failedPageRef.current, failedPageRef.current === 0);
  };

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

          {actors.length > 0 && (
            <div className="actors-count" aria-live="polite">
              <UsersRound size={16} aria-hidden="true" />
              <span>{actors.length.toLocaleString()} loaded</span>
            </div>
          )}
        </div>

        {loading && actors.length === 0 ? (
          <div className="actors-state actors-initial-loading" role="status">
            <LoaderCircle size={28} className="actors-spinner" />
            <span>Loading actors</span>
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
        ) : actors.length === 0 ? (
          <div className="actors-state actors-empty-state">
            <UsersRound size={30} strokeWidth={1.3} />
            <h2>No actors found</h2>
            <p>
              Actors will appear here when they are available in your library.
            </p>
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
                    <span>View filmography</span>
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

            {loading && (
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
