'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
    const [ username, setUsername ] = useState('');
    const [ password, setPassword ] = useState('');
    const [ error, setError ] = useState('');
    const router = useRouter();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        try {
            const res = await fetch('http://localhost:8000/api/token/', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username, 
                    password,
                }),
            });

            if (res.ok) {
                const data = await res.json();

                login(data.access, data.refresh)

                router.push('/'); 
            } else {
                const errorData = await res.json();
                let errorMessage = 'Login failed.';
                if (errorData && errorData.detail) {
                    errorMessage = errorData.detail;
                } else if (errorData) {
                    const messages = Object.values(errorData).flat().join(' ');
                    if (messages) errorMessage = messages;
                }
                setError(errorMessage);
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
            console.error('Login error:', err);
        }
    }

    return (
         <div className="max-w-sm mx-auto my-12 p-6 bg-neutral-800 border border-neutral-700 rounded-lg">
            <h1 className="text-2xl font-bold text-neutral-100 mb-6 text-center">Login</h1>
            
            {error && <p className="text-red-400 mb-4 text-center font-medium">{error}</p>}
            
            <form onSubmit={handleSubmit}>
                <div className="mb-4">
                    <label htmlFor="username" className="block mb-1.5 text-sm font-medium text-neutral-300">Username:</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="w-full p-2 bg-neutral-700 border border-neutral-600 rounded-md text-base text-neutral-100 placeholder-neutral-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                <div className="mb-6"> 
                    <label htmlFor="password" className="block mb-1.5 text-sm font-medium text-neutral-300">Password:</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full p-2 bg-neutral-700 border border-neutral-600 rounded-md text-base text-neutral-100 placeholder-neutral-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                <button 
                    type="submit" 
                    className="w-full py-2.5 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-base font-medium transition-colors duration-150 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed"
                >
                    Login
                </button>
            </form>
        </div>
    );
}