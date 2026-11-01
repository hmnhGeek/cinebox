const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")}/api/v1/collections`;

const DEFAULT_PAGE_SIZE = 24;
const SYNC_PAGE_SIZE = 100;

export const createCollection = async ({ title, folder, tagline }) => {
  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, folder, tagline }),
  });

  if (!response.ok) {
    let message = "Failed to create collection.";

    try {
      const errorData = await response.json();
      message = errorData.message || message;
    } catch {
      // Keep the default error message.
    }

    throw new Error(message);
  }

  return response.json();
};

export const getAllCollections = async () => {
  const response = await fetch(API_BASE_URL);

  if (!response.ok) {
    throw new Error("Failed to fetch collections.");
  }

  return response.json();
};

export const getAllCollectionById = async (collectionId) => {
  const response = await fetch(
    `${API_BASE_URL}/${encodeURIComponent(collectionId)}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch collection.");
  }

  return response.json();
};

/**
 * Retrieves one page of videos belonging to a collection.
 *
 * Returns the Spring Page response:
 * {
 *   content: VideoMetadata[],
 *   number: number,
 *   size: number,
 *   totalElements: number,
 *   totalPages: number,
 *   first: boolean,
 *   last: boolean,
 *   ...
 * }
 */

export const getCollectionVideos = async (
  collectionId,
  { page = 0, size = 24, sortBy = "title", direction = "asc" } = {},
) => {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sortBy,
    direction,
  });

  const response = await fetch(
    `${API_BASE_URL}/${encodeURIComponent(collectionId)}/videos?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch collection videos.");
  }

  return response.json();
};

/**
 * Retrieves all videos in a collection by consuming every page.
 *
 * Intended for background operations that must process the complete
 * collection, rather than screen rendering or infinite scrolling.
 */
export const getAllCollectionVideos = async (
  collectionId,
  { size = SYNC_PAGE_SIZE, sortBy = "title", direction = "asc" } = {},
) => {
  const allVideos = [];
  let page = 0;
  let lastPage = false;

  while (!lastPage) {
    const pageData = await getCollectionVideos(collectionId, {
      page,
      size,
      sortBy,
      direction,
    });

    if (!pageData || !Array.isArray(pageData.content)) {
      throw new Error("Invalid paginated collection response.");
    }

    allVideos.push(...pageData.content);

    lastPage = pageData.last === true;

    if (!lastPage) {
      // Protect against malformed responses that could otherwise
      // cause an endless pagination loop.
      if (pageData.number !== page) {
        throw new Error("Unexpected collection pagination response.");
      }

      page += 1;
    }
  }

  return allVideos;
};

export async function getVideoMetadata(mediaItemId) {
  const response = await fetch(
    `${API_BASE_URL}/metadata?mediaItemId=${encodeURIComponent(mediaItemId)}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch video metadata");
  }

  return response.json();
}

export const syncCollection = async (collectionId) => {
  const response = await fetch(
    `${API_BASE_URL}/sync?collectionId=${encodeURIComponent(collectionId)}`,
    { method: "POST" },
  );

  if (!response.ok) {
    throw new Error("Failed to synchronise collection.");
  }
};

export const deleteCollection = async (collectionId) => {
  const response = await fetch(
    `${API_BASE_URL}/${encodeURIComponent(collectionId)}`,
    { method: "DELETE" },
  );

  if (!response.ok) {
    throw new Error("Failed to delete collection.");
  }
};

export const getPreviewProgress = async (previewPath) => {
  const response = await fetch(`${API_BASE_URL}/preview/preview-progress`);

  if (!response.ok) {
    throw new Error("Failed to fetch preview progress.");
  }

  return response.json();
};

export const getSyncStatus = async (collectionId) => {
  const response = await fetch(
    `${API_BASE_URL}/sync-status?collectionId=${encodeURIComponent(collectionId)}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch sync status.");
  }

  return response.json();
};
