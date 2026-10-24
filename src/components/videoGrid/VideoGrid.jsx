import VideoCard from "../videoCard/VideoCard";
import { useNavigate } from "react-router-dom";
import libhero from "../../assets/libhero.jpg";

function VideoGrid({ videos, collectionId, returnTo }) {
  const navigate = useNavigate();

  if (!videos || videos.length === 0) {
    return <div className="empty-state">No videos found.</div>;
  }

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(
    /\/$/,
    "",
  );

  const handleVideoClick = (video) => {
    const targetCollectionId = collectionId || video.collectionId;

    if (!targetCollectionId || !video.id) {
      console.error(
        "Cannot open movie: collection ID or media item ID is missing.",
        video,
      );
      return;
    }

    navigate(
      `/videos/${encodeURIComponent(targetCollectionId)}/${encodeURIComponent(video.id)}`,
      {
        state: returnTo
          ? {
              fromSearch: true,
              returnTo,
            }
          : undefined,
      },
    );
  };

  return (
    <div className="video-grid">
      {videos.map((video) => {
        const thumbnailUrl = video.thumbnailUrl
          ? `${apiBaseUrl}${video.thumbnailUrl.startsWith("/") ? "" : "/"}${video.thumbnailUrl}`
          : libhero;

        const previewUrl = video.id
          ? `${apiBaseUrl}/api/v1/collections/preview` +
            `?mediaItemId=${encodeURIComponent(video.id)}`
          : null;

        return (
          <VideoCard
            key={video.id ?? video.videoPath}
            video={video}
            thumbnailUrl={thumbnailUrl}
            fallbackThumbnailUrl={libhero}
            previewUrl={previewUrl}
            handleClick={handleVideoClick}
          />
        );
      })}
    </div>
  );
}

export default VideoGrid;
