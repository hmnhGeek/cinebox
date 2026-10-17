import VideoCard from "../videoCard/VideoCard";
import { useNavigate } from "react-router-dom";

function VideoGrid({ videos, collectionId }) {
  const navigate = useNavigate();

  if (!videos || videos.length === 0) {
    return <div className="empty-state">No videos found.</div>;
  }

  const handleVideoClick = (video) => {
    navigate(
      `/videos/${collectionId}/${encodeURIComponent(video.videoPath.split("\\").slice(-2, -1)[0])}`,
    );
  };

  return (
    <div className="video-grid">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          thumbnailUrl={
            `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")}/api/v1/collections/thumbnail` +
            `?collectionId=${collectionId}&videoFolder=${encodeURIComponent(video.thumbnailPath.split("\\").slice(-2, -1)[0])}`
          }
          previewUrl={
            `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")}/api/v1/collections/preview` +
            `?collectionId=${collectionId}&videoFolder=${encodeURIComponent(video.videoPath.split("\\").slice(-2, -1)[0])}`
          }
          handleClick={handleVideoClick}
        />
      ))}
    </div>
  );
}

export default VideoGrid;
