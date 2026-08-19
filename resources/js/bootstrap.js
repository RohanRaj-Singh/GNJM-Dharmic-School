import axios from "axios";
window.axios = axios;

window.axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";

/*
 * CSRF / auth flow:
 *  - Laravel's session cookie includes an XSRF-TOKEN. Axios
 *    automatically reads it and sends it as the X-XSRF-TOKEN header
 *    on every request. This is the only CSRF mechanism on the
 *    frontend — do not add manual token reads or hidden forms.
 *  - 401 and 419 responses are propagated to per-page handlers.
 *    Pages that POST through axios (Reports/Index, Reports/Attendance,
 *    StudentReportCenter/Index) already have a 419 → toast → refresh
 *    flow. Pages that POST through Inertia's router handle 419 via
 *    Inertia's response handlers. Do not add a global interceptor
 *    that auto-redirects to /login — it short-circuits the per-page
 *    recovery flows and turns transient 419s into "Admin actions
 *    failing while saving" symptoms.
 */
