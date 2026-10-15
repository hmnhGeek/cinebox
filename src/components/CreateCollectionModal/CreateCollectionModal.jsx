import React from "react";
import { Formik } from "formik";
import "./CreateCollectionModal.css";

const CreateCollectionModal = ({ isOpen, onClose, onCreate }) => {
  if (!isOpen) return null;

  const handleSubmit = async (values, { setSubmitting, setStatus }) => {
    setStatus(null);

    try {
      await onCreate({
        title: values.title.trim(),
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
          <h2 id="collection-modal-title">Create Collection</h2>

          <button
            type="button"
            onClick={onClose}
            className="close-button"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <p className="collection-description">
          Give your collection a title and select the folder containing your
          videos.
        </p>

        <Formik
          initialValues={{ title: "", folder: "" }}
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
              <div>
                <label htmlFor="collection-title">Collection Title</label>

                <input
                  type="text"
                  id="collection-title"
                  name="title"
                  placeholder="e.g. Movies, TV Shows, Documentaries"
                  value={values.title}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoFocus
                />

                {touched.title && errors.title && (
                  <p className="collection-error">{errors.title}</p>
                )}
              </div>

              <div>
                <label htmlFor="collection-folder">System Folder Path</label>

                <input
                  type="text"
                  id="collection-folder"
                  name="folder"
                  placeholder="e.g. D:\\Movies"
                  value={values.folder}
                  onChange={handleChange}
                  onBlur={handleBlur}
                />

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
                  className="app-level-button"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>

                <button
                  className="app-level-button"
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
