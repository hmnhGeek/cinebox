const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")}/api/v1/collections`;

export const createCollection = async ({ title, folder, tagline }) => {
  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, folder, tagline }),
  });

  if (!response.ok) {
    let message = "Failed to create collection.";

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

export const getCollectionVideos = async (collectionId) => {
  const response = await fetch(
    `${API_BASE_URL}/${encodeURIComponent(collectionId)}/videos`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch collection videos.");
  }

  return response.json();
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
    {
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to synchronise collection.");
  }
};

export const deleteCollection = async (collectionId) => {
  const response = await fetch(
    `${API_BASE_URL}/${encodeURIComponent(collectionId)}`,
    {
      method: "DELETE",
    },
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
