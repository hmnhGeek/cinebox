import { BrowserRouter, Routes, Route } from "react-router-dom";
import VideoPage from "./pages/VideoPage/VideoPage";
import { useState } from "react";
import { createCollection } from "./service/collectionApi";
import CollectionsPage from "./pages/CollectionsPage/CollectionsPage";
import CollectionVideosPage from "./pages/CollectionsVideoPage/CollectionsVideoPage";
import Header from "./components/Header/Header";

function App() {
  return (
    <>
      <BrowserRouter>
        <Header
          onUploadClick={() => setIsUploadModalOpen(true)}
          onCreateCollectionClick={() => setCollectionModalOpen(true)}
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
