'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link'; 
import { useAuth } from '@/context/AuthContext';

export default function TeamDetailPage() {
    const params = useParams();
    const teamId = params.teamId;

    const [team, setTeam] = useState(null);
    const [loadingTeam, setLoadingTeam] = useState(true);
    const [teamError, setTeamError] = useState(null);

    const [submissions, setSubmissions] = useState([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(true);
    const [submissionsError, setSubmissionsError] = useState(null);

    const [teamMatches, setTeamMatches] = useState([]);
    const [loadingMatches, setLoadingMatches] = useState(true);
    const [matchesError, setMatchesError] = useState(null);
    
    const [isInitiatingMatch, setIsInitiatingMatch] = useState(false);
    const [actionInProgress, setActionInProgress] = useState(null);

    const { authFetch, accessToken, user: currentUser, loading: authLoading } = useAuth();

    const fetchDataForTeamPage = useCallback(async () => {
        if (!teamId) return;
        setLoadingTeam(true); setTeamError(null);
        setLoadingSubmissions(true); setSubmissionsError(null);
        setLoadingMatches(true); setMatchesError(null);
        let fetchedTeamData = null;
        try {
            const teamResponse = await fetch(`http://localhost:8000/api/tournament/teams/${teamId}/`);
            if (!teamResponse.ok) { let errorMsg = `Team fetch failed: ${teamResponse.status}`; try{const e=await teamResponse.json();errorMsg=e.detail||JSON.stringify(e);}catch(e){} throw new Error(errorMsg); }
            fetchedTeamData = await teamResponse.json();
            setTeam(fetchedTeamData);
            setLoadingTeam(false);

            if (accessToken) {
                const submissionsResponse = await authFetch(`http://localhost:8000/api/tournament/teams/${teamId}/submissions/`);
                if (!submissionsResponse.ok) { let errorMsg = `Submissions fetch failed: ${submissionsResponse.status}`; try{const e=await submissionsResponse.json();errorMsg=e.detail||JSON.stringify(e);}catch(e){} throw new Error(errorMsg); }
                const submissionsData = await submissionsResponse.json();
                setSubmissions(submissionsData.results || submissionsData);
            } else { setSubmissions([]); }
            setLoadingSubmissions(false);

            const matchesResponse = await authFetch(`http://localhost:8000/api/tournament/teams/${teamId}/matches/`);
            if (!matchesResponse.ok) { let errorMsg = `Matches fetch failed: ${matchesResponse.status}`; try{const e=await matchesResponse.json();errorMsg=e.detail||JSON.stringify(e);}catch(e){} throw new Error(errorMsg); }
            const matchesData = await matchesResponse.json();
            setTeamMatches(matchesData.results || matchesData);
        } catch (err) {
            console.error("Fetch team page data error:", err);
            if (!fetchedTeamData) setTeamError(err.message);
            else if (accessToken && submissions.length === 0 && !submissionsError) setSubmissionsError(err.message); 
            else if (!teamMatches.length && !matchesError) setMatchesError(err.message); 
            else setTeamError(err.message); 
        } finally {
            setLoadingTeam(false); setLoadingSubmissions(false); setLoadingMatches(false);
        }
    }, [teamId, authFetch, accessToken, submissions.length, teamMatches.length]); 

    useEffect(() => {
        if (teamId) {
            fetchDataForTeamPage();
        }
    }, [teamId, fetchDataForTeamPage]); 

    const handleSetActive = async (submissionId) => {
        if (!teamId || !submissionId) return;
        setActionInProgress(submissionId); 
        try {
            const response = await authFetch(`http://localhost:8000/api/tournament/teams/${teamId}/submissions/${submissionId}/set-active/`, {
                method: 'PATCH',
            });
            if (response.ok) {
                alert('Bot set as active successfully!');
                fetchDataForTeamPage(); 
            } else {
                const errorData = await response.json();
                alert(`Failed to set bot as active: ${errorData.detail || 'Unknown error'}`);
            }
        } catch (error) {
            console.error("Set active error:", error);
            alert("An error occurred while setting the bot as active.");
        } finally {
            setActionInProgress(null);
        }
    };

    const handleInitiateTestMatch = async () => {
        if (!team || !accessToken) {
            alert("You must be logged in to initiate a test match.");
            return;
        }
        
        const isMember = team.members_details?.some(memberUsername => memberUsername === currentUser?.username) || team.creator === currentUser?.username;
        if (!isMember) {
             alert("You must be a member or creator of this team to initiate a test match.");
             return;
        }

        const activeBot = submissions.find(sub => sub.is_active);
        if (!activeBot) {
            alert("This team does not have an active bot to test. Please set one active.");
            return;
        }

        setIsInitiatingMatch(true);
        try {
            const response = await authFetch(`http://localhost:8000/api/tournament/matches/initiate-test/`, {
                method: 'POST',
            });

            if (response.ok) {
                const newMatch = await response.json();
                alert(`Test match (ID: ${newMatch.id ? newMatch.id.substring(0,8) : 'N/A'}...) initiated! Status: ${newMatch.status_display}. It will be processed in the background.`);
                setTimeout(() => fetchDataForTeamPage(), 3000); 
            } else {
                const errorData = await response.json();
                alert(`Failed to initiate test match: ${errorData.detail || 'Unknown error'}`);
            }
        } catch (error) {
            console.error("Initiate test match error:", error);
            alert("An error occurred while initiating the test match.");
        } finally {
            setIsInitiatingMatch(false);
        }
    };


    if (authLoading || loadingTeam) {
        return <div className='p-5 text-center'>Loading...</div>;
    }
    if (teamError) { 
        return <div className='p-5 text-center text-red-500'>Error loading team: {teamError}</div>;
    }
    if (!team) { 
        return <div className='p-5 text-center'>Team not found or you do not have access.</div>; 
    }


    const isCurrentUserMemberOrCreator = currentUser && team && 
        (team.creator === currentUser.username || (team.members_details && team.members_details.includes(currentUser.username)));


    const getMatchStatusClasses = (status) => {
        if (status === 'C') return 'text-green-400 font-bold';
        if (status === 'P') return 'text-orange-400 font-bold';
        if (status === 'R') return 'text-blue-400 font-bold';
        return 'text-red-400 font-bold';
    };    

    return (
        <div className="max-w-4xl mx-auto p-5 text-neutral-200">
            <h1 className="text-3xl sm:text-4xl font-bold text-neutral-100 mb-6 text-center sm:text-left">{team.name}</h1>
            
            <div className="mb-6 p-4 bg-neutral-800 rounded-lg">
                <p className="text-neutral-300"><strong className="font-semibold text-neutral-100">Creator:</strong> {team.creator || 'N/A'}</p>
                <p className="text-neutral-300"><strong className="font-semibold text-neutral-100">Members:</strong> {Array.isArray(team.members_details) ? team.members_details.map(m => m.username || m).join(', ') : 'N/A'}</p>
                <p className="text-neutral-300"><strong className="font-semibold text-neutral-100">Created On:</strong> {new Date(team.created_at).toLocaleDateString()}</p>
            </div>

            <div className="my-8">
                <h2 className="text-2xl font-semibold text-neutral-100 mb-4">Bot Submissions</h2>
                {isCurrentUserMemberOrCreator && (
                    <Link href={`/teams/${teamId}/submit-bot`} 
                        className="inline-block mb-4 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors duration-150">
                        + Submit New Bot
                    </Link>
                )}
                {loadingSubmissions && <p className="text-neutral-400 my-2">Loading submissions...</p>}
                {submissionsError && <p className="text-red-400 my-2">{submissionsError}</p>}
                {!accessToken && !loadingSubmissions && <p className="text-neutral-400 my-2">Login to view or manage bot submissions.</p>}
                
                {accessToken && !loadingSubmissions && !submissionsError && submissions.length === 0 && (
                    <p className="text-neutral-400 my-2">No bot submissions yet for this team.</p>
                )}

                {accessToken && !loadingSubmissions && !submissionsError && submissions.length > 0 && (
                    <ul className="list-none p-0">
                        {submissions.map(sub => (
                            <li 
                                key={sub.id} 
                                className={`mb-3 p-4 border rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors ${sub.is_active ? 'bg-green-950 border-green-700' : 'bg-neutral-800 border-neutral-700'}`}
                            >
                                <div className="flex-grow">
                                    <p className="text-neutral-300 text-sm"><strong className="font-semibold text-neutral-200">Submitted:</strong> {new Date(sub.submitted_at).toLocaleString()}</p>
                                    <p className="text-neutral-300 text-sm"><strong className="font-semibold text-neutral-200">File:</strong> {sub.code_file ? decodeURIComponent(sub.code_file.split('/').pop()) : 'N/A'}</p>
                                    <p className="text-neutral-300 text-sm"><strong className="font-semibold text-neutral-200">Status:</strong> {sub.is_active ? <strong className="text-green-400">Active</strong> : 'Inactive'}</p>
                                </div>
                                <div className="flex gap-3 items-center mt-3 sm:mt-0 flex-shrink-0 self-start sm:self-center">
                                    {!sub.is_active && isCurrentUserMemberOrCreator && (
                                        <button 
                                            onClick={() => handleSetActive(sub.id)}
                                            disabled={actionInProgress === sub.id}
                                            className="py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors duration-150 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed"
                                        >
                                            {actionInProgress === sub.id ? 'Setting...' : 'Set as Active'}
                                        </button>
                                    )}
                                    {isCurrentUserMemberOrCreator && (
                                        <Link href={`/teams/${teamId}/submissions/${sub.id}/edit`} className="text-sm text-blue-400 hover:text-blue-300 hover:underline">Edit Bot</Link>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="my-8 p-4 bg-neutral-800 rounded-lg border border-neutral-700">
                <h2 className="text-2xl font-semibold text-neutral-100 mb-4">Matches</h2>
                {isCurrentUserMemberOrCreator && (
                     <button 
                        onClick={handleInitiateTestMatch} 
                        disabled={isInitiatingMatch || !submissions.some(s => s.is_active)}
                        className="py-2 px-4 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md text-sm font-medium transition-colors duration-150 mb-4 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed"
                    >
                        {isInitiatingMatch ? 'Initiating Test...' : 'Initiate Test Match vs System Bot'}
                    </button>
                )}
                { !submissions.some(s => s.is_active) && isCurrentUserMemberOrCreator && <p className="text-orange-400 text-xs mb-4">Note: Your team needs an active bot to initiate a test match.</p> }

                {loadingMatches && <p className="text-neutral-400 my-2">Loading matches...</p>}
                {matchesError && <p className="text-red-400 my-2">{matchesError}</p>}
                {!loadingMatches && !matchesError && teamMatches.length === 0 && (
                    <p className="text-neutral-400 my-2">No matches recorded for this team yet.</p>
                )}
                {!loadingMatches && !matchesError && teamMatches.length > 0 && (
                    <ul className="list-none p-0 mt-4">
                        {teamMatches.map(match => {
                            const player1Name = match.player1_team_name || "P1";
                            const opponentName = match.is_player2_system_bot 
                                ? "System Bot" 
                                : (match.player2_team_name || "P2");
                            
                            let winnerDisplay = "N/A"; 
                            if (match.status_display === 'Completed') {
                                if (match.winning_team_details) {
                                     winnerDisplay = match.winning_team_details.name;
                                } else if (match.player1_score === match.player2_score) {
                                    winnerDisplay = "Draw";
                                } else {
                                     winnerDisplay = "See scores"; 
                                }
                            }

                            return (
                                <li key={match.id} className="mb-4 p-4 border border-neutral-700 rounded-lg bg-neutral-900">
                                    <p className="text-neutral-300 text-sm"><strong className="font-semibold text-neutral-200">Match Type:</strong> {match.match_type_display}</p>
                                    <p className="text-neutral-300 text-sm"><strong className="font-semibold text-neutral-200">Opponent:</strong> {player1Name === team.name ? opponentName : player1Name}</p>
                                    <p className="text-neutral-300 text-sm"><strong className="font-semibold text-neutral-200">Status:</strong> <span className={getMatchStatusClasses(match.status)}>{match.status_display}</span></p>
                                    {match.status_display === 'Completed' && (
                                        <p className="text-neutral-300 text-sm">
                                            <strong className="font-semibold text-neutral-200">Score:</strong> {player1Name}: {match.player1_score} - {opponentName}: {match.player2_score}
                                            <br/>
                                            <strong className="font-semibold text-neutral-200">Winner:</strong> {winnerDisplay}
                                        </p>
                                    )}
                                    <p className="text-neutral-300 text-xs mt-1"><strong className="font-semibold text-neutral-200">Queued/Played:</strong> {new Date(match.played_at || match.created_at).toLocaleString()}</p>
                                    
                                    {isCurrentUserMemberOrCreator && match.status_display === 'Completed' && (match.id || match.game_log_url) && (
                                        <div className="mt-3 flex flex-wrap gap-3 items-center">
                                            {match.id && (
                                                <Link href={`/matches/${match.id}`} className="py-1 px-3 text-xs font-medium text-blue-400 border border-blue-500 rounded hover:bg-blue-500 hover:text-white transition-colors duration-150">
                                                    View Details
                                                </Link>
                                            )}
                                            {match.game_log_url && (
                                                <a href={`http://localhost:8000${match.game_log_url}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline">
                                                    Download Log
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            
            <div className="mt-8 text-center">
                <Link href="/teams" className="text-blue-400 hover:text-blue-300 hover:underline">
                    &larr; Back to Teams List
                </Link>
            </div>
        </div>
    );
}