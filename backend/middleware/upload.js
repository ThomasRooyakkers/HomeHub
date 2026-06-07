const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const { UPLOADS_DIR, UPLOAD_MAX_MB } = require("../config");

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const ZIP_MIME = ["application/zip", "application/x-zip-compressed", "application/octet-stream"];

const ALLOWED_EXT = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);

// Check magic bytes to verify the file content matches its declared type.
const checkMagicBytes = (buf) => {
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf";
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  return null;
};

const validateMagicBytes = (file) => {
  const buf = file.buffer
    ? file.buffer.slice(0, 12)
    : (() => { const fd = fs.openSync(file.path, "r"); const b = Buffer.alloc(12); fs.readSync(fd, b, 0, 12, 0); fs.closeSync(fd); return b; })();
  const detected = checkMagicBytes(buf);
  if (!detected) {
    if (file.path) fs.unlink(file.path, () => {});
    const err = new Error("File content does not match a supported type (PDF, JPEG, PNG, WEBP).");
    err.status = 415;
    throw err;
  }
};

const fileFilter = (_, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, JPEG, PNG, WEBP.`);
    err.status = 415;
    cb(err);
  }
};

const zipFileFilter = (_, file, cb) => {
  if (ZIP_MIME.includes(file.mimetype) || path.extname(file.originalname).toLowerCase() === ".zip") {
    cb(null, true);
  } else {
    const err = new Error(`Unsupported file type: ${file.mimetype}. Allowed: ZIP.`);
    err.status = 415;
    cb(err);
  }
};

const sanitizeFilename = (name) =>
  path.basename(name).replace(/[^\w.\-]/g, "_").slice(0, 200);

const diskStorage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_, file, cb) => {
    const raw = path.extname(file.originalname).toLowerCase();
    const ext = ALLOWED_EXT.has(raw) ? raw : "";
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

const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(UPLOAD_MAX_MB, 50) * 1024 * 1024 },
  fileFilter: zipFileFilter,
});

module.exports = { diskUpload, memUpload, zipUpload, sanitizeFilename, validateMagicBytes };
