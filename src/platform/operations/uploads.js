export const UPLOAD_OPERATIONS = [
  {
    id: "upload.image",
    command: ["upload", "image"],
    method: "POST",
    path: "/openapi/v2/image/upload",
    bodyMode: "multipart",
    validationPolicy: "upload.image",
    billing: "non-billable",
    asynchronous: false,
    resultIdPath: "Resp.img_id",
  },
  {
    id: "upload.media",
    command: ["upload", "media"],
    method: "POST",
    path: "/openapi/v2/media/upload",
    bodyMode: "multipart",
    validationPolicy: "upload.media",
    billing: "non-billable",
    asynchronous: false,
    resultIdPath: "Resp.media_id",
  },
];
