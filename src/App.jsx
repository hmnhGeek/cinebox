import { BrowserRouter, Routes, Route } from "react-router-dom";
import VideoPage from "./pages/VideoPage/VideoPage";
import { useState } from "react";
import { createCollection } from "./service/collectionApi";
import CollectionsPage from "./pages/CollectionsPage/CollectionsPage";
import CollectionVideosPage from "./pages/CollectionsVideoPage/CollectionsVideoPage";
import Header from "./components/Header/Header";
import { SyncProvider } from "./context/SyncContext";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <SyncProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#1f2937",
            color: "#fff",
            borderRadius: "12px",
            padding: "14px 18px",
          },
        }}
      />

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
    </SyncProvider>
  );
}

export default App;
