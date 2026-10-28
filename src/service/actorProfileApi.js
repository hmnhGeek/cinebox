const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

const PEOPLE_API = `${API_BASE_URL}/api/v1/people`;

async function handleResponse(response) {
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;

    try {
      const body = await response.json();
      message = body.message || body.error || body.detail || message;
    } catch {
      // The server may return an empty or non-JSON error response.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null;
}

function getPersonProfileUrl(personId) {
  if (
    personId === null ||
    personId === undefined ||
    String(personId).trim() === ""
  ) {
    throw new Error("A valid person ID is required.");
  }

  return `${PEOPLE_API}/${encodeURIComponent(String(personId))}/profile`;
}

function validateImageFile(file, fieldName) {
  if (!(file instanceof File)) {
    throw new Error(`Select a ${fieldName.toLowerCase()} image.`);
  }

  if (!file.type.startsWith("image/")) {
    throw new Error(`${fieldName} must be an image file.`);
  }

  if (file.size <= 0) {
    throw new Error(`${fieldName} cannot be empty.`);
  }
}

async function uploadImage(url, file, fieldName) {
  validateImageFile(file, fieldName);

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(url, {
    method: "PUT",
    body: formData,
  });

  return handleResponse(response);
}

export const actorProfileApi = {
  async getProfile(personId, options = {}) {
    const response = await fetch(getPersonProfileUrl(personId), {
      method: "GET",
      signal: options.signal,
      headers: {
        Accept: "application/json",
      },
    });

    return handleResponse(response);
  },

  async updateBiography(personId, biography) {
    if (typeof biography !== "string" || !biography.trim()) {
      throw new Error("Biography is required.");
    }

    const response = await fetch(getPersonProfileUrl(personId), {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        biography: biography.trim(),
      }),
    });

    return handleResponse(response);
  },

  async updateProfileImage(personId, file) {
    const url = `${getPersonProfileUrl(personId)}/image`;
    return uploadImage(url, file, "Profile portrait");
  },

  async updateHeroImage(personId, file) {
    const url = `${getPersonProfileUrl(personId)}/hero-image`;
    return uploadImage(url, file, "Hero image");
  },
};

export default actorProfileApi;
