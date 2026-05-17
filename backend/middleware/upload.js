const multer = require("multer");
const path = require("path");
const { randomUUID } = require("crypto");
const { UPLOADS_DIR, UPLOAD_MAX_MB } = require("../config");

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const fileFilter = (_, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, JPEG, PNG, WEBP.`);
    err.status = 415;
    cb(err);
  }
};

const sanitizeFilename = (name) =>
  path.basename(name).replace(/[^\w.\-]/g, "_").slice(0, 200);

const diskStorage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || "";
    cb(null, `${randomUUID()}${ext}`);
  },
});

// Saves to disk — used for invoice attachments
const diskUpload = multer({
  storage: diskStorage,
  limits: { fileSize: UPLOAD_MAX_MB * 1024 * 1024 },
  fileFilter,
});

// Keeps file in memory — used for OCR (no disk write)
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_MB * 1024 * 1024 },
  fileFilter,
});

module.exports = { diskUpload, memUpload, sanitizeFilename };
