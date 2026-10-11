import { useState } from "react";

function VideoCard({ video, thumbnailUrl, previewUrl, handleClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setPreviewReady(false);
  };

  return (
    <div
      className="video-card"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => handleClick(video)}
    >
      <div className="video-thumbnail-container">
        {/* Normal thumbnail */}
        <img
          className={`video-thumbnail ${previewReady ? "hidden" : ""}`}
          src={thumbnailUrl}
          alt={video.title}
        />

        {/* Preview */}
        {isHovered && (
          <video
            className={`video-preview ${previewReady ? "visible" : ""}`}
            src={previewUrl}
            muted
            playsInline
            autoPlay
            loop
            preload="metadata"
            onCanPlay={() => setPreviewReady(true)}
          />
        )}
      </div>

      <div className="video-info">
        <h3>{video.title}</h3>

        {video.plot && <p>{video.plot}</p>}
      </div>
    </div>
  );
}

export default VideoCard;
