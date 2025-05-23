'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const getDisplayName = (teamName, defaultName = 'NA') => {
    return teamName || defaultName;
};

export default function RoundTwoBracketPage() {
    const [matchesByStage, setMatchesByStage] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [stages, setStages] = useState([]); 

    const fetchBracketData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('http://localhost:8000/api/tournament/round-two-bracket/');
            if (!response.ok) {
                let errorMsg = `Failed to fetch bracket data. Status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.detail || JSON.stringify(errorData) || errorMsg;
                } catch (e) { 
                    throw new Error(e);
                }
                throw new Error(errorMsg);
            }
            const data = await response.json();
            const allMatches = data.results || data; 

            const grouped = {};
            const stageSet = new Set(); 

            allMatches.forEach(match => {
                const stageValue = match.round_stage !== null && !isNaN(Number(match.round_stage)) 
                                   ? Number(match.round_stage) 
                                   : 'unknown_stage';
                
                if (!grouped[stageValue]) {
                    grouped[stageValue] = [];
                }
                grouped[stageValue].push(match);
                stageSet.add(stageValue); 
            });
            
            for (const stageKey in grouped) {
                if (grouped[stageKey] && Array.isArray(grouped[stageKey])) {
                     grouped[stageKey].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                }
            }
            
            setMatchesByStage(grouped);
            
            let numericStages = Array.from(stageSet).filter(s => typeof s === 'number');
            numericStages.sort((a, b) => a - b); 
            
            let finalSortedStages = [];
            const desiredOrder = [2, 4, 8, 16]; 
            desiredOrder.forEach(ds => {
                if (numericStages.includes(ds)) {
                    finalSortedStages.push(ds);
                }
            });

            numericStages.forEach(ns => {
                if (!finalSortedStages.includes(ns)) {
                    finalSortedStages.push(ns); 
                }
            });

            if (stageSet.has('unknown_stage') && grouped['unknown_stage'] && grouped['unknown_stage'].length > 0) {
                 finalSortedStages.push('unknown_stage');
            }
            
            setStages(finalSortedStages.filter(s => grouped[s] && grouped[s].length > 0));

        } catch (err) {
            setError(err.message);
            console.error("Fetch bracket data error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBracketData();
    }, [fetchBracketData]);


    const getStageName = (stageKey) => {
        if (stageKey === 'unknown_stage') return 'Unstaged';
        if (stageKey == 2) return 'Final';
        if (stageKey == 4) return 'Semi-Finals';
        if (stageKey == 8) return 'Quarter-Finals';
        return `Round of ${stageKey}`; 
    };

    if (loading) {
        return <div><p>Loading tournament bracket...</p></div>;
    }

    if (error) {
        return <div><p className='text-red-500'>Error loading bracket: {error}</p></div>;
    }

    if (stages.length === 0) {
        return <div><p>Round 2 bracket is not yet available or no matches found.</p></div>;
    }

    const getStatusClasses = (statusDisplay) => {
        let bgColor = 'bg-neutral-500';
        if (statusDisplay === 'Completed') bgColor = 'bg-green-600';
        else if (statusDisplay === 'Pending') bgColor = 'bg-orange-500';
        else if (statusDisplay === 'Running') bgColor = 'bg-blue-500';
        else if (statusDisplay) bgColor = 'bg-red-500';
        return `font-bold py-0.5 px-2 rounded-full text-xs text-white ${bgColor}`;
    };

    const basePlayerNameClasses = "flex-grow";
    const normalPlayerNameClasses = "text-neutral-200 font-medium";
    const winnerPlayerNameClasses = "text-white font-bold";

    const actionLinkPrimaryClasses = "text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline";
    const actionLinkSecondaryClasses = "text-xs font-bold text-neutral-300 bg-neutral-700 hover:bg-neutral-600 rounded px-3 py-1.5 transition-colors duration-150";

    return (
        <div className="min-h-screen bg-black text-white px-6 md:px-8 py-5">
            <h1 className="text-center mb-10 text-4xl md:text-5xl font-bold tracking-wide text-neutral-100">Tournament Bracket</h1>
            
            {stages.map((stageKey,i) => (
                <div key={i}>
                    <h2 className="text-center text-2xl md:text-4xl font-semibold mb-0 pb-4 text-neutral-100">
                            {getStageName(stageKey)} 
                    </h2>
                    <div key={stageKey} className="mb-16 p-5 bg-neutral-900 rounded-xl">
                        
                        <div className="flex flex-row justify-center items-stretch flex-wrap gap-6">
                            {(matchesByStage[stageKey] && matchesByStage[stageKey].length > 0) ? (
                                matchesByStage[stageKey].map(match => {
                                    const p1DisplayName = getDisplayName(match.player1_team_name, 'Player 1');
                                    const p2DisplayName = match.is_player2_system_bot 
                                        ? "System Bot" 
                                        : getDisplayName(match.player2_team_name, 'Player 2');
                                    
                                    const winnerName = match.winning_team_details?.name || null; 
                                    
                                    const p1IsWinner = match.status_display === 'Completed' && winnerName && winnerName === match.player1_team_name;
                                    const p2IsWinner = match.status_display === 'Completed' && winnerName && winnerName === match.player2_team_name;
                                    const isDraw = match.status_display === 'Completed' && !winnerName && match.player1_score === match.player2_score;

                                    return (
                                        <div 
                                            key={match.id} 
                                            className="border border-neutral-700 rounded-lg p-5 bg-neutral-800 w-full sm:w-[300px] min-h-[160px] flex flex-col justify-between transition-transform duration-200 ease-in-out hover:-translate-y-[2px]"
                                        >
                                            <div> 
                                                <div className="flex justify-between items-center py-2 border-b border-neutral-700 text-base">
                                                    <span className={`${basePlayerNameClasses} ${p1IsWinner ? winnerPlayerNameClasses : normalPlayerNameClasses}`}>
                                                        {p1DisplayName}
                                                    </span>
                                                    <span className="font-bold min-w-[30px] text-right text-neutral-100">{match.player1_score !== null ? match.player1_score : '-'}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 text-base">
                                                    <span className={`${basePlayerNameClasses} ${p2IsWinner ? winnerPlayerNameClasses : normalPlayerNameClasses}`}>
                                                        {p2DisplayName}
                                                    </span>
                                                    <span className="font-bold min-w-[30px] text-right text-neutral-100">{match.player2_score !== null ? match.player2_score : '-'}</span>
                                                </div>
                                            </div>
                                            <div className="text-xs text-neutral-400 mt-4">
                                                <p className="my-2">
                                                    Status: <span className={getStatusClasses(match.status_display)}>{match.status_display}</span>
                                                </p>
                                                {match.status_display === 'Completed' && winnerName &&
                                                    <p className="my-1.5 font-medium">Winner: <span className="text-white font-bold">{winnerName}</span></p>
                                                }
                                                {isDraw &&
                                                    <p className="my-1.5 font-medium">Result: Draw</p>
                                                }
                                                <p className="my-1.5 text-xs">
                                                    {match.played_at ? `Played: ${new Date(match.played_at).toLocaleString()}` : `Queued: ${new Date(match.created_at).toLocaleString()}`}
                                                </p>

                                                {match.game_log_url && match.status_display === 'Completed' && (
                                                    <div className="mt-2.5 flex flex-col sm:flex-row items-center gap-2.5 justify-center">
                                                        {match.id && ( 
                                                            <Link href={`/matches/${match.id}`} className={actionLinkPrimaryClasses}>
                                                                View Simulation
                                                            </Link>
                                                        )}
                                                        {match.game_log_url && (
                                                            <a 
                                                            href={`http://localhost:8000${match.game_log_url}`} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className={actionLinkSecondaryClasses}
                                                            >
                                                                Download Log
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-center text-neutral-400 text-lg py-8">No matches scheduled for this stage yet.</p>
                            )}
                        </div>
                    </div>
                </div>
                
            ))}
        </div>
    );
}