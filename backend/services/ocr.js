const { createWorker } = require("tesseract.js");

let workerPromise = null;

const getWorker = () => {
  if (!workerPromise) {
    workerPromise = createWorker("eng").catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
};

const extractFromImage = async (buffer) => {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);

  const words = data.words
    .filter((w) => w.text.trim().length > 0 && w.confidence > 20)
    .map((w) => ({
      text: w.text.trim(),
      x0: w.bbox.x0,
      y0: w.bbox.y0,
      x1: w.bbox.x1,
      y1: w.bbox.y1,
    }));

  return { words, width: data.imageWidth, height: data.imageHeight };
};

const extract = async (buffer, mimetype) => {
  if (mimetype === "application/pdf") return { isPdf: true };
  return extractFromImage(buffer);
};

module.exports = { extract };
