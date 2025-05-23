'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const MAX_ADDITIONAL_MEMBERS = 3; 

export default function CreateTeamPage() {
    const [name, setName] = useState('');
    const [additionalMembers, setAdditionalMembers] = useState(Array(MAX_ADDITIONAL_MEMBERS).fill(''));
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const { authFetch, accessToken, loading: authLoading, user: currentUser } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !accessToken) {
            router.push('/login?message=You must be logged in to create a team.');
        }
    }, [authLoading, accessToken, router]);

    const handleMemberChange = (index, value) => {
        const newMembers = [...additionalMembers];
        newMembers[index] = value;
        setAdditionalMembers(newMembers);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        if (!name.trim()) {
            setError('Team name is required.');
            setIsSubmitting(false);
            return;
        }

        const memberUsernamesToSend = additionalMembers.map(m => m.trim()).filter(m => m !== '');
        

        if (memberUsernamesToSend.length > MAX_ADDITIONAL_MEMBERS) {
             setError(`You can specify up to ${MAX_ADDITIONAL_MEMBERS} additional members.`);
             setIsSubmitting(false);
             return;
        }


        try {
            const response = await authFetch('http://localhost:8000/api/tournament/teams/', {
                method: 'POST',
                body: { 
                    name: name,
                    member_usernames: memberUsernamesToSend,
                },
            });

            if (response.ok) {
                const newTeam = await response.json();
                router.push(`/teams/${newTeam.id}`); 
            } else {
                const errorData = await response.json();
                let errorMessage = 'Failed to create team.';
                 if (errorData) {
                    const messages = Object.entries(errorData).map(([key, value]) => {
                        let fieldName = key;
                        if (key === 'member_usernames' && Array.isArray(value) && value.some(v => typeof v === 'object')) {
                            return `${fieldName}: ${value.map(v => typeof v === 'object' ? Object.values(v).join(' ') : v).join('; ')}`;
                        }
                        if (Array.isArray(value)) {
                            return `${fieldName}: ${value.join(' ')}`;
                        }
                        return `${fieldName}: ${value}`;
                    }).join(' ');
                    if (messages) errorMessage = messages;
                }
                setError(errorMessage);
            }
        } catch (err) {
            setError('An error occurred while creating the team. Please try again.');
            console.error("Create team error:", err);
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
            <h1 className="text-2xl font-bold text-neutral-100 mb-2 text-center sm:text-left">Create a New Team</h1>
            <p className="text-neutral-300 mb-6 text-sm text-center sm:text-left">
                You will be the creator and an initial member. You can add up to {MAX_ADDITIONAL_MEMBERS} additional members by their username.
            </p>
            
            {error && <p className="text-red-400 mb-4 whitespace-pre-wrap text-center font-medium">{error}</p>}
            
            <form onSubmit={handleSubmit}>
                <div className="mb-5">
                    <label htmlFor="name" className="block mb-1.5 font-bold text-neutral-300">Team Name:</label>
                    <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full p-2.5 bg-neutral-700 border border-neutral-600 rounded-md text-base text-neutral-100 placeholder-neutral-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                <div className="mb-5">
                    <h3 className="text-lg font-semibold text-neutral-200 mb-3">Add Team Members (Optional)</h3>
                    {additionalMembers.map((memberUsername, index) => (
                        <div key={index} className="mb-3">
                            <label htmlFor={`member${index + 1}`} className="block mb-1 text-sm text-neutral-300">
                                Additional Member {index + 1} Username:
                            </label>
                            <input
                                type="text"
                                id={`member${index + 1}`}
                                value={memberUsername}
                                onChange={(e) => handleMemberChange(index, e.target.value)}
                                placeholder="Enter username"
                                className="w-full p-2.5 bg-neutral-700 border border-neutral-600 rounded-md text-base text-neutral-100 placeholder-neutral-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    ))}
                </div>
                
                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full sm:w-auto py-2.5 px-5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-base font-medium transition-colors duration-150 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Creating Team...' : 'Create Team'}
                </button>
            </form>
        </div>
    );
}