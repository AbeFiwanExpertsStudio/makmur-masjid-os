"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

interface GuestContextType {
  uuid: string | null;
  isLoading: boolean;
}

const GuestContext = createContext<GuestContextType>({ uuid: null, isLoading: true });

export const useGuest = () => useContext(GuestContext);

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const [uuid, setUuid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for UUID
    let storedUuid = localStorage.getItem("makmur_guest_uuid");
    
    if (!storedUuid) {
      storedUuid = uuidv4();
      localStorage.setItem("makmur_guest_uuid", storedUuid);
    }
    
    setUuid(storedUuid);
    setIsLoading(false);
  }, []);

  return (
    <GuestContext.Provider value={{ uuid, isLoading }}>
      {children}
    </GuestContext.Provider>
  );
}
