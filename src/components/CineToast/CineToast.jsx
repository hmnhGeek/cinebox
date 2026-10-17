import toast from "react-hot-toast";
import "./CineToast.css";

const icons = {
  success: <path d="m5 12 4 4L19 6" />,
  error: (
    <>
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  warning: (
    <>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 4.3 2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
};

const headings = {
  success: "Completed",
  error: "Something went wrong",
  warning: "Attention required",
  info: "For your information",
};

const CineToast = ({ t, type, message, title }) => {
  return (
    <div
      className={`cine-toast cine-toast--${type} ${
        t.visible ? "cine-toast--visible" : ""
      }`}
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      <div className="cine-toast__icon">
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {icons[type]}
        </svg>
      </div>

      <div className="cine-toast__content">
        <p className="cine-toast__title">{title || headings[type]}</p>
        <p className="cine-toast__message">{message}</p>
      </div>

      <button
        type="button"
        className="cine-toast__close"
        aria-label="Dismiss notification"
        onClick={() => toast.dismiss(t.id)}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="m18 6-12 12M6 6l12 12" />
        </svg>
      </button>

      <div className="cine-toast__progress">
        <div
          key={t.id}
          className="cine-toast__progress-fill"
          style={{
            animationDuration: `${t.duration || 4000}ms`,
            animationPlayState: t.visible ? "running" : "paused",
          }}
        />
      </div>
    </div>
  );
};

const show = (type, message, options = {}) => {
  const duration = options.duration ?? 4000;

  return toast.custom(
    (t) => (
      <CineToast t={t} type={type} message={message} title={options.title} />
    ),
    {
      duration,
      position: "top-center",
      id: options.id,
    },
  );
};

const cineToast = {
  success: (message, options) => show("success", message, options),
  error: (message, options) => show("error", message, options),
  warning: (message, options) => show("warning", message, options),
  info: (message, options) => show("info", message, options),
  dismiss: (id) => toast.dismiss(id),
};

export default cineToast;
