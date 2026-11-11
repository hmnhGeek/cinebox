const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

const MEDIA_BAR_URL = `${API_BASE_URL}/api/v1/media-bar`;

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  let data = null;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text ? { message: text } : null;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Media Bar request failed (HTTP ${response.status}).`,
    );
  }

  return data;
}

export async function getMediaBarItems({ signal } = {}) {
  const response = await fetch(MEDIA_BAR_URL, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  return parseResponse(response);
}

export function resolveMediaBarAssetUrl(path) {
  if (!path) return "";

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
