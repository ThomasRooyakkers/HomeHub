export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error?.message) message = body.error.message;
    } catch {}
    throw new ApiError(response.status, message);
  }
  return response.json();
};
