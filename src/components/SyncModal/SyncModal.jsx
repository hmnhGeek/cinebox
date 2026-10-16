import React from "react";
import {
  Clapperboard,
  X,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";
import "./SyncModal.css";

const SyncModal = ({ isOpen, onClose, syncProgress, error, collectionId }) => {
  if (!isOpen) return null;

  const collectionProgress = Object.entries(syncProgress).filter(([path]) =>
    path.includes(collectionId),
  );

  const hasProgress = collectionProgress.length > 0;
  const isComplete = !hasProgress && !error;

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
      >
        <div className="modal-header">
          <div className="sync-modal-heading">
            <div className="sync-modal-icon">
              {isComplete ? (
                <CheckCircle2 size={21} />
              ) : (
                <Clapperboard size={21} />
              )}
            </div>

            <div>
              <h2 id="sync-modal-title">
                {isComplete ? "Sync Complete" : "Synchronizing Collection"}
              </h2>

              <p className="sync-modal-description">
                {isComplete
                  ? "Your collection is up to date."
                  : "Preparing video previews for your collection."}
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
          {hasProgress && (
            <div className="sync-progress-heading">
              <span>Preview generation</span>
              <span>
                {collectionProgress.length}{" "}
                {collectionProgress.length === 1 ? "item" : "items"}
              </span>
            </div>
          )}

          {collectionProgress.map(([path, progress]) => {
            const percentage = Math.min(100, Math.max(0, progress));
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

          {error && (
            <div className="sync-error" role="alert">
              <AlertCircle size={19} />
              <div>
                <p className="sync-error-title">Sync failed</p>
                <p className="sync-error-message">{error}</p>
              </div>
            </div>
          )}
        </div>

        <div className="sync-modal-footer">
          <button type="button" className="sync-close-action" onClick={onClose}>
            {isComplete || error ? "Close" : "Continue in background"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncModal;
