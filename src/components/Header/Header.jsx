import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  LoaderCircle,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { getSearchSuggestions } from "../../service/searchApis";
import "./Header.css";
import logo from "../../assets/logo.png";
import libhero from "../../assets/libhero.jpg";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

const MATCH_LABELS = {
  TITLE: "Title",
  ORIGINAL_TITLE: "Original title",
  SORT_TITLE: "Title",
  TAG: "Tag",
  GENRE: "Genre",
  ACTOR: "Cast",
  DIRECTOR: "Director",
  STUDIO: "Studio",
};

function getImageUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;

  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function getThumbnailUrl(url) {
  return getImageUrl(url) || libhero;
}

function getMatchLabel(matchedBy) {
  if (!Array.isArray(matchedBy) || matchedBy.length === 0) {
    return "Video";
  }

  return [...new Set(matchedBy.map((item) => MATCH_LABELS[item] || item))]
    .slice(0, 2)
    .join(" · ");
}

function ActorSuggestionAvatar({ actor }) {
  const imageUrl = getImageUrl(actor.profileImageUrl);

  return (
    <div className="search-actor-avatar">
      <UsersRound
        className="search-actor-avatar-fallback"
        size={25}
        aria-hidden="true"
      />

      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
            event.currentTarget.parentElement?.classList.add("has-image-error");
          }}
        />
      )}
    </div>
  );
}

