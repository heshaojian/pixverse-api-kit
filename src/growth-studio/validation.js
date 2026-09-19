export function validateCreatePayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Create payload must be an object.");
  if (payload.folder_id !== undefined) assertFolderId(payload.folder_id);
  if (!payload.product || typeof payload.product !== "object") throw new Error("Create payload requires product.");
  if (!payload.video || typeof payload.video !== "object") throw new Error("Create payload requires video.");

  if (!payload.product.source_url && !Array.isArray(payload.product.images)) {
    throw new Error("Create payload requires product.source_url or product.images from the upload endpoint.");
  }

  for (const image of payload.product.images || []) {
    if (!image.url || !image.url.startsWith("https://media.pixverse.ai/")) {
      throw new Error("Product images must use URLs returned by the image upload endpoint.");
    }
  }
}

export function validateEditPayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Edit payload must be an object.");
  if (!Number.isInteger(payload.clip_index) || payload.clip_index < 1) {
    throw new Error("clip_index must be a one-based positive integer.");
  }
  if (!payload.instruction || typeof payload.instruction !== "string") {
    throw new Error("instruction is required.");
  }
}

export function validateFolderPayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Folder payload must be an object.");
  if (!payload.name || typeof payload.name !== "string" || !payload.name.trim()) {
    throw new Error("Folder payload requires a non-empty name.");
  }
}

export function assertVideoId(videoId) {
  if (typeof videoId !== "string" || !/^\d+$/.test(videoId)) {
    throw new Error("video_id must be a numeric string.");
  }
}

export function assertFolderId(folderId) {
  if (typeof folderId !== "string" || !/^\d+$/.test(folderId)) {
    throw new Error("folder_id must be a numeric string.");
  }
}
