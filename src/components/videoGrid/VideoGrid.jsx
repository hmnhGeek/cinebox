import VideoCard from "../videoCard/VideoCard";
import { useNavigate } from "react-router-dom";
import libhero from "../../assets/libhero.jpg";

function VideoGrid({ videos, collectionId }) {
  const navigate = useNavigate();

  if (!videos || videos.length === 0) {
    return <div className="empty-state">No videos found.</div>;
  }

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");

  const handleVideoClick = (video) => {
    if (!video.id) {
      console.error("Cannot open movie: media item ID is missing.", video);
      return;
    }

    navigate(
      `/videos/${encodeURIComponent(collectionId)}/${encodeURIComponent(video.id)}`,
    );
  };

  return (
    <div className="video-grid">
      {videos.map((video) => {
        const thumbnailUrl = video.thumbnailUrl
          ? `${apiBaseUrl}${video.thumbnailUrl}`
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
            previewUrl={previewUrl}
            handleClick={handleVideoClick}
          />
        );
      })}
    </div>
  );
}

export default VideoGrid;
