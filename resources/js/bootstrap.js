import axios from 'axios';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

const redirectToLogin = () => {
    if (window.location.pathname !== '/login') {
        window.location.assign('/login');
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
    },
);

const nativeFetch = window.fetch.bind(window);

window.fetch = async (...args) => {
    const response = await nativeFetch(...args);

    if (response.status === 401 || response.status === 419) {
        redirectToLogin();
    }

    return response;
};
