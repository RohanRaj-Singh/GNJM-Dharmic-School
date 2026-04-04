import { useEffect, useRef } from 'react';

const HIDDEN_TAB_TIMEOUT_MS = 60_000 * 10;

export default function TabSessionTimeout() {
    const timeoutIdRef = useRef(null);
    const hiddenSinceRef = useRef(null);
    const isLoggingOutRef = useRef(false);

    useEffect(() => {
        const clearHiddenTimer = () => {
            if (timeoutIdRef.current) {
                window.clearTimeout(timeoutIdRef.current);
                timeoutIdRef.current = null;
            }
        };

        const logoutForHiddenTabTimeout = async () => {
            if (isLoggingOutRef.current) {
                return;
            }

            isLoggingOutRef.current = true;

            const hiddenForMs = hiddenSinceRef.current
                ? Date.now() - hiddenSinceRef.current
                : HIDDEN_TAB_TIMEOUT_MS;

            console.warn('[TabSessionTimeout] Hidden-tab timeout reached', {
                hiddenForMs,
                timeoutMs: HIDDEN_TAB_TIMEOUT_MS,
            });

            try {
                await window.axios.post('/logout');
                console.log('[TabSessionTimeout] Logout request completed');
            } catch (error) {
                console.error('[TabSessionTimeout] Logout request failed', error);
            } finally {
                window.location.assign('/login');
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                hiddenSinceRef.current = Date.now();

                console.log('[TabSessionTimeout] Tab hidden, starting timeout', {
                    timeoutMs: HIDDEN_TAB_TIMEOUT_MS,
                    hiddenAt: new Date(hiddenSinceRef.current).toISOString(),
                });

                clearHiddenTimer();
                timeoutIdRef.current = window.setTimeout(
                    logoutForHiddenTabTimeout,
                    HIDDEN_TAB_TIMEOUT_MS,
                );

                return;
            }

            const hiddenForMs = hiddenSinceRef.current
                ? Date.now() - hiddenSinceRef.current
                : 0;

            console.log('[TabSessionTimeout] Tab visible, clearing timeout', {
                hiddenForMs,
            });

            hiddenSinceRef.current = null;
            clearHiddenTimer();
        };

        console.log('[TabSessionTimeout] Monitoring hidden tab timeout', {
            timeoutMs: HIDDEN_TAB_TIMEOUT_MS,
        });

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
            clearHiddenTimer();
        };
    }, []);

    return null;
}
