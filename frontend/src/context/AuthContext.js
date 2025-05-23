'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation'; 

const AuthContext = createContext(null);

let tokenRefreshPromise = null; 

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [refreshToken, setRefreshToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const logout = useCallback((shouldRedirect = true) => {
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        tokenRefreshPromise = null;
        if (shouldRedirect) {
            router.push('/login');
        }
    }, [router]);

    const performTokenRefresh = useCallback(async () => {
        if (!refreshToken) {
            logout();
            throw new Error("No refresh token");
        }

        try {
            const res = await fetch('http://localhost:8000/api/token/refresh/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh: refreshToken }),
            });

            const data = await res.json();

            if (res.ok) {
                const newAccessToken = data.access;
                setAccessToken(newAccessToken);
                localStorage.setItem('accessToken', newAccessToken);
                return newAccessToken; 
            } else {
                logout(); 
                throw new Error(data.detail || "Failed to refresh token");
            }
        } catch (error) {
            logout();
            throw error;
        }
    }, [refreshToken, logout]);

    const authFetch = useCallback(async (url, options = {}) => {
        let currentToken = accessToken; 

        if (!currentToken) {
            currentToken = localStorage.getItem('accessToken');
        }
        
        const makeRequest = async (token) => {
            const requestOptions = {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${token}`,
                },
            };
            if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
                requestOptions.headers['Content-Type'] = 'application/json';
                requestOptions.body = JSON.stringify(options.body);
            }
            return fetch(url, requestOptions);
        };

        if (!currentToken) {
            return fetch(url, options); 
        }

        let response = await makeRequest(currentToken);

        if (response.status === 401) {
            if (!tokenRefreshPromise) { 
                tokenRefreshPromise = performTokenRefresh().catch(err => {
                    tokenRefreshPromise = null;
                    throw err; 
                });
            }

            try {
                const newAccessToken = await tokenRefreshPromise;
                tokenRefreshPromise = null; 
                response = await makeRequest(newAccessToken); 
            } catch (refreshError) {
                throw refreshError; 
            }
        }
        return response;
    }, [accessToken, refreshToken, performTokenRefresh, logout]);


    const fetchUserDetails = useCallback(async () => {
        const currentAccessToken = localStorage.getItem('accessToken');
        if (!currentAccessToken) {
            setUser(null);
            setLoading(false);
            return;
        }
    
        setLoading(true);
        try {
            const res = await authFetch('http://localhost:8000/api/accounts/me/');
            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
            } else {
                if (res.status !== 401) { 
                    setUser(null); 
                }
                console.error("fetchUserDetails: API call failed with status:", res.status);
            }
        } catch (error) {
            console.error("Error in fetchUserDetails (likely from authFetch):", error);
        } finally {
            setLoading(false);
        }
    }, [authFetch]); 

    useEffect(() => {
        const storedAccessToken = localStorage.getItem('accessToken');
        const storedRefreshToken = localStorage.getItem('refreshToken');

        if (storedAccessToken) {
            setAccessToken(storedAccessToken);
            if (storedRefreshToken) {
                setRefreshToken(storedRefreshToken);
            }
        } else {
            setLoading(false); 
        }
    }, []); 

    useEffect(() => {
        if (accessToken && !user && loading) { 
             fetchUserDetails();
        } else if (!accessToken && !loading) { 
            setUser(null);
        }
    }, [accessToken, user, loading, fetchUserDetails]);


    const login = useCallback(async (newAccessToken, newRefreshToken) => {
        setAccessToken(newAccessToken);
        setRefreshToken(newRefreshToken);
        localStorage.setItem('accessToken', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        await fetchUserDetails(); 
    }, [fetchUserDetails]);


    return (
        <AuthContext.Provider value={{ user, accessToken, loading, login, logout, authFetch, refreshToken /* expose for debugging if needed */ }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === null) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};