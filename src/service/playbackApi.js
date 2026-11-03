const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

const PLAYBACK_API_URL = `${API_BASE_URL}/api/v1/playback`;

async function handleResponse(response) {
  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Request failed (${response.status})`);
  }

  return response.json();
}

export async function getContinueWatching({ page = 0, size = 20 } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });

  const response = await fetch(
    `${PLAYBACK_API_URL}/continue-watching?${params}`,
  );

  return handleResponse(response);
}

export async function getPlaybackProgress(mediaItemId) {
  const response = await fetch(
    `${PLAYBACK_API_URL}/media-items/${encodeURIComponent(mediaItemId)}/progress`,
  );

  if (response.status === 404) {
    return null;
  }

  return handleResponse(response);
}

export async function updatePlaybackProgress(
  mediaItemId,
  { positionSeconds, durationSeconds },
) {
  const response = await fetch(
    `${PLAYBACK_API_URL}/media-items/${encodeURIComponent(mediaItemId)}/progress`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        positionSeconds: Math.max(0, Math.floor(positionSeconds || 0)),
        durationSeconds:
          Number.isFinite(durationSeconds) && durationSeconds > 0
            ? Math.floor(durationSeconds)
            : null,
      }),
    },
  );

  return handleResponse(response);
}

export async function markPlaybackCompleted(mediaItemId) {
  const response = await fetch(
    `${PLAYBACK_API_URL}/media-items/${encodeURIComponent(mediaItemId)}/complete`,
    {
      method: "POST",
    },
  );

  return handleResponse(response);
}

export async function deletePlaybackProgress(mediaItemId) {
  const response = await fetch(
    `${PLAYBACK_API_URL}/media-items/${encodeURIComponent(mediaItemId)}/progress`,
    {
      method: "DELETE",
    },
  );

  return handleResponse(response);
}
