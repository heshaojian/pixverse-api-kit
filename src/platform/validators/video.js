import {
  isPresent,
  requireExactlyOneField,
  requireField,
  requireFields,
  validateModelScalars,
  validationError,
} from "./common.js";
import { validateImageSource } from "./media.js";

const IMAGE_REFERENCE_FIELDS = ["img_id", "image_id", "image_url", "img_url"];
const VIDEO_REFERENCE_FIELDS = ["video_id", "video_url"];

export function validateVideoOperation(operation, payload) {
  switch (operation.id) {
    case "video.text":
      validateModelScalars(operation, payload);
      requireFields(operation, payload, ["aspect_ratio", "duration", "model", "prompt", "quality"]);
      break;
    case "video.image":
      validateModelScalars(operation, payload);
      requireFields(operation, payload, ["duration", "img_id", "model", "prompt", "quality"]);
      break;
    case "video.template":
      validateModelScalars(operation, payload, { promptMaxLength: 2048 });
      requireFields(operation, payload, ["duration", "model", "prompt", "quality"]);
      if (!isPresent(payload.img_id) && (!Array.isArray(payload.img_ids) || payload.img_ids.length === 0)) {
        throw validationError(operation, "img_id or img_ids image source is required.");
      }
      break;
    case "video.transition":
      validateModelScalars(operation, payload);
      requireFields(operation, payload, ["prompt", "model", "duration", "quality"]);
      validateTransition(operation, payload);
      break;
    case "video.multi-transition":
      validateMultiTransition(operation, payload);
      break;
    case "video.lip-sync":
      validateLipSync(operation, payload);
      break;
    case "video.fusion":
      validateFusion(operation, payload);
      break;
    case "video.avatar":
      validateModelScalars(operation, payload);
      requireFields(operation, payload, ["img_id", "quality"]);
      validateAudioOrTts(operation, payload, true);
      break;
    default:
      throw validationError(operation, `No video validator exists for ${operation.id}.`);
  }
}

function validateTransition(operation, payload) {
  requireField(operation, payload, ["first_frame_img", "first_frame_img_id", "first_frame_image_id", "first_frame_url"], "first frame");
  requireField(operation, payload, ["last_frame_img", "last_frame_img_id", "last_frame_image_id", "last_frame_url"], "last frame");
}

function validateMultiTransition(operation, payload) {
  requireFields(operation, payload, ["model", "quality"]);
  if (!["v3.5", "v4", "v4.5", "v5"].includes(payload.model)) {
    throw validationError(operation, "multi-transition model must be v3.5, v4, v4.5, or v5.");
  }
  validateModelScalars(operation, payload);
  const items = payload.multi_transition;
  if (!Array.isArray(items) || items.length < 2 || items.length > 7) {
    throw validationError(operation, "multi-transition must contain between 2 and 7 ordered items.");
  }
  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw validationError(operation, `multi-transition item ${index + 1} must be an object.`);
    }
    requireField(operation, item, ["img_id"], `multi-transition item ${index + 1} img_id`);
    if (index < items.length - 1 && !isPresent(item.duration)) {
      throw validationError(operation, "duration is required for every multi-transition item except the last item.");
    }
    if (isPresent(item.duration) && (!Number.isInteger(item.duration) || item.duration <= 0)) {
      throw validationError(operation, "multi-transition item duration must be a positive integer.");
    }
  });
}

function validateLipSync(operation, payload) {
  requireExactlyOneField(operation, payload, ["source_video_id", "video_media_id"]);
  validateAudioOrTts(operation, payload, true);
}

function validateAudioOrTts(operation, payload, required) {
  const audio = isPresent(payload.audio_media_id);
  const hasSpeaker = isPresent(payload.lip_sync_tts_speaker_id);
  const hasContent = isPresent(payload.lip_sync_tts_content);
  const tts = hasSpeaker && hasContent;
  if (hasSpeaker !== hasContent) {
    throw validationError(operation, "lip-sync TTS requires both lip_sync_tts_speaker_id and lip_sync_tts_content.");
  }
  if ((required && !audio && !tts) || (audio && tts)) {
    throw validationError(operation, "Provide either audio_media_id or the TTS speaker/content pair, but not both.");
  }
}

function validateFusion(operation, payload) {
  const omniVideo = payload.model === "v6" && payload.reference_mode === "omni"
    && Array.isArray(payload.video_references) && payload.video_references.length > 0;
  const scalarPayload = omniVideo && payload.duration === 0 ? { ...payload } : payload;
  if (scalarPayload !== payload) delete scalarPayload.duration;
  validateModelScalars(operation, scalarPayload);
  requireFields(operation, payload, ["image_references", "prompt", "model", "duration", "quality", "aspect_ratio"]);
  if (!["v4.5", "v5", "v5.5", "v5.6", "v6", "c1"].includes(payload.model)) {
    throw validationError(operation, "fusion model must be v4.5, v5, v5.5, v5.6, v6, or c1.");
  }
  const references = payload.image_references;
  if (!Array.isArray(references) || references.length === 0) {
    throw validationError(operation, "fusion requires one or more image references.");
  }
  const maximum = payload.model === "v6" && payload.reference_mode === "omni" ? 10
    : ["v5.5", "v5.6", "v6", "c1"].includes(payload.model) ? 7 : 3;
  if (references.length > maximum) throw validationError(operation, `fusion accepts at most ${maximum} image references for this model.`);
  if (omniVideo && payload.duration !== 0) {
    throw validationError(operation, "fusion duration must be 0 for v6 omni mode with video references.");
  }
}
