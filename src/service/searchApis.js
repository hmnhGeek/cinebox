const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

async function fetchSearchData(endpoint, params) {
  const query = new URLSearchParams(params);
  const response = await fetch(
    `${API_BASE_URL}/api/v1/search/${endpoint}?${query.toString()}`,
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Search request failed (${response.status})`);
  }

  return response.json();
}

export function getSearchSuggestions(query, limit = 8) {
  return fetchSearchData("suggestions", {
    q: query,
    limit: String(limit),
  });
}

export function getSearchResults(query, page = 0, size = 24) {
  return fetchSearchData("results", {
    q: query,
    page: String(page),
    size: String(size),
  });
}
