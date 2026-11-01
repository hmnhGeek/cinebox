import { BrowserRouter, Routes, Route } from "react-router-dom";
import VideoPage from "./pages/VideoPage/VideoPage";
import CollectionsPage from "./pages/CollectionsPage/CollectionsPage";
import CollectionVideosPage from "./pages/CollectionsVideoPage/CollectionsVideoPage";
import DiscoveryPage from "./pages/DiscoveryPage/DiscoveryPage";
import SearchResultsPage from "./pages/SearchResultsPage/SearchResultsPage";
import SettingsPage from "./pages/SettingsPage/SettingsPage";
import Header from "./components/Header/Header";
import { SyncProvider } from "./context/SyncContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ActorsFilterProvider } from "./context/ActorsFilterContext";
import { Toaster } from "react-hot-toast";
import ScrollToTop from "./components/ScrollToTop/ScrollToTop";
import ActorsPage from "./pages/ActorsPage/ActorsPage";

function App() {
  return (
    <SyncProvider>
      <SettingsProvider>
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
          <ActorsFilterProvider>
            <ScrollToTop />
            <Header />

            <Routes>
              <Route path="/" element={<CollectionsPage />} />

              <Route
                path="/videos/:collectionId/:mediaItemId"
                element={<VideoPage />}
              />

              <Route
                path="/collections/:id"
                element={<CollectionVideosPage />}
              />

              <Route path="/discover/:type/:id" element={<DiscoveryPage />} />

              <Route path="/search" element={<SearchResultsPage />} />

              <Route path="/actors" element={<ActorsPage />} />

              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </ActorsFilterProvider>
        </BrowserRouter>
      </SettingsProvider>
    </SyncProvider>
  );
}

export default App;
