const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

function buildGalleryUrl(collectionId, mediaItemId, page, size) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });

  return `${API_BASE_URL}/api/v1/collections/${encodeURIComponent(
    collectionId,
  )}/videos/${encodeURIComponent(mediaItemId)}/gallery?${params}`;
}

export async function getGalleryImages(
  collectionId,
  mediaItemId,
  page = 0,
  size = 20,
  signal,
) {
  const response = await fetch(
    buildGalleryUrl(collectionId, mediaItemId, page, size),
    { signal },
  );

  if (!response.ok) {
    let message = "Failed to fetch gallery images.";

    try {
      const error = await response.json();
      message = error.message || message;
    } catch {
      // The server may return a non-JSON error response.
    }

    throw new Error(message);
  }

  return response.json();
}

export function resolveGalleryImageUrl(url) {
  if (!url) return "";

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}
