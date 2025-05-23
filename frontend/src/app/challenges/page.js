'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function ChallengesPage() {
    const [allUserChallenges, setAllUserChallenges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionError, setActionError] = useState(null);
    const [actionInProgress, setActionInProgress] = useState(null);

    const { authFetch, user: currentUser, accessToken, loading: authLoading } = useAuth();
    const router = useRouter();

    const fetchChallenges = useCallback(async () => {
        if (!accessToken) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setActionError(null);
        try {
            const response = await authFetch('http://localhost:8000/api/tournament/challenges/');
            if (!response.ok) {
                let errorMsg = `Failed to fetch challenges. Status: ${response.status}`;
                try{const ed=await response.json();errorMsg=ed.detail||JSON.stringify(ed)||errorMsg;}catch(e){}
                throw new Error(errorMsg);
            }
            const data = await response.json();
            const challengesFromServer = data.results || data;
            
            
            setAllUserChallenges(challengesFromServer);
        } catch (err) {
        } finally {
            setLoading(false);
        }
    }, [authFetch, accessToken]);

    useEffect(() => {
        if (!authLoading && !accessToken) {
            router.push('/login?message=Please log in to view challenges.');
        } else if (accessToken && !authLoading) {
            fetchChallenges();
        }
    }, [authLoading, accessToken, router, fetchChallenges]);

    const handleChallenge = async (challengeId, action) => {
        setActionError(null);
        setActionInProgress(challengeId);
        try {
            const response = await authFetch(`http://localhost:8000/api/tournament/challenges/${challengeId}/${action}/`, {
                method: 'POST',
            });
            const data = await response.json(); 
            if (response.ok) {
                alert(`Challenge successfully ${action.replace(/e$/, '')}ed!`); 
                fetchChallenges(); 
            } else {
                setActionError(data.detail || `Failed to ${action} challenge.`);
            }
        } catch (err) {
            setActionError(`An error occurred: ${err.message}`);
            console.error(`Challenge ${action} error:`, err);
        } finally {
            setActionInProgress(null);
        }
    };

    const myTeamIds = currentUser?.teams?.map(t => t.id) || [];

    const pendingIncomingChallenges = allUserChallenges.filter(c =>
        c.status === 'P' &&
        c.challenged_team_details && 
        myTeamIds.includes(c.challenged_team_details.id)
    );
    const pendingOutgoingChallenges = allUserChallenges.filter(c =>
        c.status === 'P' &&
        c.challenger_team_details && 
        myTeamIds.includes(c.challenger_team_details.id) &&
        !(c.challenged_team_details && myTeamIds.includes(c.challenged_team_details.id)) 
    );
    const historicalChallenges = allUserChallenges.filter(c => c.status !== 'P');


    if (loading) {
        return <div className='w-100vw'><p className='p-5 text-center'>Loading...</p></div>;
    }


    if (!accessToken && !authLoading) { 
        return <p>No access token found. Unauthorized.</p>
    }
    

    const ChallengeCard = ({ challenge, myTeamIds, actionInProgress, handleChallenge }) => { 
        const isMyTeamChallenger = challenge.challenger_team_details && myTeamIds.includes(challenge.challenger_team_details.id);
        const isMyTeamChallenged = challenge.challenged_team_details && myTeamIds.includes(challenge.challenged_team_details.id);

        const getStatusPillClasses = (status) => {
            let bgColor = 'bg-red-500';
            if (status === 'P') bgColor = 'bg-yellow-500';
            else if (status === 'A') bgColor = 'bg-cyan-500';
            else if (status === 'C') bgColor = 'bg-green-600';
            else if (status === 'X') bgColor = 'bg-neutral-500';
            return `font-bold py-0.5 px-2.5 rounded-full text-xs text-white ${bgColor}`;
        };
        
        const buttonBaseClasses = "py-2 px-4 text-white rounded-md cursor-pointer text-sm font-medium transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed";
        const acceptButtonClasses = `${buttonBaseClasses} bg-green-600 hover:bg-green-700`;
        const declineButtonClasses = `${buttonBaseClasses} bg-red-600 hover:bg-red-700`;
        const cancelButtonClasses = `${buttonBaseClasses} bg-neutral-600 hover:bg-neutral-700`;

        return (
            <div className="border border-neutral-700 rounded-lg p-5 mb-5 bg-neutral-800">
                <p className="text-xl font-bold mb-2.5 text-neutral-100">
                    <Link href={`/teams/${challenge.challenger_team_details?.id || '#'}`} className="text-blue-400 hover:text-blue-300 hover:underline">
                        {challenge.challenger_team_details?.name || 'Unknown Team'}
                    </Link>
                    <span className="text-neutral-500 mx-2"> vs </span>
                    <Link href={`/teams/${challenge.challenged_team_details?.id || '#'}`} className="text-blue-400 hover:text-blue-300 hover:underline">
                        {challenge.challenged_team_details?.name || 'Unknown Team'}
                    </Link>
                </p>

                {challenge.message && <p className="italic text-neutral-400 my-2.5 pl-2.5 border-l-[3px] border-neutral-700">Message: "{challenge.message}"</p>}
                <p className="my-2 text-neutral-200">Status: <span className={getStatusPillClasses(challenge.status)}>{challenge.status_display}</span></p>
                <p className="my-1 text-sm text-neutral-400">Issued: {new Date(challenge.created_at).toLocaleString()}</p>
                {challenge.resolved_at && <p className="my-1 text-sm text-neutral-400">Resolved: {new Date(challenge.resolved_at).toLocaleString()}</p>}
                
                {challenge.match_played_id && (challenge.status === 'A' || challenge.status === 'C') && 
                    <p className="my-2 text-neutral-200">
                        <Link href={`/matches/${challenge.match_played_id}`} className="font-bold text-blue-400 hover:text-blue-300 hover:underline">
                            View Associated Match
                        </Link>
                    </p>
                }

                {challenge.status === 'P' && (
                    <div className="mt-4 pt-4 border-t border-neutral-700 flex flex-wrap gap-2.5">
                        {isMyTeamChallenged && (!isMyTeamChallenger || challenge.challenger_team_details?.id !== challenge.challenged_team_details?.id) && ( 
                            <>
                                <button 
                                    onClick={() => handleChallenge(challenge.id, 'accept')} 
                                    disabled={actionInProgress === challenge.id} 
                                    className={acceptButtonClasses}
                                >
                                    {actionInProgress === challenge.id ? 'Accepting...' : 'Accept'}
                                </button>
                                <button 
                                    onClick={() => handleChallenge(challenge.id, 'decline')} 
                                    disabled={actionInProgress === challenge.id} 
                                    className={declineButtonClasses}
                                >
                                    {actionInProgress === challenge.id ? 'Declining...' : 'Decline'}
                                </button>
                            </>
                        )}
                        {isMyTeamChallenger && (!isMyTeamChallenged || challenge.challenger_team_details?.id !== challenge.challenged_team_details?.id) && ( 
                            <button 
                                onClick={() => handleChallenge(challenge.id, 'cancel')} 
                                disabled={actionInProgress === challenge.id} 
                                className={cancelButtonClasses}
                            >
                                {actionInProgress === challenge.id ? 'Cancelling...' : 'Cancel Challenge'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };


    return ( 
        <div className="max-w-4xl mx-auto p-5 min-h-screen bg-black text-white">
            <h1 className="text-center mb-8 text-4xl font-bold text-neutral-100">My Challenges</h1>
            <div className="text-center mb-8">
                <Link 
                    href="/challenges/new" 
                    className="inline-block py-3 px-6 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-lg font-bold transition-colors duration-200"
                >
                    Issue New Challenge
                </Link>
            </div>
            {actionError && <p className="text-red-500 mb-5 text-center font-bold">{actionError}</p>}

            <section className="mb-10">
                <h2 className="text-3xl text-neutral-100 border-b-2 border-neutral-700 pb-2.5 mb-5">Incoming Challenges</h2>
                {pendingIncomingChallenges.length > 0 
                    ? pendingIncomingChallenges.map(c => <ChallengeCard key={c.id} challenge={c} myTeamIds={myTeamIds} actionInProgress={actionInProgress} handleChallenge={handleChallenge} />) 
                    : <p className="text-neutral-400 italic">No pending incoming challenges.</p>}
            </section>
            <section className="mb-10">
                <h2 className="text-3xl text-neutral-100 border-b-2 border-neutral-700 pb-2.5 mb-5">Outgoing Challenges</h2>
                {pendingOutgoingChallenges.length > 0 
                    ? pendingOutgoingChallenges.map(c => <ChallengeCard key={c.id} challenge={c} myTeamIds={myTeamIds} actionInProgress={actionInProgress} handleChallenge={handleChallenge} />) 
                    : <p className="text-neutral-400 italic">No pending outgoing challenges.</p>}
            </section>
            <section className="mb-10">
                <h2 className="text-3xl text-neutral-100 border-b-2 border-neutral-700 pb-2.5 mb-5">Challenge History</h2>
                {historicalChallenges.length > 0 
                    ? historicalChallenges.map(c => <ChallengeCard key={c.id} challenge={c} myTeamIds={myTeamIds} actionInProgress={actionInProgress} handleChallenge={handleChallenge} />) 
                    : <p className="text-neutral-400 italic">No past challenges found.</p>}
            </section>
        </div>
    );
}