const API_BASE_URL = "http://localhost:8080/api/v1/videos";

export async function getAllVideos() {
  const response = await fetch(API_BASE_URL);

  if (!response.ok) {
    throw new Error("Failed to fetch videos");
  }

  return response.json();
}

export function getThumbnailUrl(videoId) {
  return `${API_BASE_URL}/${videoId}/thumbnail`;
}

export function getPreviewUrl(videoId) {
  return `${API_BASE_URL}/${videoId}/preview`;
}

export function getPosterUrl(videoId) {
  return `${API_BASE_URL}/${videoId}/poster`;
}

export async function uploadVideo({
  file,
  poster,
  thumbnail,
  title,
  description,
}) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("poster", poster);
  formData.append("thumbnail", thumbnail);
  formData.append("title", title);
  formData.append("description", description);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload video");
  }

  return response.json();
}

export async function getVideo(id) {
  const response = await fetch(`${API_BASE_URL}/${id}`);

  if (!response.ok) {
    throw new Error("Failed to fetch video");
  }

  return response.json();
}
