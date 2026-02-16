import { useEffect, useRef } from 'react';
import { AppWindow } from '../types';

export function useIinaMessages(
  handlers: Record<string, (data: any) => void>,
  uiType: string,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    const appWindow = window as unknown as AppWindow;
    const iina = appWindow.iina;

    if (iina?.onMessage) {
      for (const event of Object.keys(handlersRef.current)) {
        iina.onMessage(event, (data: any) => {
          handlersRef.current[event]?.(data);
        });
      }

      iina.postMessage?.('UI_READY', { uiType });

      // IINA onMessage does not provide an unsubscribe mechanism;
      // handlers are redirected via ref so stale closures are avoided.
      return () => {
        registeredRef.current = false;
      };
    } else {
      // Dev mode fallback: browser MessageEvent
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        let messageData = event.data;
        if (typeof messageData === 'string') {
          try {
            messageData = JSON.parse(messageData);
          } catch {
            return;
          }
        }
        if (!messageData || typeof messageData !== 'object') return;

        const handler = handlersRef.current[messageData.type];
        if (handler) {
          handler(messageData.data ?? {});
        }
      };
      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only: handlers accessed via ref
}
