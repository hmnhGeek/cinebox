import { useCallback, useEffect, useRef, useState } from "react";
import "./VideoPlayer.css";
import { Settings } from "lucide-react";

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
};

const Icon = ({ name, size = 22 }) => {
  const paths = {
    play: <path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none" />,
    pause: (
      <>
        <path d="M8 5h3v14H8z" fill="currentColor" stroke="none" />
        <path d="M15 5h3v14h-3z" fill="currentColor" stroke="none" />
      </>
    ),
    volume: (
      <>
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M15 9a5 5 0 0 1 0 6" />
        <path d="M18 6a9 9 0 0 1 0 12" />
      </>
    ),
    mute: (
      <>
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="m16 9 5 6m0-6-5 6" />
      </>
    ),
    fullscreen: (
      <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" />
    ),
    back: <path d="m15 18-6-6 6-6" />,
    forward: <path d="m9 18 6-6-6-6" />,
  };

  if (name === "settings") {
    return (
      <Settings
        size={size}
        strokeWidth={1.8}
        aria-hidden="true"
        className="cine-player__settings-icon"
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="cine-player__icon"
    >
      {paths[name]}
    </svg>
  );
};

export default function VideoPlayer({
  src,
  poster,
  title = "Now playing",
  autoPlay = false,
  initialMuted = false,
  onError,
  lastPlaybackTimeRef,
}) {
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const hideTimerRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(initialMuted);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [playbackError, setPlaybackError] = useState("");
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimerRef.current);

    if (videoRef.current && !videoRef.current.paused) {
      hideTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
        setSettingsOpen(false);
      }, 3000);
    }
  }, []);

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    setPlaybackError("");

    if (video.paused) {
      try {
        await video.play();
      } catch (error) {
        console.error("Video playback failed:", error);
        setPlaybackError(
          "Playback couldn't start. Check the video file and try again.",
        );
        setControlsVisible(true);
      }
    } else {
      video.pause();
    }

    showControls();
  }, [showControls]);

  const seekBy = useCallback((amount) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;

    video.currentTime = Math.max(
      0,
      Math.min(video.duration, video.currentTime + amount),
    );
  }, []);

  // Lock landscape only after entering fullscreen.
  // Some mobile browsers do not support this API.
  const lockLandscape = useCallback(async () => {
    try {
      if (screen.orientation && typeof screen.orientation.lock === "function") {
        await screen.orientation.lock("landscape");
      }
    } catch {
      // Fullscreen remains available if orientation locking is unsupported.
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const player = wrapperRef.current;
    if (!player) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (player.requestFullscreen) {
        await player.requestFullscreen();
        await lockLandscape();
      } else if (player.webkitRequestFullscreen) {
        // Safari/WebKit fallback where available.
        player.webkitRequestFullscreen();
        await lockLandscape();
      }
    } catch (error) {
      console.error("Fullscreen failed:", error);
    }
  }, [lockLandscape]);

  const handleVolumeChange = useCallback((value) => {
    const nextVolume = Number(value);
    setVolume(nextVolume);

    if (videoRef.current) {
      videoRef.current.volume = nextVolume;
      videoRef.current.muted = nextVolume === 0;
      setMuted(nextVolume === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setMuted(video.muted);

    if (!video.muted && video.volume === 0) {
      video.volume = 0.5;
      setVolume(0.5);
    }
  }, []);

  const handleKeyDown = useCallback(
    (event) => {
      const target = event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLButtonElement ||
        target instanceof HTMLSelectElement
      ) {
        if (event.key !== "Escape") return;
      }

      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          event.preventDefault();
          togglePlayback();
          break;

        case "arrowleft":
          event.preventDefault();
          seekBy(-10);
          showControls();
          break;

        case "arrowright":
          event.preventDefault();
          seekBy(10);
          showControls();
          break;

        case "arrowup":
          event.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.05));
          showControls();
          break;

        case "arrowdown":
          event.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.05));
          showControls();
          break;

        case "m":
          toggleMute();
          showControls();
          break;

        case "f":
          toggleFullscreen();
          break;

        case "escape":
          setSettingsOpen(false);
          break;

        default:
          break;
      }
    },
    [
      togglePlayback,
      seekBy,
      showControls,
      volume,
      handleVolumeChange,
      toggleMute,
      toggleFullscreen,
    ],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = initialMuted;
    video.volume = 1;

    setMuted(initialMuted);
    setVolume(1);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setPlaying(false);
    setPlaybackError("");
    setControlsVisible(true);
    setSettingsOpen(false);
    setSpeed(1);

    const onTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);

      if (lastPlaybackTimeRef) {
        lastPlaybackTimeRef.current = time;
      }
    };

    const onLoadedMetadata = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    };

    const onProgress = () => {
      if (!video.duration || !video.buffered.length) return;

      for (let i = 0; i < video.buffered.length; i++) {
        const start = video.buffered.start(i);
        const end = video.buffered.end(i);

        if (video.currentTime >= start && video.currentTime <= end) {
          setBuffered(end);
          return;
        }
      }

      setBuffered(video.buffered.end(video.buffered.length - 1));
    };

    const onPlay = () => {
      setPlaying(true);
      setPlaybackError("");
    };

    const onPause = () => {
      setPlaying(false);
      setControlsVisible(true);
      clearTimeout(hideTimerRef.current);
    };

    const onEnded = () => {
      setPlaying(false);
      setControlsVisible(true);
      setSettingsOpen(false);
    };

    const onFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement === wrapperRef.current;

      setFullscreen(isFullscreen);
      setControlsVisible(true);

      if (isFullscreen) {
        // Re-attempt orientation locking after fullscreen is established.
        lockLandscape();
      } else {
        // Restore the device's normal orientation behavior on exit.
        try {
          screen.orientation?.unlock?.();
        } catch {
          // Orientation unlocking may be unsupported.
        }
      }

      // Preserve playback position across fullscreen transitions.
      if (lastPlaybackTimeRef && lastPlaybackTimeRef.current > 0) {
        const savedTime = lastPlaybackTimeRef.current;

        video.currentTime = Math.min(
          savedTime,
          Number.isFinite(video.duration)
            ? Math.max(0, video.duration - 0.1)
            : savedTime,
        );
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("durationchange", onLoadedMetadata);
    video.addEventListener("progress", onProgress);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    if (autoPlay) {
      video.play().catch((error) => {
        console.warn("Autoplay was blocked:", error);
      });
    }

    return () => {
      clearTimeout(hideTimerRef.current);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("durationchange", onLoadedMetadata);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [src, initialMuted, autoPlay, lastPlaybackTimeRef, lockLandscape]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    wrapper.addEventListener("keydown", handleKeyDown);

    return () => {
      wrapper.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    return () => clearTimeout(hideTimerRef.current);
  }, []);

  useEffect(() => {
    setIsTouchDevice(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`cine-player ${
        controlsVisible
          ? "cine-player--controls-visible"
          : "cine-player--controls-hidden"
      } ${fullscreen ? "cine-player--fullscreen" : ""}`}
      tabIndex={0}
      aria-label={`Video player: ${title}`}
      onMouseMove={showControls}
      onMouseLeave={() => {
        if (playing && !settingsOpen) {
          clearTimeout(hideTimerRef.current);

          hideTimerRef.current = setTimeout(() => {
            setControlsVisible(false);
          }, 800);
        }
      }}
      onClick={(event) => {
        if (isTouchDevice) return;
        if (
          event.target === wrapperRef.current ||
          event.target === videoRef.current
        ) {
          togglePlayback();
        }
      }}
    >
      <video
        ref={videoRef}
        className="cine-player__video"
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        controls={false}
        onError={() => {
          setPlaybackError(
            "The video couldn't be loaded. Check the file and try again.",
          );
          onError?.();
        }}
      />

      <div className="cine-player__top-gradient" />

      <div className="cine-player__top">
        <div className="cine-player__movie">
          <span className="cine-player__brand">CINEBOX</span>
          <span className="cine-player__movie-title">{title}</span>
        </div>
      </div>

      {!playing && (
        <button
          type="button"
          className="cine-player__center-play"
          onClick={togglePlayback}
          aria-label="Play video"
        >
          <Icon name="play" size={34} />
        </button>
      )}

      {playbackError && (
        <div className="cine-player__error" role="alert">
          <strong>Unable to play video</strong>
          <span>{playbackError}</span>
        </div>
      )}

      <div className="cine-player__bottom">
        <div className="cine-player__timeline">
          <span className="cine-player__time">{formatTime(currentTime)}</span>

          <div className="cine-player__seek-wrap">
            <div className="cine-player__seek-track">
              <div
                className="cine-player__buffered"
                style={{ width: `${bufferedProgress}%` }}
              />
              <div
                className="cine-player__played"
                style={{ width: `${progress}%` }}
              />
            </div>

            <input
              className="cine-player__seek"
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={duration ? Math.min(currentTime, duration) : 0}
              onChange={(event) => {
                const nextTime = Number(event.target.value);
                const video = videoRef.current;

                if (video && Number.isFinite(nextTime)) {
                  video.currentTime = nextTime;
                  setCurrentTime(nextTime);

                  if (lastPlaybackTimeRef) {
                    lastPlaybackTimeRef.current = nextTime;
                  }
                }
              }}
              aria-label="Seek"
            />
          </div>

          <span className="cine-player__time">{formatTime(duration)}</span>
        </div>

        <div className="cine-player__toolbar">
          <div className="cine-player__toolbar-left">
            <button
              type="button"
              className="cine-player__icon-button cine-player__main-play"
              onClick={togglePlayback}
              aria-label={playing ? "Pause" : "Play"}
              title={playing ? "Pause (Space)" : "Play (Space)"}
            >
              <Icon name={playing ? "pause" : "play"} />
            </button>

            <button
              type="button"
              className="cine-player__icon-button cine-player__skip-button"
              onClick={() => seekBy(-10)}
              aria-label="Back 10 seconds"
              title="Back 10 seconds (←)"
            >
              <Icon name="back" />
            </button>

            <button
              type="button"
              className="cine-player__icon-button cine-player__skip-button"
              onClick={() => seekBy(10)}
              aria-label="Forward 10 seconds"
              title="Forward 10 seconds (→)"
            >
              <Icon name="forward" />
            </button>

            <button
              type="button"
              className="cine-player__icon-button"
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              title="Mute (M)"
            >
              <Icon name={muted ? "mute" : "volume"} />
            </button>

            <input
              className="cine-player__volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              onChange={(event) => handleVolumeChange(event.target.value)}
              style={{
                "--volume-progress": `${(muted ? 0 : volume) * 100}%`,
              }}
              aria-label="Volume"
            />
          </div>

          <div className="cine-player__toolbar-right">
            <div className="cine-player__settings-wrap">
              <button
                type="button"
                className={`cine-player__icon-button ${
                  settingsOpen ? "is-active" : ""
                }`}
                onClick={() => {
                  setSettingsOpen((value) => !value);
                  showControls();
                }}
                aria-label="Playback settings"
                aria-expanded={settingsOpen}
                title="Playback settings"
              >
                <Icon name="settings" />
              </button>

              {settingsOpen && (
                <div
                  className="cine-player__settings"
                  onClick={(event) => event.stopPropagation()}
                >
                  <span className="cine-player__settings-heading">
                    Playback speed
                  </span>

                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={speed === value ? "is-selected" : ""}
                      onClick={() => {
                        setSpeed(value);

                        if (videoRef.current) {
                          videoRef.current.playbackRate = value;
                        }

                        setSettingsOpen(false);
                        showControls();
                      }}
                    >
                      {value === 1 ? "Normal" : `${value}×`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="cine-player__icon-button"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
            >
              <Icon name="fullscreen" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
