import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import VideoCard from "../../components/videoCard/VideoCard";
import libhero from "../../assets/libhero.jpg";
import "./DiscoveryPage.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

const PAGE_SIZE = 24;

const DISCOVERY_TYPES = {
  tags: {
    title: "Tag",
    description: "Movies connected to this tag.",
    metadataKey: "tags",
  },
  genres: {
    title: "Genre",
    description: "Explore movies in this genre.",
    metadataKey: "genres",
  },
  actors: {
    title: "Actor",
    description: "Explore movies featuring this actor.",
    metadataKey: "actors",
  },
  studios: {
    title: "Studio",
    description: "Explore movies from this studio.",
    metadataKey: "studios",
  },
};

function DiscoveryPage() {
  const { type, id } = useParams();
  const navigate = useNavigate();

  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const discoveryType = DISCOVERY_TYPES[type];

  const discoveryName = useMemo(() => {
    if (!discoveryType || !id) return null;

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
  }, [videos, discoveryType, id]);

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
  }, [fetchVideos]);

  const handleVideoClick = (video) => {
    console.log("video is", video);
    const collectionId =
      video.collectionId ||
      video.collection?.id ||
      video.collection?.collectionId;

    if (!collectionId || !video.id) {
      setError(
        "This movie is missing its collection information. " +
          "Include collectionId in the discovery API response to enable playback.",
      );
      return;
    }

    navigate(`/videos/${collectionId}/${video.id}`);
  };

  const getThumbnailUrl = (video) => {
    if (!video.thumbnailUrl) return libhero;

    if (/^https?:\/\//i.test(video.thumbnailUrl)) {
      return video.thumbnailUrl;
    }

    return `${API_BASE_URL}${
      video.thumbnailUrl.startsWith("/") ? "" : "/"
    }${video.thumbnailUrl}`;
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

  if (!discoveryType) {
    return (
      <main className="discovery-page">
        <div className="discovery-state">
          <h2>Discovery unavailable</h2>
          <p>This discovery category does not exist.</p>
          <button
            className="discovery-back-button"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft size={18} />
            Go back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="discovery-page">
      <section className="discovery-header">
        <button
          className="discovery-back-button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ChevronLeft size={18} />
          Back
        </button>

        <div className="discovery-heading">
          <span className="discovery-eyebrow">CINEBOX DISCOVERY</span>
          <h1>{discoveryName || `${discoveryType.title} Collection`}</h1>
          <p>{discoveryType.description}</p>
        </div>

        {!loading && !error && (
          <div className="discovery-result-count">
            <span className="discovery-result-number">
              {totalElements.toLocaleString()}
            </span>
            <span>{totalElements === 1 ? "movie found" : "movies found"}</span>
          </div>
        )}
      </section>

      {error && (
        <div className="discovery-error" role="alert">
          <p>{error}</p>
          <button
            onClick={() => {
              setPage(0);
              setError("");
              setLoading(true);
              window.location.reload();
            }}
          >
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="discovery-state">
          <LoaderCircle className="discovery-spinner" size={32} />
          <p>Finding movies...</p>
        </div>
      ) : !error && videos.length === 0 ? (
        <div className="discovery-state">
          <h2>No movies found</h2>
          <p>
            There are no movies associated with this{" "}
            {discoveryType.title.toLowerCase()} yet.
          </p>
        </div>
      ) : !error ? (
        <>
          <section className="video-grid discovery-video-grid">
            {videos.map((video, index) => (
              <VideoCard
                key={video.id || `${video.title}-${index}`}
                video={video}
                thumbnailUrl={getThumbnailUrl(video)}
                fallbackThumbnailUrl={libhero}
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
                <ChevronLeft size={18} />
                Previous
              </button>

              <span className="discovery-page-indicator">
                Page <strong>{page + 1}</strong> of {totalPages}
              </span>

              <button
                className="discovery-page-button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages - 1}
                aria-label="Next page"
              >
                Next
                <ChevronRight size={18} />
              </button>
            </nav>
          )}
        </>
      ) : null}
    </main>
  );
}

export default DiscoveryPage;