function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const requestIdRef = useRef(0);

  const [query, setQuery] = useState("");
  const [actors, setActors] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= 2;

  const isActorsPage =
    location.pathname === "/actors" || location.pathname.startsWith("/actors/");

  // Keep one keyboard-navigation sequence across both result types.
  const combinedSuggestions = [
    ...actors.map((actor) => ({ ...actor, resultType: "actor" })),
    ...suggestions.map((video) => ({ ...video, resultType: "video" })),
  ];

  const closeSuggestions = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  const openVideo = useCallback(
    (video) => {
      if (!video?.collectionId || !video?.mediaItemId) return;

      const searchTerm = trimmedQuery;

      closeSuggestions();
      setQuery("");

      navigate(
        `/videos/${encodeURIComponent(video.collectionId)}/${encodeURIComponent(video.mediaItemId)}`,
        {
          state: {
            fromSearch: true,
            returnTo: `/search?q=${encodeURIComponent(searchTerm)}`,
          },
        },
      );
    },
    [closeSuggestions, navigate, trimmedQuery],
  );

  const openActor = useCallback(
    (actor) => {
      if (!actor?.id) return;

      closeSuggestions();
      setQuery("");
      inputRef.current?.blur();

      navigate(`/discover/actors/${encodeURIComponent(actor.id)}`);
    },
    [closeSuggestions, navigate],
  );

  const viewAllResults = useCallback(
    (searchTerm = trimmedQuery) => {
      if (searchTerm.length < 2) return;

      closeSuggestions();
      inputRef.current?.blur();

      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
    },
    [closeSuggestions, navigate, trimmedQuery],
  );

  useEffect(() => {
    if (!canSearch) {
      requestIdRef.current += 1;
      setActors([]);
      setSuggestions([]);
      setHasMore(false);
      setIsLoading(false);
      setError("");
      setActiveIndex(-1);
      setIsOpen(false);
      return undefined;
    }

    const requestId = ++requestIdRef.current;

    setIsOpen(true);
    setIsLoading(true);
    setError("");

    const timeoutId = setTimeout(async () => {
      try {
        const data = await getSearchSuggestions(trimmedQuery, 8);

        if (requestId !== requestIdRef.current) return;

        setActors(Array.isArray(data.actors) ? data.actors : []);
        setSuggestions(Array.isArray(data.results) ? data.results : []);
        setHasMore(Boolean(data.hasMore));
        setActiveIndex(-1);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;

        console.error("Failed to load search suggestions:", err);
        setActors([]);
        setSuggestions([]);
        setHasMore(false);
        setError("Search is temporarily unavailable.");
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [canSearch, trimmedQuery]);

  useEffect(() => {
    closeSuggestions();
  }, [location.pathname, location.search, closeSuggestions]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!searchRef.current?.contains(event.target)) {
        closeSuggestions();
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        closeSuggestions();
        inputRef.current?.blur();
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeSuggestions]);

  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);

      if (combinedSuggestions.length > 0) {
        setActiveIndex((current) =>
          current >= combinedSuggestions.length - 1 ? 0 : current + 1,
        );
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (combinedSuggestions.length > 0) {
        setActiveIndex((current) =>
          current <= 0 ? combinedSuggestions.length - 1 : current - 1,
        );
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      const selected = combinedSuggestions[activeIndex];

      if (selected?.resultType === "actor") {
        openActor(selected);
      } else if (selected?.resultType === "video") {
        openVideo(selected);
      } else if (canSearch) {
        viewAllResults();
      }
    }
  }

  function clearSearch() {
    requestIdRef.current += 1;
    setQuery("");
    setActors([]);
    setSuggestions([]);
    setHasMore(false);
    setError("");
    setIsLoading(false);
    setActiveIndex(-1);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  const hasSuggestions = combinedSuggestions.length > 0;

  return (
    <header className="app-header">
      <div className="header-brand">
        <button
          className="header-logo-button"
          onClick={() => navigate("/")}
          aria-label="Go to homepage"
          title="Home"
        >
          <img className="app-logo" src={logo} alt="" />
        </button>
      </div>

      <button
        type="button"
        className={`header-navigation-link ${isActorsPage ? "is-active" : ""}`}
        onClick={() => navigate("/actors")}
        aria-label="Browse actors"
        aria-current={isActorsPage ? "page" : undefined}
        title="Browse actors"
      >
        <UsersRound size={17} aria-hidden="true" />
        <span>Actors</span>
      </button>

      <div className="header-search" ref={searchRef}>
        <form
          className={`header-search-form ${isOpen ? "is-active" : ""}`}
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            viewAllResults();
          }}
        >
          <Search className="header-search-icon" size={19} aria-hidden="true" />

          <input
            ref={inputRef}
            className="header-search-input"
            type="search"
            value={query}
            placeholder="Search your library..."
            autoComplete="off"
            aria-label="Search videos and actors"
            aria-autocomplete="list"
            aria-expanded={isOpen && canSearch}
            onFocus={() => {
              if (canSearch) setIsOpen(true);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(event.target.value.trim().length >= 2);
            }}
            onKeyDown={handleKeyDown}
          />

          {isLoading && canSearch ? (
            <LoaderCircle
              className="header-search-spinner"
              size={18}
              aria-label="Searching"
            />
          ) : query ? (
            <button
              type="button"
              className="header-search-clear"
              onClick={clearSearch}
              aria-label="Clear search"
              title="Clear search"
            >
              <X size={17} />
            </button>
          ) : (
            <kbd className="header-search-shortcut">Enter</kbd>
          )}
        </form>

        {isOpen && canSearch && (
          <div
            className="search-dropdown"
            role="listbox"
            aria-label="Actor and video search suggestions"
          >
            <div className="search-dropdown-heading">
              <span>SEARCH RESULTS</span>

              {!isLoading && hasSuggestions && (
                <span className="search-result-count">
                  {combinedSuggestions.length}
                  {hasMore ? "+" : ""}
                </span>
              )}
            </div>

            {isLoading && !hasSuggestions ? (
              <div className="search-dropdown-state">
                <LoaderCircle size={21} className="search-state-spinner" />
                <span>Searching your library</span>
              </div>
            ) : error ? (
              <div className="search-dropdown-state search-dropdown-error">
                {error}
              </div>
            ) : !hasSuggestions ? (
              <div className="search-dropdown-state">
                <Search size={22} />
                <span>No matches found for “{trimmedQuery}”</span>
                <small>
                  Try another title, actor, director, genre, tag, or studio.
                </small>
              </div>
            ) : (
              <div className="search-suggestion-list">
                {actors.length > 0 && (
                  <div className="search-section-heading">
                    <UsersRound size={13} aria-hidden="true" />
                    <span>ACTORS</span>
                    <span className="search-section-count">
                      {actors.length}
                    </span>
                  </div>
                )}

                {actors.map((actor, index) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={activeIndex === index}
                    className={`search-suggestion search-actor-suggestion ${
                      activeIndex === index ? "is-highlighted" : ""
                    }`}
                    key={`actor-${actor.id}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => openActor(actor)}
                  >
                    <ActorSuggestionAvatar actor={actor} />

                    <div className="search-suggestion-info">
                      <div className="search-suggestion-title">
                        {actor.name || "Unknown actor"}
                      </div>

                      <div className="search-suggestion-meta">
                        <span>Actor profile</span>
                      </div>
                    </div>

                    <ArrowUpRight
                      className="search-suggestion-arrow"
                      size={17}
                      aria-hidden="true"
                    />
                  </button>
                ))}

                {suggestions.length > 0 && (
                  <div className="search-section-heading">
                    <Search size={13} aria-hidden="true" />
                    <span>VIDEOS</span>
                    <span className="search-section-count">
                      {suggestions.length}
                      {hasMore ? "+" : ""}
                    </span>
                  </div>
                )}

                {suggestions.map((video, index) => {
                  const activeVideoIndex = actors.length + index;

                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={activeIndex === activeVideoIndex}
                      className={`search-suggestion ${
                        activeIndex === activeVideoIndex ? "is-highlighted" : ""
                      }`}
                      key={`video-${video.mediaItemId}`}
                      onMouseEnter={() => setActiveIndex(activeVideoIndex)}
                      onClick={() => openVideo(video)}
                    >
                      <div className="search-suggestion-thumbnail">
                        <img
                          src={getThumbnailUrl(video.thumbnailUrl)}
                          alt=""
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = libhero;
                          }}
                        />
                      </div>

                      <div className="search-suggestion-info">
                        <div className="search-suggestion-title">
                          {video.title || "Untitled video"}
                        </div>

                        <div className="search-suggestion-meta">
                          {video.year || "Year unavailable"}
                          <span className="search-meta-separator">·</span>
                          <span>{getMatchLabel(video.matchedBy)}</span>
                        </div>

                        {video.description && (
                          <p className="search-suggestion-description">
                            {video.description}
                          </p>
                        )}
                      </div>

                      <ArrowUpRight
                        className="search-suggestion-arrow"
                        size={17}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {!isLoading && !error && hasSuggestions && (
              <button
                type="button"
                className="search-view-all"
                onClick={() => viewAllResults()}
              >
                <span>
                  View all results for <strong>“{trimmedQuery}”</strong>
                </span>
                <ArrowUpRight size={17} />
              </button>
            )}

            {!isLoading && !error && !hasSuggestions && (
              <button
                type="button"
                className="search-view-all"
                onClick={() => viewAllResults()}
              >
                Search all results
                <ArrowUpRight size={17} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="header-actions" aria-hidden="true" />
    </header>
  );
}

export default Header;
