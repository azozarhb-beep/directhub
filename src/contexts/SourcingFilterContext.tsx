'use client';

import React, { createContext, useContext, useState } from 'react';

export type SourcingTab = 'local_manufacturers' | 'local_suppliers' | 'global_manufacturers';

interface SourcingFilterContextValue {
  activeTab: SourcingTab;
  setActiveTab: (tab: SourcingTab) => void;
}

const SourcingFilterContext = createContext<SourcingFilterContextValue>({
  activeTab: 'local_manufacturers',
  setActiveTab: () => {},
});

export const SourcingFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<SourcingTab>('local_manufacturers');

  return (
    <SourcingFilterContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </SourcingFilterContext.Provider>
  );
};

export const useSourcingFilter = () => useContext(SourcingFilterContext);
