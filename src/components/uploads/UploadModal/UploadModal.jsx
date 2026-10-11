import react from "react";
import { Formik } from "formik";
import "./UploadModal.css";

const UploadModal = ({ isOpen, onClose, onUpload }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Upload Video</h2>
          <button
            onClick={onClose}
            className="close-button"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>
        <Formik
          initialValues={{
            title: "",
            description: "",
            file: null,
            poster: null,
            thumbnail: null,
          }}
          onSubmit={(values, { setSubmitting }) => {
            onUpload(values);
            setSubmitting(false);
            onClose();
          }}
        >
          {({
            values,
            handleChange,
            handleBlur,
            handleSubmit,
            isSubmitting,
          }) => (
            <form onSubmit={handleSubmit}>
              <div>
                <label htmlFor="title">Title</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={values.title}
                  onChange={handleChange}
                  onBlur={handleBlur}
                />
              </div>
              <div>
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={values.description}
                  onChange={handleChange}
                  onBlur={handleBlur}
                />
              </div>
              <div>
                <label htmlFor="file">File</label>
                <input
                  type="file"
                  id="file"
                  name="file"
                  onChange={(event) => {
                    handleChange({
                      target: {
                        name: "file",
                        value: event.target.files[0],
                      },
                    });
                  }}
                />
              </div>
              <div>
                <label htmlFor="poster">Poster</label>
                <input
                  type="file"
                  id="poster"
                  name="poster"
                  onChange={(event) => {
                    handleChange({
                      target: {
                        name: "poster",
                        value: event.target.files[0],
                      },
                    });
                  }}
                />
              </div>
              <div>
                <label htmlFor="thumbnail">Thumbnail</label>
                <input
                  type="file"
                  id="thumbnail"
                  name="thumbnail"
                  onChange={(event) => {
                    handleChange({
                      target: {
                        name: "thumbnail",
                        value: event.target.files[0],
                      },
                    });
                  }}
                />
              </div>
              <button type="submit" disabled={isSubmitting}>
                Upload
              </button>
            </form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default UploadModal;
