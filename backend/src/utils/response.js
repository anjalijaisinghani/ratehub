// One place that builds successful responses:
// { "success": true, "message": "...", "data": ... }
const sendSuccess = (res, data = null, message = undefined, status = 200) => {
  const body = { success: true };
  if (message) body.message = message;
  if (data !== null) body.data = data;
  return res.status(status).json(body);
};

module.exports = { sendSuccess };