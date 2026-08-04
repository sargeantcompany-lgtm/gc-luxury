import React, { createContext, useContext, useEffect, useState } from 'react';
import { connectorApi } from '../services/api';

const BuyerContext = createContext(null);

export function BuyerProvider({ children }) {
  const [buyer, setBuyer] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { buyer } = await connectorApi.me();
      setBuyer(buyer);
    } catch {
      setBuyer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <BuyerContext.Provider value={{ buyer, setBuyer, loading, refresh }}>
      {children}
    </BuyerContext.Provider>
  );
}

export function useBuyer() {
  return useContext(BuyerContext);
}
