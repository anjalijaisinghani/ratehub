// One place that builds successful responses:
// { "success": true, "message": "...", "data": ... }
const sendSuccess = (res, data = null, message = undefined, status = 200) => {
  const body = { success: true };
  if (message) body.message = message;
  if (data !== null) body.data = data;
  return res.status(status).json(body);
};

// Lists: { "success": true, "data": [...], "pagination": { page, limit, total, totalPages } }
const sendPaginated = (res, items, pagination) =>
  res.status(200).json({ success: true, data: items, pagination });

module.exports = { sendSuccess, sendPaginated };