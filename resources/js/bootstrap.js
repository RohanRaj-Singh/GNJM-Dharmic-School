import axios from "axios";
window.axios = axios;

window.axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";

/*
 * CSRF / auth flow:
 *  - Laravel's session cookie includes an XSRF-TOKEN. Axios
 *    automatically reads it and sends it as the X-XSRF-TOKEN header
 *    on every request. This is the ONLY way CSRF tokens are wired
 *    on the frontend. No manual token reads, no hidden forms.
 *  - On 401 (unauthenticated) or 419 (CSRF mismatch / session expired)
 *    we redirect to /login.
 *  - Page-local handlers (Fee Report, Attendance Report, Student Center)
 *    catch 419 separately and show a friendly toast with a refresh button.
 */

const redirectToLogin = () => {
    if (window.location.pathname !== "/login") {
        window.location.assign("/login");
    }
};

window.axios.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        if (status === 401 || status === 419) {
            redirectToLogin();
        }
        return Promise.reject(error);
    }
);
