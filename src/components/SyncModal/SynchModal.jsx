import React from "react";
import "./SyncModal.css";

const SyncModal = ({
  isOpen,
  onClose,
  syncing,
  syncProgress,
  syncMessage,
  error,
  collectionId,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        // Close only if clicking the backdrop, and allow closing when done syncing
        if (event.target === event.currentTarget && !syncing) {
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
          <h2 id="sync-modal-title">Synchronizing Collection(s)</h2>

          <button
            type="button"
            onClick={onClose}
            className="close-button"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {syncing && (
          <div className="sync-progress-heading">
            <span>Generating video previews...</span>
          </div>
        )}

        <div className="sync-modal-body">
          {Object.entries(syncProgress).map(([path, progress]) => {
            if (!path.includes(collectionId)) {
              return null;
            }
            const percentage = Math.min(100, Math.max(0, progress));
            const videoName = path.split(/[\\/]/).slice(-2, -1)[0] || path;

            return (
              <div className="sync-progress-item" key={path}>
                <div className="sync-progress-info">
                  <span title={path}>{videoName}</span>
                  <span>{percentage}%</span>
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
              </div>
            );
          })}

          {syncMessage && <div className="success">{syncMessage}</div>}
          {error && <div className="error">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default SyncModal;
