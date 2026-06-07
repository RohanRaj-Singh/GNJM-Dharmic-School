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
 *    we redirect to /login. This applies to any axios call anywhere
 *    in the app, including Inertia's router.{get,post,put,delete}.
 *  - We do NOT monkey-patch window.fetch. If a non-Inertia page uses
 *    fetch() it is responsible for handling auth errors itself; we
 *    never want a global side-effect on every fetch call.
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
