import React, { createContext, useContext, useState, useEffect } from 'react';

const AccentContext = createContext();

export function useAccent() {
    return useContext(AccentContext);
}

export function AccentProvider({ children }) {
    const [preferredAccent, setPreferredAccent] = useState(() => {
        return localStorage.getItem('accent') || 'US';
    });

    useEffect(() => {
        localStorage.setItem('accent', preferredAccent);
    }, [preferredAccent]);

    return (
        <AccentContext.Provider value={{ preferredAccent, setPreferredAccent }}>
            {children}
        </AccentContext.Provider>
    );
}
