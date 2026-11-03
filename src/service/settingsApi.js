const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

const SETTINGS_URL = `${API_BASE_URL}/api/v1/settings`;

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
        `Settings request failed (HTTP ${response.status}).`,
    );
  }

  return data;
}

export async function getSettings({ signal } = {}) {
  const response = await fetch(SETTINGS_URL, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  return parseResponse(response);
}

export async function updateSettings(settings) {
  const response = await fetch(SETTINGS_URL, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ settings }),
  });

  return parseResponse(response);
}
