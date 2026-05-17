const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

const validateInvoice = (body) => {
  if (!body.vendor || !String(body.vendor).trim()) throw bad("vendor is required");
  if (body.amount === undefined || body.amount === "" || isNaN(parseFloat(body.amount))) {
    throw bad("amount must be a number");
  }
  if (body.dueDate && !ISO_DATE.test(body.dueDate)) {
    throw bad("dueDate must be in YYYY-MM-DD format");
  }
};

const VALID_FREQUENCIES = ["daily", "weekly", "biweekly", "monthly", "quarterly"];

const validatePlant = (body) => {
  if (!body.name || !String(body.name).trim()) throw bad("name is required");
  if (body.wateringFrequency && !VALID_FREQUENCIES.includes(body.wateringFrequency))
    throw bad(`wateringFrequency must be one of: ${VALID_FREQUENCIES.join(", ")}`);
  if (body.feedingFrequency && !VALID_FREQUENCIES.includes(body.feedingFrequency))
    throw bad(`feedingFrequency must be one of: ${VALID_FREQUENCIES.join(", ")}`);
};

const validateRecipe = (body) => {
  if (!body.name || !String(body.name).trim()) throw bad("name is required");
};

const validateMaintenanceTask = (body) => {
  if (!body.title || !String(body.title).trim()) throw bad("title is required");
  if (body.nextDue && !ISO_DATE.test(body.nextDue)) throw bad("nextDue must be in YYYY-MM-DD format");
};

module.exports = { validateInvoice, validatePlant, validateRecipe, validateMaintenanceTask };
