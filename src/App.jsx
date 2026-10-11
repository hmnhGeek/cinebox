import { BrowserRouter, Routes, Route } from "react-router-dom";
import VideoPage from "./pages/VideoPage/VideoPage";
import HomePage from "./pages/HomePage/HomePage";
import UploadModal from "./components/uploads/UploadModal/UploadModal";
import { useState } from "react";
import { uploadVideo } from "./service/videoApi";
import { createCollection } from "./service/collectionApi";
import CollectionsPage from "./pages/CollectionsPage/CollectionsPage";
import CollectionVideosPage from "./pages/CollectionsVideoPage/CollectionsVideoPage";
import Header from "./components/Header/Header";

function App() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const handleCloseUploadModal = () => {
    setIsUploadModalOpen(false);
  };

  const handleUpload = async (videoData) => {
    console.log("Uploading video:", videoData);
    const { file, thumbnail, poster, title, description } = videoData;
    const video = await uploadVideo({
      file,
      poster,
      thumbnail,
      title,
      description,
    });
    setIsUploadModalOpen(false);
  };
  return (
    <>
      <BrowserRouter>
        <Header
          onUploadClick={() => setIsUploadModalOpen(true)}
          onCreateCollectionClick={() => setCollectionModalOpen(true)}
        />
        <UploadModal
          isOpen={isUploadModalOpen}
          onClose={handleCloseUploadModal}
          onUpload={handleUpload}
        />
        <Routes>
          <Route path="/" element={<CollectionsPage />} />
          <Route
            path="/videos/:collectionId/:videoFolderPath"
            element={<VideoPage />}
          />
          <Route path="/collections/:id" element={<CollectionVideosPage />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
