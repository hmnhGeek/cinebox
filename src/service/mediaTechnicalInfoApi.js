const API_BASE_URL = `${(import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
)}/api/v1/media-items`;

export const getMediaTechnicalInfo = async (mediaItemId) => {
  const response = await fetch(
    `${API_BASE_URL}/${encodeURIComponent(mediaItemId)}/technical-info`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch technical information.");
  }

  return response.json();
};

export const requestMediaTechnicalInfo = async (mediaItemId, force = false) => {
  const response = await fetch(
    `${API_BASE_URL}/${encodeURIComponent(mediaItemId)}/technical-info/sync?force=${force}`,
    { method: "POST" },
  );

  if (!response.ok) {
    let message = "Failed to request technical information.";

    try {
      const errorData = await response.json();
      message = errorData.message || message;
    } catch {
      // Response may not contain JSON.
    }

    throw new Error(message);
  }

  return response.json();
};
