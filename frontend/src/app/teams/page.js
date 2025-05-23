'use client'; 

import { useState, useEffect } from 'react';
import Link from 'next/link'; 

export default function TeamsListPage() {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTeams = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch('http://localhost:8000/api/tournament/teams/');
                
                if (!response.ok) {
                    let errorMsg = `Failed to fetch teams. Status: ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.detail || JSON.stringify(errorData) || errorMsg;
                    } catch (e) {
                        throw new Error(e)
                    }
                    throw new Error(errorMsg);
                }
                const data = await response.json();
                setTeams(data);
            } catch (err) {
                setError(err.message);
                console.error("Fetch teams error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchTeams();
    }, []);

    if (loading) {
        return <div className='p-5'>Loading teams...</div>;
    }

    if (error) {
        return <div className='p-5 text-red-500'>Error fetching teams: {error}</div>;
    }

    return (
        <div className="p-5"> 
            <h1 className="text-3xl font-bold mb-6 text-white"> 
                All Teams
            </h1>
            
            {teams.length === 0 ? (
                <p className="text-neutral-300"> 
                    No teams found.
                </p>
            ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 list-none p-0">
                    {teams.map((team) => (
                        <li 
                            key={team.id} 
                            className="p-4 bg-neutral-800 border border-neutral-700 rounded-md"
                        >
                            <h2 className="text-xl font-semibold mb-1 text-neutral-100">
                                <Link 
                                    href={`/teams/${team.id}`} 
                                    className="text-blue-400 hover:text-blue-300 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                                >
                                    {team.name}
                                </Link>
                            </h2>
                            <p className="text-sm text-neutral-400">
                                Created by: {typeof team.creator === 'string' ? team.creator : team.creator?.username || 'N/A'}
                                <br />
                                Members: {team.members_details.join(', ')} 
                                <br />
                                Created on: {new Date(team.created_at).toLocaleDateString()}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}