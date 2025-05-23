'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function SubmitBotPage() {
    const params = useParams();
    const teamId = params.teamId; 
    const router = useRouter();


    const [codeFile, setCodeFile] = useState(null);
    const [makeActive, setMakeActive] = useState(false); 
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { authFetch, accessToken, loading: authLoading, user } = useAuth();


    useEffect(() => {
        if (!authLoading && !accessToken) {
            router.push(`/login?message=You must be logged in to submit a bot.&next=/teams/${teamId}/submit-bot`);
        }
    }, [authLoading, accessToken, router, teamId]);


    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.name.endsWith('.py')) {
                setError('Invalid file type. Only .py files are allowed.');
                setCodeFile(null);
                e.target.value = null; 
                return;
            }
            if (file.size > 1 * 1024 * 1024) { 
                setError('File size exceeds 1MB limit.');
                setCodeFile(null);
                e.target.value = null;
                return;
            }
            setError(''); 
            setCodeFile(file);
        } else {
            setCodeFile(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!codeFile) {
            setError('Please select a bot script file to upload.');
            return;
        }
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('code_file', codeFile);
        formData.append('is_active', makeActive);

        try {
            const response = await authFetch(`http://localhost:8000/api/tournament/teams/${teamId}/submissions/`, {
                method: 'POST',
                body: formData, 
            });

            if (response.ok) {
                alert('Bot submitted successfully!');
                router.push(`/teams/${teamId}`); 
            } else {
                const errorData = await response.json();
                let errorMessage = 'Failed to submit bot.';
                if (errorData) {
                    const messages = Object.entries(errorData).map(([key, value]) => {
                         if (key === 'code_file' && Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
                            return `${key}: ${value.join(' ')}`;
                        }
                        if (Array.isArray(value)) {
                            return `${key}: ${value.join(' ')}`;
                        }
                        return `${key}: ${value}`;
                    }).join('; ');
                    if (messages) errorMessage = messages;
                }
                setError(errorMessage);
            }
        } catch (err) {
            setError('An error occurred during submission. Please try again.');
            console.error("Submit bot error:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (authLoading) {
        return <div className='p-5'>Loading authentication state...</div>;
    }

    if (!accessToken) {
        return <div className='p-5'>Redirecting to login...</div>;
    }
    
    return (
        <div className="max-w-xl mx-auto my-12 p-6 bg-neutral-800 border border-neutral-700 rounded-lg">
            <h1 className="text-2xl font-bold text-neutral-100 mb-2 text-center sm:text-left">Submit New Bot</h1> 
            <p className="text-neutral-300 mb-6 text-center sm:text-left">Your team ID: {teamId}</p>
            
            {error && <p className="text-red-400 mb-4 whitespace-pre-wrap text-center font-medium">{error}</p>}
            
            <form onSubmit={handleSubmit}>
                <div className="mb-5">
                    <label htmlFor="codeFile" className="block mb-1.5 font-bold text-neutral-300">Bot Script (.py file):</label>
                    <input
                        type="file"
                        id="codeFile"
                        onChange={handleFileChange}
                        accept=".py" 
                        required
                        className="block w-full text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-neutral-700 file:text-neutral-100 hover:file:bg-neutral-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-800"
                    />
                </div>

                <div className="mb-6">
                    <label htmlFor="makeActive" className="flex items-center text-neutral-300 cursor-pointer">
                        <input
                            type="checkbox"
                            id="makeActive"
                            checked={makeActive}
                            onChange={(e) => setMakeActive(e.target.checked)}
                            className="mr-2.5 h-4 w-4 rounded border-neutral-600 bg-neutral-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-neutral-800"
                        />
                        Set as active
                    </label>
                </div>
                
                <button 
                    type="submit" 
                    disabled={isSubmitting || !codeFile}
                    className="w-full py-2.5 px-5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-base font-medium transition-colors duration-150 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Bot'}
                </button>
            </form>

            <div className="mt-6 text-center">
                <Link href={`/teams/${teamId}`} className="text-blue-400 hover:text-blue-300 hover:underline">
                    &larr; Back to Team Details
                </Link>
            </div>
        </div>
    );
}