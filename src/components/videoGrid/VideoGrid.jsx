import VideoCard from "../videoCard/VideoCard";
import { useNavigate } from "react-router-dom";
import libhero from "../../assets/libhero.jpg";

function VideoGrid({ videos, collectionId }) {
  const navigate = useNavigate();

  if (!videos || videos.length === 0) {
    return <div className="empty-state">No videos found.</div>;
  }

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");

  const getVideoFolder = (path) => {
    if (!path) return null;

    return path.split("\\").slice(-2, -1)[0] || null;
  };

  const handleVideoClick = (video) => {
    const videoFolder = getVideoFolder(video.videoPath);

    if (!videoFolder) return;

    navigate(`/videos/${collectionId}/${encodeURIComponent(videoFolder)}`);
  };

  return (
    <div className="video-grid">
      {videos.map((video) => {
        const thumbnailFolder = getVideoFolder(video.thumbnailPath);
        const videoFolder = getVideoFolder(video.videoPath);

        const thumbnailUrl = thumbnailFolder
          ? `${apiBaseUrl}/api/v1/collections/thumbnail` +
            `?collectionId=${encodeURIComponent(collectionId)}` +
            `&videoFolder=${encodeURIComponent(thumbnailFolder)}`
          : libhero;

        const previewUrl = videoFolder
          ? `${apiBaseUrl}/api/v1/collections/preview` +
            `?collectionId=${encodeURIComponent(collectionId)}` +
            `&videoFolder=${encodeURIComponent(videoFolder)}`
          : null;

        return (
          <VideoCard
            key={video.id}
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
