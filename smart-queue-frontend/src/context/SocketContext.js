import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getSocketUrl } from '../utils/api';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { token } = useAuth();
  const sockRef = useRef(null);
  const cbsRef = useRef({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const loadScript = () => new Promise((resolve) => {
      if (window.io) return resolve();
      const s = document.createElement("script");
      s.src = "https://cdn.socket.io/4.6.1/socket.io.min.js";
      s.onload = resolve;
      document.head.appendChild(s);
    });

    loadScript().then(async () => {
      const socketUrl = await getSocketUrl();
      const sock = window.io(socketUrl, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnectionAttempts: 8,
        reconnectionDelay: 1500,
      });

      sock.on("connect", () => setConnected(true));
      sock.on("disconnect", () => setConnected(false));
      sock.on("connect_error", () => setConnected(false));

      Object.entries(cbsRef.current).forEach(([ev, fn]) => sock.on(ev, fn));
      sockRef.current = sock;
    });

    return () => { sockRef.current?.disconnect(); sockRef.current = null; };
  }, [token]);

  const on = useCallback((event, fn) => {
    cbsRef.current[event] = fn;
    sockRef.current?.on(event, fn);
    return () => {
      delete cbsRef.current[event];
      sockRef.current?.off(event, fn);
    };
  }, []);

  const joinRoom = useCallback((qId) => {
    sockRef.current?.emit("joinQueue", { queueId: qId });
  }, []);

  const emit = useCallback((event, data) => {
    sockRef.current?.emit(event, data);
  }, []);

  return (
    <SocketContext.Provider value={{ connected, on, joinRoom, emit }}>
      {children}
    </SocketContext.Provider>
  );
};
