import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../../context/SettingsContext";
import {
  getMediaBarItems,
  resolveMediaBarAssetUrl,
} from "../../service/mediaBarApi";
import "./MediaBar.css";

const SLIDE_INTERVAL = 7000;

// In-memory cache shared across MediaBar mounts.
let mediaBarCache = null;

function getUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatTechnicalDuration(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return null;

  const totalSeconds = Math.round(Number(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;

  return `${remainingSeconds}s`;
}

function MediaBar({ onVisibilityChange }) {
  const navigate = useNavigate();
  const { settings, loading: settingsLoading } = useSettings();

  const showMediaBar = settings?.home?.showMediaBar ?? true;

  const [utcDate, setUtcDate] = useState(getUtcDate);

  const [items, setItems] = useState(() => {
    if (mediaBarCache?.date === getUtcDate()) {
      return mediaBarCache.items;
    }

    return [];
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const isMediaBarVisible =
    !settingsLoading && showMediaBar && items.length > 0;

  // Notify CollectionsPage whenever Media Bar visibility changes.
  useEffect(() => {
    onVisibilityChange?.(isMediaBarVisible);
  }, [isMediaBarVisible, onVisibilityChange]);

  // Reset the parent layout state when MediaBar unmounts.
  useEffect(() => {
    return () => {
      onVisibilityChange?.(false);
    };
  }, [onVisibilityChange]);

  // Detect the next UTC date change, including while the page remains open.
  useEffect(() => {
    const now = new Date();

    const nextUtcMidnight = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
    );

    const timeout = window.setTimeout(
      () => {
        setUtcDate(getUtcDate());
      },
      nextUtcMidnight - now.getTime() + 50,
    );

    return () => window.clearTimeout(timeout);
  }, [utcDate]);

  // Load featured movies only when the current UTC day's cache is missing.
  useEffect(() => {
    if (settingsLoading || !showMediaBar) return;

    if (mediaBarCache?.date === utcDate) {
      setItems(mediaBarCache.items);
      return;
    }

    const controller = new AbortController();

    async function loadMediaBar() {
      try {
        const response = await getMediaBarItems({
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const featuredItems = Array.isArray(response)
          ? response.slice(0, 5)
          : [];

        mediaBarCache = {
          date: utcDate,
          items: featuredItems,
        };

        setItems(featuredItems);
        setActiveIndex(0);
      } catch (error) {
        if (error?.name === "AbortError") return;

        console.error("Failed to load Media Bar:", error);

        // Keep existing items visible if a refresh fails.
      }
    }

    loadMediaBar();

    return () => controller.abort();
  }, [settingsLoading, showMediaBar, utcDate]);

  const goToNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (paused || items.length <= 1 || !showMediaBar) return;

    const interval = window.setInterval(goToNext, SLIDE_INTERVAL);

    return () => window.clearInterval(interval);
  }, [goToNext, items.length, paused, showMediaBar]);

  const handleMovieClick = useCallback(
    (item) => {
      if (!item?.collectionId || !item?.id) return;

      navigate(
        `/videos/${encodeURIComponent(item.collectionId)}/${encodeURIComponent(item.id)}`,
      );
    },
    [navigate],
  );

  const handleBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setPaused(false);
    }
  };

  if (settingsLoading || !showMediaBar || items.length === 0) {
    return null;
  }

  const activeItem = items[activeIndex];
  const runtime = formatTechnicalDuration(activeItem?.durationSeconds);

  return (
    <section
      className="media-bar"
      aria-label="Featured movies"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={handleBlur}
    >
      <div
        className="media-bar-backdrop"
        key={activeItem.id}
        style={{
          backgroundImage: `url("${resolveMediaBarAssetUrl(activeItem.backdropUrl)}")`,
        }}
        role="img"
        aria-label={`${activeItem.title || "Featured movie"} backdrop`}
      />

      <div className="media-bar-overlay" />

      <div className="media-bar-content">
        <div className="media-bar-eyebrow">
          <span className="media-bar-eyebrow-line" />
          <span>FEATURED IN YOUR LIBRARY</span>
        </div>

        <div className="media-bar-movie-info" key={`info-${activeItem.id}`}>
          <h1 className="media-bar-title">{activeItem.title || "Untitled"}</h1>

          {(activeItem.year || runtime) && (
            <div className="media-bar-metadata">
              {activeItem.year && <span>{activeItem.year}</span>}
              {runtime && <span className="duration-badge">{runtime}</span>}
            </div>
          )}

          {activeItem.plot && (
            <p className="media-bar-plot">{activeItem.plot}</p>
          )}

          <button
            type="button"
            className="media-bar-cta"
            onClick={() => handleMovieClick(activeItem)}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="media-bar-play-icon"
            >
              <path d="M8 5.5v13l10-6.5-10-6.5Z" />
            </svg>

            <span>Watch now</span>
          </button>
        </div>
      </div>

      {items.length > 1 && (
        <div
          className="media-bar-indicators"
          aria-label="Choose featured movie"
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`media-bar-indicator${
                index === activeIndex ? " is-active" : ""
              }`}
              aria-label={`Show featured movie ${index + 1}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default MediaBar;
