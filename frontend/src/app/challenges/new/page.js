'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function NewChallengePage() {
    const [availableTeams, setAvailableTeams] = useState([]); 
    const [selectedOpponentTeamId, setSelectedOpponentTeamId] = useState('');
    const [message, setMessage] = useState('');
    
    const [loadingTeams, setLoadingTeams] = useState(true);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { authFetch, user: currentUser, accessToken, loading: authLoading } = useAuth();
    const router = useRouter();

    const fetchTeamsForSelection = useCallback(async () => {
        if (!accessToken) return; 
        setLoadingTeams(true);
        try {
            const response = await authFetch('http://localhost:8000/api/tournament/teams/');
            if (!response.ok) {
                throw new Error('Failed to fetch teams for opponent selection.');
            }
            const data = await response.json();
            const allTeams = data.results || data;

            const myTeamIds = currentUser?.teams?.map(t => t.id) || [];
            setAvailableTeams(allTeams.filter(team => !myTeamIds.includes(team.id))); 

        } catch (err) {
            setError('Could not load teams to challenge: ' + err.message);
        } finally {
            setLoadingTeams(false);
        }
    }, [authFetch, accessToken, currentUser]); 

    useEffect(() => {
        if (!authLoading && !accessToken) {
            router.push('/login?message=Please log in to issue a challenge.');
        } else if (accessToken) { 
            fetchTeamsForSelection();
        }
    }, [authLoading, accessToken, router, fetchTeamsForSelection]);

    const handleSubmitChallenge = async (e) => {
        e.preventDefault();
        if (!selectedOpponentTeamId) {
            setError('Please select an opponent team.');
            return;
        }
        setError('');
        setIsSubmitting(true);

        try {
            const response = await authFetch('http://localhost:8000/api/tournament/challenges/', {
                method: 'POST',
                body: {
                    challenged_team: selectedOpponentTeamId, 
                    message: message,
                },
            });

            if (response.ok) {
                alert('Challenge issued successfully!');
                router.push('/challenges'); 
            } else {
                const errorData = await response.json();
                let errorMessage = 'Failed to issue challenge.';
                if (errorData) {
                    const messages = Object.entries(errorData).map(([key, value]) => {
                        if (Array.isArray(value)) return `${key}: ${value.join(' ')}`;
                        return `${key}: ${value}`;
                    }).join('; ');
                    if (messages) errorMessage = messages;
                }
                setError(errorMessage);
            }
        } catch (err) {
            setError('An error occurred while issuing the challenge. Please try again.');
            console.error("Issue challenge error:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (authLoading || (!accessToken && !authLoading) ) { 
        return <div className='text-center p-5'>Loading...</div>;
    }
    
    return (
        <div className="max-w-xl mx-auto my-12 p-8 bg-neutral-800 border border-neutral-700 rounded-lg">
            <h1 className="text-center mb-8 text-3xl font-bold text-neutral-100">New Challenge</h1>
            
            {error && <p className="text-red-400 mb-4 text-center whitespace-pre-wrap font-medium">{error}</p>}
            
            <form onSubmit={handleSubmitChallenge}>
                <div className="mb-6">
                    <label htmlFor="opponentTeam" className="block mb-2 font-medium text-neutral-300">
                        Challenge Team:
                    </label>
                    {loadingTeams ? (
                        <p className="text-neutral-300 p-3 bg-neutral-700 border border-neutral-600 rounded-md">Loading available teams...</p>
                    ) : availableTeams.length > 0 ? (
                        <select
                            id="opponentTeam"
                            value={selectedOpponentTeamId}
                            onChange={(e) => setSelectedOpponentTeamId(e.target.value)}
                            required
                            className="w-full p-3 bg-neutral-700 border border-neutral-600 rounded-md text-base text-neutral-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="" className="text-neutral-400 bg-neutral-700">-- Select an Opponent Team --</option>
                            {availableTeams.map(team => (
                                <option key={team.id} value={team.id} className="bg-neutral-700 text-neutral-100">
                                    {team.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <p className="text-neutral-400 text-sm p-3 bg-neutral-700 border border-neutral-600 rounded-md">
                            No other teams available to challenge.
                        </p>
                    )}
                </div>

                <div className="mb-8">
                    <label htmlFor="message" className="block mb-2 font-medium text-neutral-300">
                        Message (Optional):
                    </label>
                    <textarea
                        id="message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows="4"
                        placeholder="Issue a friendly taunt or challenge details..."
                        className="w-full p-3 bg-neutral-700 border border-neutral-600 rounded-md text-base text-neutral-100 placeholder-neutral-400 resize-y focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                
                <div className="text-center">
                    <button 
                        type="submit" 
                        disabled={isSubmitting || loadingTeams || !selectedOpponentTeamId}
                        className="py-3 px-6 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-lg font-bold transition-colors duration-150 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Sending Challenge...' : 'Send Challenge'}
                    </button>
                </div>
            </form>
        </div>
    );
}