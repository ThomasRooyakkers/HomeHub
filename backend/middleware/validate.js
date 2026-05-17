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

module.exports = { validateInvoice };
