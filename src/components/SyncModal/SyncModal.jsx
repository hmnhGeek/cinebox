import React from "react";
import {
  Clapperboard,
  X,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";

import "./SyncModal.css";

const SyncModal = ({
  isOpen,
  onClose,
  syncProgress = {},
  syncStatus = "IDLE",
  hasReceivedProgress = false,
  error,
  collectionId,
}) => {
  if (!isOpen) return null;

  const collectionProgress = Object.entries(syncProgress).filter(([path]) =>
    path.includes(String(collectionId)),
  );

  const isQueued = syncStatus === "QUEUED";
  const isRunning = syncStatus === "IN_PROGRESS";
  const isComplete = syncStatus === "COMPLETED";
  const isFailed = syncStatus === "FAILED";
  const isBusy = isQueued || isRunning;

  const title =
    {
      QUEUED: "Sync Queued",
      IN_PROGRESS: "Synchronizing Collection",
      COMPLETED: "Sync Complete",
      FAILED: "Sync Failed",
      IDLE: "Synchronizing Collection",
    }[syncStatus] ?? "Synchronizing Collection";

  const description =
    {
      QUEUED: "Waiting for a preview-generation worker.",
      IN_PROGRESS: "Preparing video previews for your collection.",
      COMPLETED: "Your collection is up to date and ready to browse.",
      FAILED: "We couldn't finish synchronizing this collection.",
      IDLE: "Preparing to synchronize your collection.",
    }[syncStatus] ?? "Preparing to synchronize your collection.";

  const showScanningMessage =
    isRunning && collectionProgress.length === 0 && !hasReceivedProgress;

  const statusIcon = isComplete ? (
    <CheckCircle2 size={21} />
  ) : isFailed ? (
    <AlertCircle size={21} />
  ) : isBusy ? (
    <LoaderCircle className="sync-item-loading-icon" size={21} />
  ) : (
    <Clapperboard size={21} />
  );

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal-content sync-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-modal-title"
        aria-describedby="sync-modal-description"
      >
        <div className="modal-header">
          <div className="sync-modal-heading">
            <div className="sync-modal-icon">{statusIcon}</div>

            <div>
              <h2 id="sync-modal-title">{title}</h2>
              <p id="sync-modal-description" className="sync-modal-description">
                {description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="close-button"
            aria-label="Close modal"
          >
            <X size={19} />
          </button>
        </div>

        <div className="sync-modal-body">
          {isQueued && (
            <div className="sync-status-message" role="status">
              <span>
                Your request is queued. You can continue using CineBox.
              </span>
            </div>
          )}

          {showScanningMessage && (
            <div className="sync-status-message" role="status">
              <LoaderCircle className="sync-item-loading-icon" size={18} />
              <span>
                Checking your collection and preparing video previews…
              </span>
            </div>
          )}

          {collectionProgress.length > 0 && (
            <>
              <div className="sync-progress-heading">
                <span>Preview generation</span>
                <span>
                  {collectionProgress.length}{" "}
                  {collectionProgress.length === 1 ? "item" : "items"}
                </span>
              </div>

              {collectionProgress.map(([path, progress]) => {
                const percentage = Math.min(
                  100,
                  Math.max(0, Number(progress) || 0),
                );

                const videoName = path.split(/[\\/]/).slice(-2, -1)[0] || path;

                const isVideoComplete = percentage >= 100;

                return (
                  <div className="sync-progress-item" key={path}>
                    <div className="sync-progress-info">
                      <div className="sync-video-name">
                        {isVideoComplete ? (
                          <CheckCircle2
                            className="sync-item-complete-icon"
                            size={16}
                            aria-hidden="true"
                          />
                        ) : (
                          <LoaderCircle
                            className="sync-item-loading-icon"
                            size={16}
                            aria-hidden="true"
                          />
                        )}

                        <span title={path}>{videoName}</span>
                      </div>

                      <span className="sync-progress-percentage">
                        {percentage}%
                      </span>
                    </div>

                    <div
                      className="sync-progress-track"
                      role="progressbar"
                      aria-label={`Preview generation progress for ${videoName}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percentage}
                    >
                      <div
                        className="sync-progress-fill"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <div className="sync-progress-status">
                      {isVideoComplete ? "Preview ready" : "Generating preview"}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {isComplete && (
            <div className="sync-success" role="status">
              <div className="sync-success-icon">
                <CheckCircle2 size={22} />
              </div>

              <div>
                <p className="sync-success-title">Collection has been synced</p>
                <p className="sync-success-description">
                  Your video collection is ready to browse.
                </p>
              </div>
            </div>
          )}

          {isFailed && (
            <div className="sync-error" role="alert">
              <AlertCircle size={19} />

              <div>
                <p className="sync-error-title">Sync failed</p>
                <p className="sync-error-message">
                  {error ||
                    "An unexpected error occurred during synchronization."}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="sync-modal-footer">
          <button type="button" className="sync-close-action" onClick={onClose}>
            {isBusy ? "Continue in background" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncModal;
