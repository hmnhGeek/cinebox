import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  Save,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import actorProfileApi from "../../service/actorProfileApi";
import "./ActorProfileEditor.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

const MAX_IMAGE_SIZE = 15 * 1024 * 1024;

const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

function resolveImageUrl(url) {
  if (!url) return "";

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function validateSelectedImage(file, label) {
  if (!file) {
    return `${label} is required.`;
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `${label} must be a JPEG, PNG, WebP, or AVIF image.`;
  }

  if (file.size <= 0) {
    return `${label} is empty.`;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return `${label} must be 15 MB or smaller.`;
  }

  return "";
}

function ImageField({
  id,
  label,
  description,
  currentUrl,
  selectedFile,
  onFileChange,
  previewAlt,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [previewError, setPreviewError] = useState(false);

  const previewUrl = useMemo(() => {
    if (!selectedFile) {
      return currentUrl || "";
    }

    return URL.createObjectURL(selectedFile);
  }, [selectedFile, currentUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    setPreviewError(false);
  }, [previewUrl]);

  const hasPreview = Boolean(previewUrl) && !previewError;

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;

    // Reset the native input so selecting the same file again works.
    event.target.value = "";

    if (!file) {
      return;
    }

    const validationError = validateSelectedImage(file, label);

    if (validationError) {
      onFileChange(null);
      setPreviewError(false);

      // The parent form owns the main error message.
      onFileChange({
        validationError,
        invalidFile: true,
      });

      return;
    }

    onFileChange(file);
  };

  return (
    <div className="actor-editor-field">
      <div className="actor-editor-field-heading">
        <label className="actor-editor-label" htmlFor={id}>
          {label}
          <span className="actor-editor-required" aria-hidden="true">
            *
          </span>
        </label>

        <span className="actor-editor-field-status">
          {selectedFile
            ? "NEW IMAGE"
            : currentUrl
              ? "CURRENT IMAGE"
              : "REQUIRED"}
        </span>
      </div>

      <p className="actor-editor-field-description">{description}</p>

      <button
        className={`actor-editor-image-preview ${
          id === "actor-hero-image"
            ? "actor-editor-hero-preview"
            : "actor-editor-portrait-preview"
        }`}
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label={`Choose ${label.toLowerCase()}`}
      >
        {hasPreview ? (
          <img
            src={previewUrl}
            alt={previewAlt}
            onError={() => setPreviewError(true)}
          />
        ) : (
          <span className="actor-editor-image-placeholder">
            {id === "actor-hero-image" ? (
              <ImagePlus size={27} strokeWidth={1.4} />
            ) : (
              <UserRound size={30} strokeWidth={1.4} />
            )}

            <span>
              {previewUrl ? "Preview unavailable" : "No image selected"}
            </span>
          </span>
        )}

        <span className="actor-editor-image-action">
          <Upload size={15} />
          {selectedFile
            ? "Change image"
            : currentUrl
              ? "Replace image"
              : "Choose image"}
        </span>
      </button>

      <input
        ref={inputRef}
        id={id}
        className="actor-editor-file-input"
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        onChange={handleFileChange}
        disabled={disabled}
        aria-required="true"
      />

      <div className="actor-editor-file-footer">
        <span className="actor-editor-file-name">
          {selectedFile
            ? selectedFile.name
            : currentUrl
              ? "Existing image will be retained"
              : "No image selected"}
        </span>

        {selectedFile && (
          <button
            type="button"
            className="actor-editor-clear-file"
            onClick={() => onFileChange(null)}
            disabled={disabled}
          >
            Revert
          </button>
        )}
      </div>
    </div>
  );
}

function ActorProfileEditor({ personId, profile, onClose, onSaved }) {
  const [heroFile, setHeroFile] = useState(null);
  const [portraitFile, setPortraitFile] = useState(null);
  const [biography, setBiography] = useState(profile?.biography || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [completedSteps, setCompletedSteps] = useState([]);
  const [heroFileError, setHeroFileError] = useState("");
  const [portraitFileError, setPortraitFileError] = useState("");

  const heroUrl = resolveImageUrl(profile?.heroImageUrl);
  const portraitUrl = resolveImageUrl(profile?.profileImageUrl);

  const isComplete =
    Boolean(heroUrl) &&
    Boolean(portraitUrl) &&
    typeof profile?.biography === "string" &&
    Boolean(profile.biography.trim());

  const modeLabel = isComplete ? "Edit Profile" : "Add Profile";

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, saving]);

  const handleHeroFileChange = (file) => {
    if (file?.invalidFile) {
      setHeroFile(null);
      setHeroFileError(file.validationError);
      setError("");
      return;
    }

    setHeroFile(file);
    setHeroFileError("");
    setError("");
  };

  const handlePortraitFileChange = (file) => {
    if (file?.invalidFile) {
      setPortraitFile(null);
      setPortraitFileError(file.validationError);
      setError("");
      return;
    }

    setPortraitFile(file);
    setPortraitFileError("");
    setError("");
  };

  const validateForm = () => {
    if (heroFileError) {
      return heroFileError;
    }

    if (portraitFileError) {
      return portraitFileError;
    }

    if (!heroUrl && !heroFile) {
      return "A hero image is required. Choose an image to continue.";
    }

    if (!portraitUrl && !portraitFile) {
      return "A profile portrait is required. Choose an image to continue.";
    }

    if (!biography.trim()) {
      return "Biography is required. Enter a biography to continue.";
    }

    if (heroFile) {
      const message = validateSelectedImage(heroFile, "Hero image");

      if (message) {
        return message;
      }
    }

    if (portraitFile) {
      const message = validateSelectedImage(portraitFile, "Profile portrait");

      if (message) {
        return message;
      }
    }

    if (biography.trim().length > 10000) {
      return "Biography cannot exceed 10,000 characters.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setError("");
    setCompletedSteps([]);

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    const completed = [];

    try {
      if (heroFile) {
        try {
          await actorProfileApi.updateHeroImage(personId, heroFile);
          completed.push("Hero image");
          setCompletedSteps([...completed]);
        } catch (cause) {
          throw new Error(
            `Hero image could not be saved: ${cause.message || "Request failed."}`,
          );
        }
      }

      if (portraitFile) {
        try {
          await actorProfileApi.updateProfileImage(personId, portraitFile);
          completed.push("Profile portrait");
          setCompletedSteps([...completed]);
        } catch (cause) {
          throw new Error(
            `Profile portrait could not be saved: ${cause.message || "Request failed."}`,
          );
        }
      }

      try {
        await actorProfileApi.updateBiography(personId, biography);
        completed.push("Biography");
        setCompletedSteps([...completed]);
      } catch (cause) {
        throw new Error(
          `Biography could not be saved: ${cause.message || "Request failed."}`,
        );
      }

      // If refreshing fails, the editor stays open and reports the issue.
      // The individual updates may already have succeeded on the server.
      await onSaved();
    } catch (cause) {
      const savedMessage = completed.length
        ? ` Successfully saved: ${completed.join(", ")}. Retry to finish any remaining changes.`
        : "";

      setError(
        `${cause.message || "Unable to save the profile."}${savedMessage}`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="actor-editor-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <section
        className="actor-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="actor-editor-title"
        aria-describedby="actor-editor-description"
      >
        <header className="actor-editor-header">
          <div className="actor-editor-heading-copy">
            <span className="actor-editor-eyebrow">CINEBOX / PEOPLE</span>

            <h2 id="actor-editor-title">{modeLabel}</h2>

            <p id="actor-editor-description">
              Curate the artwork and biography behind this filmography.
            </p>
          </div>

          <button
            type="button"
            className="actor-editor-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close profile editor"
          >
            <X size={19} />
          </button>
        </header>

        <form className="actor-editor-form" onSubmit={handleSubmit} noValidate>
          <div className="actor-editor-section-heading">
            <span className="actor-editor-section-number">01</span>

            <div>
              <h3>Profile artwork</h3>
              <p>Use clear, high-quality images that represent this person.</p>
            </div>
          </div>

          <div className="actor-editor-image-grid">
            <ImageField
              id="actor-hero-image"
              label="Hero image"
              description="Wide artwork displayed across the top of the profile."
              currentUrl={heroUrl}
              selectedFile={heroFile}
              onFileChange={handleHeroFileChange}
              previewAlt="Hero artwork preview"
              disabled={saving}
            />

            <ImageField
              id="actor-profile-image"
              label="Profile portrait"
              description="Portrait artwork displayed beside the biography."
              currentUrl={portraitUrl}
              selectedFile={portraitFile}
              onFileChange={handlePortraitFileChange}
              previewAlt="Profile portrait preview"
              disabled={saving}
            />
          </div>

          <div className="actor-editor-divider" />

          <div className="actor-editor-section-heading">
            <span className="actor-editor-section-number">02</span>

            <div>
              <h3>Biography</h3>
              <p>
                Add a concise, informative overview of this person's career.
              </p>
            </div>
          </div>

          <div className="actor-editor-field actor-editor-biography-field">
            <div className="actor-editor-field-heading">
              <label className="actor-editor-label" htmlFor="actor-biography">
                Biography
                <span className="actor-editor-required" aria-hidden="true">
                  *
                </span>
              </label>

              <span className="actor-editor-character-count">
                {biography.length.toLocaleString()} / 10,000
              </span>
            </div>

            <textarea
              id="actor-biography"
              value={biography}
              onChange={(event) => {
                setBiography(event.target.value);
                setError("");
              }}
              placeholder="Write a biography covering career highlights, notable work, and background..."
              rows={7}
              maxLength={10000}
              required
              disabled={saving}
              aria-describedby="actor-biography-help"
            />

            <div id="actor-biography-help" className="actor-editor-help">
              Required. Up to 10,000 characters. Line breaks are preserved.
            </div>
          </div>

          {error && (
            <div className="actor-editor-error" role="alert">
              <AlertCircle size={17} />
              <p>{error}</p>
            </div>
          )}

          {completedSteps.length > 0 && saving && (
            <div className="actor-editor-progress" aria-live="polite">
              <CheckCircle2 size={16} />
              <span>Saved so far: {completedSteps.join(", ")}</span>
            </div>
          )}

          <footer className="actor-editor-footer">
            <span className="actor-editor-required-note">
              <span aria-hidden="true">*</span> All fields are required
            </span>

            <div className="actor-editor-actions">
              <button
                type="button"
                className="actor-editor-cancel"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="actor-editor-save"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <LoaderCircle
                      className="actor-editor-save-spinner"
                      size={16}
                    />
                    Saving profile...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save profile
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default ActorProfileEditor;
