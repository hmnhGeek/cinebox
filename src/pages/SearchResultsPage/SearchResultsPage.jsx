import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { LoaderCircle, Search, UsersRound } from "lucide-react";
import VideoGrid from "../../components/videoGrid/VideoGrid";
import {
  getSearchResults,
  getSearchSuggestions,
} from "../../service/searchApis";
import "./SearchResultsPage.css";

function getImageUrl(url) {
  if (!url) return "";

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

function ActorCard({ actor, onClick }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getImageUrl(actor.profileImageUrl);

  return (
    <button
      type="button"
      className="search-actor-card"
      onClick={onClick}
      aria-label={`View ${actor.name || "actor"} profile`}
    >
      <span className="search-actor-portrait">
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="search-actor-placeholder">
            <UsersRound size={24} strokeWidth={1.4} />
          </span>
        )}
      </span>

      <span className="search-actor-name">{actor.name || "Unknown actor"}</span>
    </button>
  );
}

function SearchResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const query = (searchParams.get("q") || "").trim();

  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [actors, setActors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actorsLoading, setActorsLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    if (query.length < 2) {
      setData(null);
      setError("");
      setLoading(false);
      return undefined;
    }

    async function loadResults() {
      setLoading(true);
      setError("");

      try {
        const result = await getSearchResults(query, page, 24);

        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load search results:", err);
          setError("Couldn't load your search results. Please try again.");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadResults();

    return () => {
      cancelled = true;
    };
  }, [query, page, retryCount]);

  useEffect(() => {
    let cancelled = false;

    if (query.length < 2) {
      setActors([]);
      setActorsLoading(false);
      return undefined;
    }

    async function loadActors() {
      setActorsLoading(true);
      setActors([]);

      try {
        const result = await getSearchSuggestions(query, 8);

        if (!cancelled) {
          setActors(Array.isArray(result?.actors) ? result.actors : []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load matching actors:", err);
          setActors([]);
        }
      } finally {
        if (!cancelled) {
          setActorsLoading(false);
        }
      }
    }

    loadActors();

    return () => {
      cancelled = true;
    };
  }, [query]);

  const videos = data?.content || [];
  const totalVideoResults = data?.totalElements ?? videos.length;
  const hasVideos = videos.length > 0;
  const hasActors = actors.length > 0;

  const returnTo = `${location.pathname}${location.search}`;

  const showEmptyState =
    !loading &&
    !actorsLoading &&
    !error &&
    !hasVideos &&
    !hasActors &&
    query.length >= 2;

  return (
    <main className="search-results-page">
      <header className="search-results-heading">
        <div className="search-results-eyebrow">
          <Search size={13} />
          <span>SEARCH</span>
        </div>

        <h1>
          Results for{" "}
          {query && <span className="search-results-query">“{query}”</span>}
        </h1>

        {query.length >= 2 && !loading && !error && data && (
          <p className="search-results-summary">
            {totalVideoResults} {totalVideoResults === 1 ? "video" : "videos"}
            {!actorsLoading && hasActors && (
              <>
                {" "}
                <span>·</span> {actors.length}{" "}
                {actors.length === 1 ? "person" : "people"}
              </>
            )}
          </p>
        )}
      </header>

      {query.length < 2 ? (
        <div className="search-results-state">
          <Search size={23} strokeWidth={1.4} />
          <p>Search for a title, actor, genre, tag, or studio.</p>
        </div>
      ) : (
        <>
          {(actorsLoading || hasActors) && (
            <section
              className="search-people-section"
              aria-labelledby="search-people-title"
            >
              <div className="search-section-heading">
                <UsersRound size={16} strokeWidth={1.6} />
                <h2 id="search-people-title">People</h2>
                {!actorsLoading && hasActors && (
                  <span className="search-section-count">{actors.length}</span>
                )}
              </div>

              {actorsLoading ? (
                <div className="search-inline-loading">
                  <LoaderCircle size={17} className="search-results-spinner" />
                  <span>Finding people</span>
                </div>
              ) : (
                <div className="search-actors-row">
                  {actors.map((actor) => (
                    <ActorCard
                      key={actor.id}
                      actor={actor}
                      onClick={() => {
                        if (!actor?.id) return;

                        navigate(
                          `/discover/actors/${encodeURIComponent(actor.id)}`,
                        );
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          <section
            className="search-videos-section"
            aria-labelledby="search-videos-title"
          >
            <div className="search-section-heading search-videos-heading">
              <Search size={16} strokeWidth={1.6} />
              <h2 id="search-videos-title">Videos</h2>
              {!loading && !error && data && (
                <span className="search-section-count">
                  {totalVideoResults}
                </span>
              )}
            </div>

            {loading ? (
              <div className="search-results-state">
                <LoaderCircle size={23} className="search-results-spinner" />
                <p>Searching your library</p>
              </div>
            ) : error ? (
              <div className="search-results-state search-results-error">
                <p>{error}</p>
                <button
                  type="button"
                  className="search-results-retry"
                  onClick={() => setRetryCount((count) => count + 1)}
                >
                  Try again
                </button>
              </div>
            ) : hasVideos ? (
              <>
                <VideoGrid videos={videos} returnTo={returnTo} />

                {data && data.totalPages > 1 && (
                  <nav
                    className="search-results-pagination"
                    aria-label="Search result pages"
                  >
                    <button
                      type="button"
                      disabled={page <= 0 || loading}
                      onClick={() => {
                        setPage((current) => Math.max(0, current - 1));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Previous
                    </button>

                    <span>
                      {page + 1} <span className="pagination-divider">/</span>{" "}
                      {data.totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={page + 1 >= data.totalPages || loading}
                      onClick={() => {
                        setPage((current) => current + 1);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Next
                    </button>
                  </nav>
                )}
              </>
            ) : (
              !showEmptyState && (
                <div className="search-results-state search-videos-empty">
                  <p>
                    {hasActors
                      ? "No matching videos. Matching people are shown above."
                      : "No matching videos found."}
                  </p>
                </div>
              )
            )}
          </section>

          {showEmptyState && (
            <div className="search-results-state search-results-empty">
              <Search size={23} strokeWidth={1.4} />
              <strong>No matches found</strong>
              <p>Try another search term.</p>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default SearchResultsPage;
