import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import cineToast from "../CineToast/CineToast";
import {
  getManagedMetadata,
  getNfoStatus,
  reimportNfo,
  synchronizeNfo,
  updateManagedMetadata,
} from "../../service/metadataApi";
import "./MetadataManagementModal.css";

const EMPTY_FORM = {
  title: "",
  originalTitle: "",
  sortTitle: "",
  year: "",
  runtimeMinutes: "",
  plot: "",
  outline: "",
  premiered: "",
  releaseDate: "",
  country: "",
  originalCountry: "",
  language: "",
  mpaa: "",
  website: "",
  genres: "",
  studios: "",
  directors: "",
  writers: "",
  actors: "",
  tags: "",
};

const textValue = (value) => (value == null ? "" : String(value));

const getName = (value) =>
  typeof value === "string" ? value : value?.name || "";

const listToText = (items) =>
  Array.isArray(items) ? items.map(getName).filter(Boolean).join(", ") : "";

// Backend ActorDTO uses "role" for the character name.
const actorsToEntries = (items) =>
  Array.isArray(items)
    ? items
        .map((actor) => ({
          name: getName(actor),
          characterName:
            typeof actor === "object"
              ? actor?.characterName || actor?.character || actor?.role || ""
              : "",
        }))
        .filter((actor) => actor.name || actor.characterName)
    : [];

const toForm = (metadata = {}) => ({
  ...EMPTY_FORM,
  title: textValue(metadata.title),
  originalTitle: textValue(metadata.originalTitle),
  sortTitle: textValue(metadata.sortTitle),
  year: textValue(metadata.year),
  runtimeMinutes: textValue(metadata.runtimeMinutes),
  plot: textValue(metadata.plot),
  outline: textValue(metadata.outline),
  premiered: textValue(metadata.premiered),
  releaseDate: textValue(metadata.releaseDate),
  country: textValue(metadata.country),
  originalCountry: textValue(metadata.originalCountry),
  language: textValue(metadata.language),
  mpaa: textValue(metadata.mpaa),
  website: textValue(metadata.website),
  genres: listToText(metadata.genres),
  studios: listToText(metadata.studios),
  directors: listToText(metadata.directors),
  writers: listToText(metadata.writers),
  tags: listToText(metadata.tags),
});

const splitNames = (value) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const toPayload = (form, actorEntries) => {
  const toNamedObjects = (value) => splitNames(value).map((name) => ({ name }));

  return {
    title: form.title.trim(),
    originalTitle: form.originalTitle.trim() || null,
    sortTitle: form.sortTitle.trim() || null,
    year: form.year.trim() ? Number(form.year) : null,
    runtimeMinutes: form.runtimeMinutes.trim()
      ? Number(form.runtimeMinutes)
      : null,
    plot: form.plot.trim() || null,
    outline: form.outline.trim() || null,
    premiered: form.premiered || null,
    releaseDate: form.releaseDate || null,
    country: form.country.trim() || null,
    originalCountry: form.originalCountry.trim() || null,
    language: form.language.trim() || null,
    mpaa: form.mpaa.trim() || null,
    website: form.website.trim() || null,

    genres: toNamedObjects(form.genres),
    studios: toNamedObjects(form.studios),
    directors: toNamedObjects(form.directors),
    writers: toNamedObjects(form.writers),

    // Backend ActorDTO expects "role", not "characterName".
    actors: actorEntries
      .map((actor) => ({
        name: actor.name.trim(),
        role: actor.characterName.trim() || null,
      }))
      .filter((actor) => actor.name),

    tags: toNamedObjects(form.tags),
  };
};

const STATUS_COPY = {
  SYNCED: "NFO is synchronized with the database metadata.",
  PENDING: "Metadata is saved. NFO synchronization is pending.",
  FAILED:
    "The database is up to date, but the NFO file could not be synchronized.",
  MISSING: "No NFO file is currently available for this movie.",
  UNKNOWN: "NFO synchronization status is not available yet.",
};

const formatTimestamp = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

function Field({ label, name, value, onChange, type = "text", ...props }) {
  return (
    <label className="metadata-field">
      <span>{label}</span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        {...props}
      />
    </label>
  );
}

