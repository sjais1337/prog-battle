'use client';
import { useAuth } from '../context/AuthContext'; 

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-5xl font-bold text-neutral-100 mb-12">Prog Battle</h1>
      
      <div className="max-w-md">
{/* 
        {loading && (
          <p className="text-neutral-400 text-lg mb-4 animate-pulse">
            Auth status loading...
          </p>
        )}
        {!loading && user && (
          <p className="text-neutral-300 text-lg mb-4">
            You are logged in as: <strong className="font-bold text-white">{user.username}</strong>
          </p>
        )}
        {!loading && !user && (
          <p className="text-neutral-300 text-lg mb-4">
            You are not logged in.
          </p>
        )} */}
      </div>
    </div>
  );
}