import { useEffect, useRef } from 'react';

export function useWindowMessage(
  messageType: string,
  handler: (data: any) => void,
  isActive: boolean = true,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!isActive) return;

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

      if (messageData.type === messageType) {
        handlerRef.current(messageData.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [messageType, isActive]);
}
