'use client'; 

import { useState, useEffect } from 'react';
import Link from 'next/link'; 

export default function LeaderboardPage() {
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch('http://localhost:8000/api/tournament/leaderboard/');
                if (!response.ok) {
                    let errorMsg = `Failed to fetch leaderboard. Status: ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.detail || JSON.stringify(errorData) || errorMsg;
                    } catch (e) { 
                        throw new Error(e)
                    }
                    throw new Error(errorMsg);
                }
                const data = await response.json();
                setLeaderboardData(data.results || data); 
            } catch (err) {
                setError(err.message);
                console.error("Fetch leaderboard error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []); 

    if (loading) {
        return <div className='p-5 text-center'>Loading leaderboard...</div>;
    }

    if (error) {
        return <div className='p-5 text-center text-red-500'>Error fetching leaderboard: {error}</div>;
    }

    return (
        <div className="p-5 max-w-4xl mx-auto">
            <h1 className="text-center text-3xl font-bold mb-8 text-white">Leaderboard</h1>
            {leaderboardData.length === 0 ? (
                <p className="text-center text-neutral-300">
                    The leaderboard is currently empty. Matches may still be in progress or Round 1 hasn't generated scores.
                </p>
            ) : (
                <div className="rounded-lg overflow-hidden bg-neutral-900">
                    <table className="w-full">
                        <thead className="bg-neutral-800">
                            <tr>
                                <th className="py-3 px-4 text-left border-b-2 border-neutral-700 text-neutral-200 font-semibold">Rank</th>
                                <th className="py-3 px-4 text-left border-b-2 border-neutral-700 text-neutral-200 font-semibold">Team Name</th>
                                <th className="py-3 px-4 text-right border-b-2 border-neutral-700 text-neutral-200 font-semibold">Score</th>
                                <th className="py-3 px-4 text-right border-b-2 border-neutral-700 text-neutral-200 font-semibold">Played</th>
                                <th className="py-3 px-4 text-right border-b-2 border-neutral-700 text-neutral-200 font-semibold">Won</th>
                                <th className="py-3 px-4 text-left border-b-2 border-neutral-700 text-neutral-200 font-semibold">Last Updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboardData.map((entry, index) => (
                                <tr 
                                    key={entry.team_id || index} 
                                    className="border-b border-neutral-700 last:border-b-0 hover:bg-neutral-800 transition-colors duration-150"
                                >
                                    <td className="py-3 px-4 font-bold text-neutral-100">{index + 1}</td>
                                    <td className="py-3 px-4 font-bold">
                                        <Link 
                                            href="#" 
                                            className="text-blue-400 hover:text-blue-300 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                                        >
                                            {entry.team_name || 'Unknown Team'}
                                        </Link>
                                    </td>
                                    <td className="py-3 px-4 text-right font-bold text-neutral-100">{entry.score}</td>
                                    <td className="py-3 px-4 text-right text-neutral-200">{entry.matches_played}</td>
                                    <td className="py-3 px-4 text-right text-neutral-200">{entry.matches_won}</td>
                                    <td className="py-3 px-4 text-left text-sm text-neutral-400">{new Date(entry.last_updated).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}