function TextAreaField({ label, name, value, onChange, hint, rows = 3 }) {
  return (
    <label className="metadata-field metadata-field--full">
      <span>{label}</span>
      <textarea name={name} value={value} onChange={onChange} rows={rows} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function MetadataManagementModal({
  mediaItemId,
  movieTitle,
  onClose,
  onMetadataUpdated,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [actorEntries, setActorEntries] = useState([]);
  const [nfoStatus, setNfoStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nfoAction, setNfoAction] = useState("");
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState("details");

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getNfoStatus(mediaItemId);
      setNfoStatus(status);
    } catch (error) {
      console.error("Failed to load NFO status:", error);
    }
  }, [mediaItemId]);

  const loadMetadata = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const [metadata] = await Promise.all([
        getManagedMetadata(mediaItemId),
        refreshStatus(),
      ]);

      setForm(toForm(metadata));
      setActorEntries(actorsToEntries(metadata.actors));
    } catch (error) {
      setLoadError(error.message || "Couldn't load movie metadata.");
    } finally {
      setLoading(false);
    }
  }, [mediaItemId, refreshStatus]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving && !nfoAction) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving, nfoAction]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleActorChange = (index, field, value) => {
    setActorEntries((current) =>
      current.map((actor, actorIndex) =>
        actorIndex === index ? { ...actor, [field]: value } : actor,
      ),
    );
  };

  const addActor = () => {
    setActorEntries((current) => [...current, { name: "", characterName: "" }]);
  };

  const removeActor = (index) => {
    setActorEntries((current) =>
      current.filter((_, actorIndex) => actorIndex !== index),
    );
  };

  const canSave = useMemo(
    () => Boolean(form.title.trim()) && !saving && !loading,
    [form.title, saving, loading],
  );

  const handleSave = async (event) => {
    event.preventDefault();
    if (!canSave) return;

    const payload = toPayload(form, actorEntries);

    if (
      (payload.year != null && !Number.isFinite(payload.year)) ||
      (payload.runtimeMinutes != null &&
        !Number.isFinite(payload.runtimeMinutes))
    ) {
      cineToast.error("Enter valid numeric values for year and runtime.");
      return;
    }

    setSaving(true);

    try {
      const result = await updateManagedMetadata(mediaItemId, payload);
      const updatedMetadata = result?.metadata || result;
      const returnedStatus = result?.nfoStatus;

      if (updatedMetadata && typeof updatedMetadata === "object") {
        setForm(toForm(updatedMetadata));
        setActorEntries(actorsToEntries(updatedMetadata.actors));
        onMetadataUpdated?.(updatedMetadata);
      }

      if (returnedStatus) setNfoStatus(returnedStatus);
      else await refreshStatus();

      if (returnedStatus?.status === "FAILED") {
        cineToast.warning(
          "Metadata was saved to CineBox, but the NFO file could not be updated. You can retry from NFO management.",
          { duration: 6500 },
        );
      } else {
        cineToast.success("Movie metadata saved successfully.");
      }
    } catch (error) {
      cineToast.error(error.message || "Couldn't save movie metadata.");
    } finally {
      setSaving(false);
    }
  };

  const runNfoAction = async (action) => {
    if (nfoAction) return;

    setNfoAction(action);

    try {
      const result =
        action === "reimport"
          ? await reimportNfo(mediaItemId)
          : await synchronizeNfo(mediaItemId);

      const updatedMetadata = result?.metadata;
      const status = result?.nfoStatus || result;

      if (updatedMetadata && typeof updatedMetadata === "object") {
        setForm(toForm(updatedMetadata));
        setActorEntries(actorsToEntries(updatedMetadata.actors));
        onMetadataUpdated?.(updatedMetadata);
      }

      if (status) setNfoStatus(status);
      await refreshStatus();

      cineToast.success(
        action === "reimport"
          ? "NFO metadata re-imported into CineBox."
          : "NFO file synchronized successfully.",
      );
    } catch (error) {
      await refreshStatus();

      cineToast.error(
        error.message ||
          (action === "reimport"
            ? "Couldn't re-import the NFO file."
            : "Couldn't synchronize the NFO file."),
      );
    } finally {
      setNfoAction("");
    }
  };

  const statusCode = String(nfoStatus?.status || "UNKNOWN").toUpperCase();
  const statusMessage =
    nfoStatus?.errorMessage || STATUS_COPY[statusCode] || STATUS_COPY.UNKNOWN;

  return createPortal(
    <div
      className="metadata-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving && !nfoAction) {
          onClose();
        }
      }}
    >
      <section
        className="metadata-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="metadata-modal-title"
      >
        <header className="metadata-modal__header">
          <div>
            <span className="metadata-modal__eyebrow">CINEBOX LIBRARY</span>
            <h2 id="metadata-modal-title">Manage metadata</h2>
            <p>{movieTitle}</p>
          </div>

          <button
            type="button"
            className="metadata-modal__close"
            onClick={onClose}
            disabled={saving || Boolean(nfoAction)}
            aria-label="Close metadata manager"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
          </button>
        </header>

        <nav className="metadata-modal__tabs" aria-label="Metadata sections">
          <button
            type="button"
            className={activeTab === "details" ? "is-active" : ""}
            onClick={() => setActiveTab("details")}
          >
            Movie details
          </button>

          <button
            type="button"
            className={activeTab === "nfo" ? "is-active" : ""}
            onClick={() => setActiveTab("nfo")}
          >
            NFO management
            {statusCode === "FAILED" && (
              <i aria-label="Synchronization failed" />
            )}
          </button>
        </nav>

        {loading ? (
          <div className="metadata-modal__loading">
            <span className="metadata-modal__spinner" />
            <span>Loading movie metadata...</span>
          </div>
        ) : loadError ? (
          <div className="metadata-modal__error-state">
            <strong>Metadata couldn't be loaded</strong>
            <p>{loadError}</p>
            <button
              type="button"
              className="metadata-button metadata-button--secondary"
              onClick={loadMetadata}
            >
              Try again
            </button>
          </div>
        ) : activeTab === "details" ? (
          <form className="metadata-modal__body" onSubmit={handleSave}>
            <div className="metadata-section-heading">
              <span>01</span>
              <div>
                <h3>Identity</h3>
                <p>Titles and core movie information</p>
              </div>
            </div>

            <div className="metadata-form-grid">
              <Field
                label="Display title *"
                name="title"
                value={form.title}
                onChange={handleChange}
                required
              />

              <Field
                label="Original title"
                name="originalTitle"
                value={form.originalTitle}
                onChange={handleChange}
              />

              <Field
                label="Sort title"
                name="sortTitle"
                value={form.sortTitle}
                onChange={handleChange}
              />

              <Field
                label="Year"
                name="year"
                type="number"
                min="1800"
                max="2200"
                value={form.year}
                onChange={handleChange}
              />

              <Field
                label="Runtime (minutes)"
                name="runtimeMinutes"
                type="number"
                min="0"
                value={form.runtimeMinutes}
                onChange={handleChange}
              />

              <Field
                label="Content rating"
                name="mpaa"
                value={form.mpaa}
                onChange={handleChange}
                placeholder="e.g. U/A 13+"
              />
            </div>

            <div className="metadata-section-heading">
              <span>02</span>
              <div>
                <h3>Story & release</h3>
                <p>Descriptions, dates and origin</p>
              </div>
            </div>

            <div className="metadata-form-grid">
              <TextAreaField
                label="Plot"
                name="plot"
                value={form.plot}
                onChange={handleChange}
                rows={4}
              />

              <TextAreaField
                label="Outline"
                name="outline"
                value={form.outline}
                onChange={handleChange}
                rows={3}
              />

              <Field
                label="Premiered"
                name="premiered"
                type="date"
                value={form.premiered}
                onChange={handleChange}
              />

              <Field
                label="Release date"
                name="releaseDate"
                type="date"
                value={form.releaseDate}
                onChange={handleChange}
              />

              <Field
                label="Country"
                name="country"
                value={form.country}
                onChange={handleChange}
              />

              <Field
                label="Original country"
                name="originalCountry"
                value={form.originalCountry}
                onChange={handleChange}
              />

              <Field
                label="Language"
                name="language"
                value={form.language}
                onChange={handleChange}
              />

              <Field
                label="Website"
                name="website"
                type="url"
                value={form.website}
                onChange={handleChange}
                placeholder="https://"
              />
            </div>

            <div className="metadata-section-heading">
              <span>03</span>
              <div>
                <h3>People & classification</h3>
                <p>
                  Separate names with commas. Manage actors and their characters
                  individually.
                </p>
              </div>
            </div>

            <div className="metadata-form-grid">
              <TextAreaField
                label="Genres"
                name="genres"
                value={form.genres}
                onChange={handleChange}
                hint="Example: Drama, Thriller"
                rows={2}
              />

              <TextAreaField
                label="Studios"
                name="studios"
                value={form.studios}
                onChange={handleChange}
                rows={2}
              />

              <TextAreaField
                label="Directors"
                name="directors"
                value={form.directors}
                onChange={handleChange}
                rows={2}
              />

              <TextAreaField
                label="Writers"
                name="writers"
                value={form.writers}
                onChange={handleChange}
                rows={2}
              />

              <div className="metadata-actors-editor">
                <div className="metadata-actors-editor__header">
                  <div>
                    <span className="metadata-actors-editor__eyebrow">
                      CAST & CHARACTERS
                    </span>
                    <h4>Cast members</h4>
                    <p>Manage the actors and the characters they portray.</p>
                  </div>

                  <span className="metadata-actors-editor__count">
                    {actorEntries.length}{" "}
                    {actorEntries.length === 1 ? "ACTOR" : "ACTORS"}
                  </span>
                </div>

                {actorEntries.length > 0 ? (
                  <div className="metadata-actors-list">
                    {actorEntries.map((actor, index) => (
                      <div className="metadata-actor-card" key={index}>
                        <div className="metadata-actor-card__index">
                          {String(index + 1).padStart(2, "0")}
                        </div>

                        <div className="metadata-actor-card__fields">
                          <label>
                            <span>ACTOR NAME</span>
                            <input
                              type="text"
                              value={actor.name}
                              onChange={(event) =>
                                handleActorChange(
                                  index,
                                  "name",
                                  event.target.value,
                                )
                              }
                              placeholder="e.g. Leonardo DiCaprio"
                            />
                          </label>

                          <label>
                            <span>CHARACTER / ROLE</span>
                            <input
                              type="text"
                              value={actor.characterName}
                              onChange={(event) =>
                                handleActorChange(
                                  index,
                                  "characterName",
                                  event.target.value,
                                )
                              }
                              placeholder="e.g. Dom Cobb"
                            />
                          </label>
                        </div>

                        <button
                          type="button"
                          className="metadata-actor-card__remove"
                          onClick={() => removeActor(index)}
                          aria-label={`Remove actor ${actor.name || index + 1}`}
                          title="Remove actor"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="metadata-actors-empty">
                    <span className="metadata-actors-empty__icon">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="9" cy="8" r="3.5" />
                        <path d="M2.5 20c0-3.6 2.8-6 6.5-6 2 0 3.7.7 4.9 2" />
                        <path d="M18 11v8M14 15h8" />
                      </svg>
                    </span>

                    <strong>No cast members added</strong>
                    <span>
                      Add actors and their character names to build the movie's
                      cast.
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  className="metadata-actors-add"
                  onClick={addActor}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add actor
                </button>
              </div>

              <TextAreaField
                label="Tags"
                name="tags"
                value={form.tags}
                onChange={handleChange}
                hint="Example: Based on a novel, Award winner"
                rows={3}
              />
            </div>

            <footer className="metadata-modal__footer">
              <span>
                Changes are saved to CineBox first. NFO synchronization is
                handled separately.
              </span>

              <div>
                <button
                  type="button"
                  className="metadata-button metadata-button--secondary"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="metadata-button metadata-button--primary"
                  disabled={!canSave}
                >
                  {saving ? (
                    <>
                      <span className="metadata-button__spinner" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </footer>
          </form>
        ) : (
          <div className="metadata-modal__body metadata-nfo-panel">
            <div className="metadata-section-heading">
              <span>04</span>
              <div>
                <h3>NFO file status</h3>
                <p>
                  The NFO file is a portable representation of your CineBox
                  metadata.
                </p>
              </div>
            </div>

            <div
              className={`nfo-status-card nfo-status-card--${statusCode.toLowerCase()}`}
            >
              <div className="nfo-status-card__topline">
                <span className="nfo-status-indicator" />
                <strong>{statusCode}</strong>
              </div>

              <p>{statusMessage}</p>

              {nfoStatus?.lastAttemptAt && (
                <div>
                  <span>Last attempt</span>
                  <strong>{formatTimestamp(nfoStatus.lastAttemptAt)}</strong>
                </div>
              )}

              {nfoStatus?.lastSyncedAt && (
                <div>
                  <span>Last successful sync</span>
                  <strong>{formatTimestamp(nfoStatus.lastSyncedAt)}</strong>
                </div>
              )}
            </div>

            <div className="nfo-action-card">
              <div>
                <h4>Synchronize NFO</h4>
                <p>
                  Write the current CineBox database metadata to the movie's NFO
                  file. A missing NFO file will be generated.
                </p>
              </div>

              <button
                type="button"
                className="metadata-button metadata-button--secondary"
                onClick={() => runNfoAction("sync")}
                disabled={Boolean(nfoAction)}
              >
                {nfoAction === "sync" ? "Synchronizing..." : "Sync NFO"}
              </button>
            </div>

            <div className="nfo-action-card">
              <div>
                <h4>Re-import from NFO</h4>
                <p>
                  Replace the supported CineBox metadata fields with values from
                  the NFO file. This does not merge changes.
                </p>
              </div>

              <button
                type="button"
                className="metadata-button metadata-button--secondary"
                onClick={() => runNfoAction("reimport")}
                disabled={Boolean(nfoAction) || statusCode === "MISSING"}
              >
                {nfoAction === "reimport" ? "Re-importing..." : "Re-import NFO"}
              </button>
            </div>

            {statusCode === "FAILED" && nfoStatus?.errorMessage && (
              <div className="nfo-error-detail">
                <strong>Last synchronization error</strong>
                <p>{nfoStatus.errorMessage}</p>
              </div>
            )}

            <footer className="metadata-modal__footer metadata-modal__footer--nfo">
              <span>
                Re-import overwrites database values for supported fields. Use
                it only when you intend to replace them.
              </span>

              <button
                type="button"
                className="metadata-button metadata-button--secondary"
                onClick={refreshStatus}
              >
                Refresh status
              </button>
            </footer>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}

export default MetadataManagementModal;
