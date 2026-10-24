import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { LoaderCircle, Search } from "lucide-react";
import VideoGrid from "../../components/videoGrid/VideoGrid";
import { getSearchResults } from "../../service/searchApis";
import "./SearchResultsPage.css";

function SearchResultsPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const query = (searchParams.get("q") || "").trim();

  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
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
          setError("We couldn't load your search results. Please try again.");
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

  const videos = data?.content || [];

  // Preserve the current search URL when opening a movie.
  const returnTo = `${location.pathname}${location.search}`;

  return (
    <main className="search-results-page">
      <section className="search-results-heading">
        <div className="search-results-eyebrow">
          <Search size={14} />
          <span>LIBRARY SEARCH</span>
        </div>

        <h1>
          Search results for
          {query && <span className="search-results-query"> “{query}”</span>}
        </h1>

        <p className="search-results-subtitle">
          Find movies across all your available collections.
        </p>

        {!loading && !error && data && (
          <div className="search-results-count">
            {data.totalElements ?? videos.length}{" "}
            {(data.totalElements ?? videos.length) === 1 ? "result" : "results"}
          </div>
        )}
      </section>

      {query.length < 2 ? (
        <div className="search-results-message">
          Enter at least two characters in the header search to find videos.
        </div>
      ) : loading ? (
        <div className="search-results-message">
          <LoaderCircle className="search-results-spinner" size={26} />
          <span>Searching your library...</span>
        </div>
      ) : error ? (
        <div className="search-results-message search-results-error">
          {error}
          <button
            type="button"
            className="search-results-retry"
            onClick={() => setRetryCount((count) => count + 1)}
          >
            Try again
          </button>
        </div>
      ) : videos.length === 0 ? (
        <div className="search-results-message">
          <Search size={28} />
          <strong>No matching videos found</strong>
          <span>Try a different title, actor, genre, tag, or studio.</span>
        </div>
      ) : (
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
                Page {page + 1} of {data.totalPages}
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
      )}
    </main>
  );
}

export default SearchResultsPage;
