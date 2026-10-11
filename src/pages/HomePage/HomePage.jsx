import { useEffect, useState } from "react";
import VideoGrid from "../../components/videoGrid/VideoGrid";
import { getAllVideos, uploadVideo } from "../../service/videoApi";
// import "../../App.css";

const HomePage = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadVideos() {
      try {
        const data = await getAllVideos();
        setVideos(data);
      } catch (error) {
        console.error(error);
        setError("Failed to load videos.");
      } finally {
        setLoading(false);
      }
    }

    loadVideos();
  }, []);

  return (
    <div className="app">
      <main className="content">
        {loading && <div className="loading">Loading videos...</div>}

        {error && <div className="error">{error}</div>}

        {!loading && !error && <VideoGrid videos={videos} />}
      </main>
    </div>
  );
};

export default HomePage;
