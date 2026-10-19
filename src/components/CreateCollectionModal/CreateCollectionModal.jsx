import React from "react";
import { Formik } from "formik";
import { Clapperboard, X, FolderOpen } from "lucide-react";
import "./CreateCollectionModal.css";

const CreateCollectionModal = ({ isOpen, onClose, onCreate }) => {
  if (!isOpen) return null;

  const handleSubmit = async (values, { setSubmitting, setStatus }) => {
    setStatus(null);

    try {
      await onCreate({
        title: values.title.trim(),
        tagline: values.tagline.trim(),
        folder: values.folder.trim(),
      });

      onClose();
    } catch (error) {
      setStatus(error.message || "Failed to create collection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content collection-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-modal-title"
      >
        <div className="modal-header">
          <div className="collection-modal-heading">
            <div className="collection-modal-icon">
              <Clapperboard size={21} />
            </div>

            <div>
              <h2 id="collection-modal-title">Create Collection</h2>
              <p className="collection-description">
                Build a home for the movies you love.
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

        <Formik
          initialValues={{
            title: "",
            tagline: "",
            folder: "",
          }}
          validate={(values) => {
            const errors = {};

            if (!values.title.trim()) {
              errors.title = "Please enter a collection title.";
            }

            if (!values.folder.trim()) {
              errors.folder = "Please enter a folder path.";
            }

            return errors;
          }}
          onSubmit={handleSubmit}
        >
          {({
            values,
            errors,
            touched,
            handleChange,
            handleBlur,
            handleSubmit,
            isSubmitting,
            status,
          }) => (
            <form onSubmit={handleSubmit}>
              <div className="collection-field">
                <label htmlFor="collection-title">Collection title</label>

                <input
                  type="text"
                  id="collection-title"
                  name="title"
                  placeholder="e.g. Movies, Documentaries"
                  value={values.title}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoFocus
                />

                {touched.title && errors.title && (
                  <p className="collection-error">{errors.title}</p>
                )}
              </div>

              <div className="collection-field">
                <label htmlFor="collection-tagline">
                  Tagline <span className="collection-optional">Optional</span>
                </label>

                <input
                  type="text"
                  id="collection-tagline"
                  name="tagline"
                  placeholder="A collection worth coming back to"
                  value={values.tagline}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={300}
                />

                <p className="collection-help">
                  A short description displayed beneath your collection title.
                </p>
              </div>

              <div className="collection-field">
                <label htmlFor="collection-folder">System folder path</label>

                <div className="collection-folder-input">
                  <FolderOpen size={18} aria-hidden="true" />

                  <input
                    type="text"
                    id="collection-folder"
                    name="folder"
                    placeholder="e.g. D:\\Movies"
                    value={values.folder}
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                </div>

                <p className="collection-help">
                  Enter the absolute path accessible to your backend.
                </p>

                {touched.folder && errors.folder && (
                  <p className="collection-error">{errors.folder}</p>
                )}
              </div>

              {status && (
                <p className="collection-error" role="alert">
                  {status}
                </p>
              )}

              <div className="collection-actions">
                <button
                  type="button"
                  className="collection-cancel"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>

                <button
                  className="collection-create"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create Collection"}
                </button>
              </div>
            </form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default CreateCollectionModal;
