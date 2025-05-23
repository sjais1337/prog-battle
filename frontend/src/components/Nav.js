'use client';

import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';




export default function Nav() {
    const { user: currentUser, logout, loading: authLoading } = useAuth();

    const handleLogout = () => {
        logout(); 
    };

    if (authLoading) {
        return (
            <nav className="flex items-center gap-4 bg-black px-8 py-4 text-white border-b border-neutral-700">
                <Link href="/" className="py-2 px-3 rounded text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors duration-200">Home</Link>
                <span className="py-2 px-3 rounded text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors duration-200">Loading...</span>
            </nav>
        );
    }

    const userHasTeams = currentUser && currentUser.teams && currentUser.teams.length > 0;
    const firstTeamId = userHasTeams ? currentUser.teams[0].id : null;

    return (
        <nav className="flex items-center gap-4 bg-black px-8 py-4 text-white border-b border-neutral-700">
            <Link href="/" className="py-2 px-3 rounded text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors duration-200">
                Home
            </Link>
            <Link href="/teams" className="py-2 px-3 rounded text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors duration-200">
                All Teams
            </Link>
            <Link href="/leaderboard" className="py-2 px-3 rounded text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors duration-200">
                Leaderboard
            </Link>
            <Link href="/bracket" className="py-2 px-3 rounded text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors duration-200">
                Bracket
            </Link>
            {currentUser && (
                <Link href="/challenges" className="py-2 px-3 rounded text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors duration-200">
                    Challenges
                </Link>
            )}

            {currentUser && (
                userHasTeams && firstTeamId ? (
                    <Link href={`/teams/${firstTeamId}`} className="py-2 px-3 rounded text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors duration-200">
                        My Team
                    </Link>
                ) : (
                    <Link href="/teams/create" className="py-2 px-3 rounded text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors duration-200">
                        Create Team
                    </Link>
                )
            )}
            
            <div className="ml-auto flex items-center gap-4">
                {currentUser ? (
                    <>
                        <span className="text-neutral-200">Hi, {currentUser.username}!</span>
                        <button 
                            onClick={handleLogout} 
                            className="py-2 px-3 rounded bg-transparent border border-neutral-300 text-neutral-200 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors duration-200 cursor-pointer"
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    <>
                        <Link href="/login" className="py-2 px-3 rounded text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors duration-200">
                            Login
                        </Link>
                        <Link href="/register" className="py-2 px-3 rounded text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors duration-200">
                            Register
                        </Link>
                    </>
                )}
            </div>
        </nav>
    );
}