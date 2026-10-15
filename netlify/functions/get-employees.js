const { jsonResponse } = require('./supabase-client');
const { loadDirectory } = require('./lib/employee-store');

exports.handler = async () => {
  try {
    return jsonResponse({ success: true, ...(await loadDirectory()) });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
};
