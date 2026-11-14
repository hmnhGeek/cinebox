const API_BASE_URL = `${(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")}/api/v1/media-items`;

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;

    try {
      const payload = await response.json();
      message = payload.message || payload.error || message;
    } catch {
      try {
        const text = await response.text();
        if (text) message = text;
      } catch {
        // Keep the HTTP fallback message.
      }
    }

    throw new Error(message);
  }

  if (response.status === 204) return null;

  return response.json();
}

const itemUrl = (mediaItemId) =>
  `${API_BASE_URL}/${encodeURIComponent(mediaItemId)}`;

export const getManagedMetadata = (mediaItemId) =>
  request(`${itemUrl(mediaItemId)}/metadata`);

export const updateManagedMetadata = (mediaItemId, metadata) =>
  request(`${itemUrl(mediaItemId)}/metadata`, {
    method: "PUT",
    body: JSON.stringify(metadata),
  });

export const getNfoStatus = (mediaItemId) =>
  request(`${itemUrl(mediaItemId)}/nfo/status`);

export const synchronizeNfo = (mediaItemId) =>
  request(`${itemUrl(mediaItemId)}/nfo/sync`, {
    method: "POST",
  });

export const reimportNfo = (mediaItemId) =>
  request(`${itemUrl(mediaItemId)}/nfo/reimport`, {
    method: "POST",
  });
