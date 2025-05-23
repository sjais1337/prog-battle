'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext'; 

const GAME_UNIT_WIDTH = 30;  
const GAME_UNIT_HEIGHT = 30; 
const PADDLE_MODEL_WIDTH = 2;  
const PADDLE_VISUAL_HEIGHT = 1; 
const BALL_VISUAL_RADIUS = 0.75; 

const P1_Y_GAME = 0; 
const P2_Y_GAME = GAME_UNIT_HEIGHT - PADDLE_VISUAL_HEIGHT - 0; 


export default function MatchDetailPage() {
    const params = useParams();
    const matchId = params.matchId;

    const [matchDetails, setMatchDetails] = useState(null);
    const [loadingMatch, setLoadingMatch] = useState(true);
    const [matchError, setMatchError] = useState(null);

    const [gameLogData, setGameLogData] = useState(null); 
    const [loadingLog, setLoadingLog] = useState(false);
    const [logError, setLogError] = useState(null);

    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [fps, setFps] = useState(12); 

    const { authFetch } = useAuth();
    const canvasRef = useRef(null);
    const animationFrameId = useRef(null); 

    const [scaleX, setScaleX] = useState(20);
    const [scaleY, setScaleY] = useState(10);

    const fetchMatchDetails = useCallback(async () => {
        if (!matchId) return;
        setLoadingMatch(true);
        setMatchError(null);
        try {
            const response = await authFetch(`http://localhost:8000/api/tournament/matches/${matchId}/`);
            if (!response.ok) {
                let errorMsg = `Match details fetch failed: ${response.status}`;
                try{const ed = await response.json(); errorMsg = ed.detail || JSON.stringify(ed) || errorMsg;}catch(e){}
                throw new Error(errorMsg);
            }
            const data = await response.json();
            setMatchDetails(data);
        } catch (err) {
            setMatchError(err.message);
            console.error("Fetch match detail error:", err);
        } finally {
            setLoadingMatch(false);
        }
    }, [matchId, authFetch]);

    useEffect(() => {
        fetchMatchDetails();
    }, [fetchMatchDetails]);

    const loadAndParseGameLog = useCallback(async () => {
        if (!matchDetails || !matchDetails.game_log_url) {
            setLogError("Game log URL is not available for this match."); return;
        }
        setLoadingLog(true); setLogError(null); setGameLogData(null); setIsPlaying(false);
        try {
            const logUrl = matchDetails.game_log_url;
            const response = await authFetch(logUrl);
            if (!response.ok) throw new Error(`Game log fetch failed: ${response.status}`);
            const csvText = await response.text();
            
            const lines = csvText.trim().split(/\r?\n/); 
            if (lines.length < 2) throw new Error("Game log is empty or has no data rows.");
            
            const headers = lines[0].split(',').map(h => h.trim());
            const parsedLog = lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim());
                const entry = {};
                headers.forEach((header, index) => {
                    const val = values[index];
                    const numFields = ['step', 'ball_x', 'ball_y', 'paddle1_x', 'paddle2_x', 'score_bot1', 'score_bot2'];
                    if (numFields.includes(header) && val !== '') {
                        entry[header] = parseFloat(val);
                    } else {
                        entry[header] = val; 
                    }
                });
                return entry;
            });
            setGameLogData(parsedLog);
            setCurrentFrameIndex(0);
        } catch (err) { setLogError(err.message); console.error("Load/parse log error:", err);
        } finally { setLoadingLog(false); }
    }, [matchDetails, authFetch]);

    useEffect(() => {
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            setScaleX(canvas.width / GAME_UNIT_WIDTH);
            setScaleY(canvas.height / GAME_UNIT_HEIGHT);
        }
    }, []); 

    const drawFrame = useCallback((ctx, frame) => {
        if (!ctx || !frame || scaleX <= 0 || scaleY <= 0) {
            console.warn("drawFrame: Ctx, frame, or scales not ready/valid.", {ctxExists: !!ctx, frameExists: !!frame, scaleX, scaleY});
            return;
        }

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.fillStyle = '#222'; 
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(ctx.canvas.width / 2, 0);
        ctx.lineTo(ctx.canvas.width / 2, ctx.canvas.height);
        ctx.stroke();

        if (typeof frame.paddle1_x === 'number') {
            ctx.fillStyle = '#3498db'; 
            ctx.fillRect(
                frame.paddle1_x * scaleX,
                P1_Y_GAME * scaleY,
                PADDLE_MODEL_WIDTH * scaleX,
                PADDLE_VISUAL_HEIGHT * scaleY
            );
        }

        if (typeof frame.paddle2_x === 'number') {
            ctx.fillStyle = '#e74c3c'; 
            ctx.fillRect(
                frame.paddle2_x * scaleX,
                P2_Y_GAME * scaleY,
                PADDLE_MODEL_WIDTH * scaleX,
                PADDLE_VISUAL_HEIGHT * scaleY
            );
        }

        if (typeof frame.ball_x === 'number' && typeof frame.ball_y === 'number') {
            ctx.fillStyle = '#f1c40f'; 
            ctx.beginPath();
            ctx.arc(
                (frame.ball_x + 0.5) * scaleX, 
                (frame.ball_y + 0.5) * scaleY,
                BALL_VISUAL_RADIUS * Math.min(scaleX, scaleY), 
                0,
                2 * Math.PI
            );
            ctx.fill();
        }

        const fontSize = Math.max(12, 16 * Math.min(scaleX, scaleY) / 10);
        ctx.fillStyle = 'white';
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(`P1: ${frame.score_bot1 !== undefined ? frame.score_bot1 : '--'}`, 10, fontSize * 1.5);
        ctx.textAlign = 'right';
        ctx.fillText(`P2: ${frame.score_bot2 !== undefined ? frame.score_bot2 : '--'}`, ctx.canvas.width - 10, fontSize * 1.5);
        ctx.textAlign = 'center';
        ctx.fillText(`Step: ${frame.step !== undefined ? frame.step : '--'}`, ctx.canvas.width / 2, fontSize * 1.5);

    }, [scaleX, scaleY]);

    useEffect(() => {
        if (canvasRef.current && gameLogData && gameLogData.length > 0 && currentFrameIndex >= 0 && currentFrameIndex < gameLogData.length) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                const currentFrameData = gameLogData[currentFrameIndex];
                drawFrame(ctx, currentFrameData);
            }
        } else if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if(ctx) {
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.fillStyle = '#222';
                ctx.fillRect(0,0, ctx.canvas.width, ctx.canvas.height);
                ctx.font = "20px Arial";
                ctx.textAlign = "center";
                ctx.fillStyle = "white";
                ctx.fillText(gameLogData ? "End of log or invalid frame." : "Load game log to view simulation.", ctx.canvas.width / 2, ctx.canvas.height / 2);
            }
        }
    }, [currentFrameIndex, gameLogData, drawFrame]); 

    useEffect(() => {
        if (isPlaying && gameLogData && gameLogData.length > 0) {
            const interval = 1000 / fps; 
            animationFrameId.current = setTimeout(() => {
                setCurrentFrameIndex(prevFrame => {
                    const nextFrame = prevFrame + 1;
                    if (nextFrame < gameLogData.length) {
                        return nextFrame;
                    } else {
                        setIsPlaying(false); 
                        return prevFrame;
                    }
                });
            }, interval);
        } else {
            clearTimeout(animationFrameId.current);
        }
        return () => clearTimeout(animationFrameId.current); 
    }, [isPlaying, fps, gameLogData, currentFrameIndex]); 


    if (loadingMatch) return <div className='p-5 text-center'>Loading match details...</div>;
    if (matchError) return <div className='p-5 text-center text-red-500'>Error: {matchError}</div>;
    if (!matchDetails) return <div className='p-5 text-center'>Match not found.</div>;
    
    const p1Name = matchDetails.player1_team_name || 'Player 1';
    const p2Name = matchDetails.is_player2_system_bot ? "System Bot" : (matchDetails.player2_team_name || 'Player 2');
    const primaryButtonClasses = "py-2 px-4 rounded-md text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors duration-150";
    const controlButtonClasses = "py-1.5 px-3 rounded text-xs font-medium text-neutral-100 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors duration-150";


    return (
        <div className="p-5 max-w-4xl mx-auto text-center text-neutral-200">
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-100 mb-6">Match: {p1Name} vs {p2Name}</h1>
            <div className="mb-5 p-2.5 bg-neutral-800 rounded-md inline-block text-left">
                <p className="text-neutral-300 text-sm">Type: {matchDetails.match_type_display}, Status: {matchDetails.status_display}</p>
                {matchDetails.status_display === 'Completed' && (
                    <p className="text-neutral-300 text-sm">Score: {p1Name}: {matchDetails.player1_score} - {p2Name}: {matchDetails.player2_score}</p>
                )}
            </div>

            {matchDetails.status_display === 'Completed' && matchDetails.game_log_url && (
                <div className="mb-2.5">
                    <button onClick={loadAndParseGameLog} disabled={loadingLog} className={primaryButtonClasses}>
                        {loadingLog ? 'Loading Log...' : (gameLogData && gameLogData.length > 0 ? 'Reload Log & Reset Sim' : 'Load Simulation Data')}
                    </button>
                    {logError && <p className="text-red-400 mt-1.5 text-sm">Log Error: {logError}</p>}
                </div>
            )}

            {gameLogData && gameLogData.length > 0 && (
                <div id="simulationArea" className="mt-5 select-none">
                    <canvas 
                        ref={canvasRef} 
                        id="gameCanvas" 
                        width="600"  
                        height="300" 
                        className="border-2 border-neutral-700 bg-neutral-900 block mx-auto"
                        style={{ imageRendering: 'pixelated' }} // Kept as inline style for specificity
                    ></canvas>
                    <div className="mt-2.5 text-center flex flex-wrap justify-center items-center gap-2 sm:gap-2.5">
                        <button onClick={() => setCurrentFrameIndex(0)} disabled={!gameLogData || currentFrameIndex === 0} className={controlButtonClasses}>First</button>
                        <button onClick={() => setCurrentFrameIndex(f => Math.max(0, f - 1))} disabled={!gameLogData || currentFrameIndex <= 0} className={controlButtonClasses}>Prev</button>
                        <button onClick={() => setIsPlaying(p => !p)} disabled={!gameLogData} className={`${controlButtonClasses} min-w-[60px]`}>
                            {isPlaying ? 'Pause' : 'Play'}
                        </button>
                        <button onClick={() => setCurrentFrameIndex(f => Math.min(gameLogData.length - 1, f + 1))} disabled={!gameLogData || currentFrameIndex >= gameLogData.length - 1} className={controlButtonClasses}>Next</button>
                        <button onClick={() => setCurrentFrameIndex(gameLogData.length - 1)} disabled={!gameLogData || currentFrameIndex === gameLogData.length - 1} className={controlButtonClasses}>Last</button>
                        <label htmlFor="fps" className="ml-2 sm:ml-4 text-neutral-300 text-sm">FPS:</label>
                        <input 
                            type="number" 
                            id="fps" 
                            value={fps} 
                            onChange={e => setFps(Math.max(1, parseInt(e.target.value) || 1))} 
                            className="w-[50px] p-1 bg-neutral-700 border border-neutral-600 rounded-md text-sm text-neutral-100 text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <p className="text-neutral-400 text-sm mt-2">Frame: {currentFrameIndex + 1} / {gameLogData.length} (Step: {gameLogData[currentFrameIndex]?.step})</p>
                    <details className="mt-2.5 text-left bg-neutral-800 border border-neutral-700 p-2.5 rounded-md max-w-full sm:max-w-md mx-auto">
                        <summary className="cursor-pointer font-bold text-neutral-200">Current Frame Data</summary>
                        <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all bg-neutral-900 p-2 rounded text-xs text-neutral-300 mt-2">
                            {JSON.stringify(gameLogData[currentFrameIndex], null, 2)}
                        </pre>
                    </details>
                </div>
            )}
            <div className="mt-8">
                <Link href={`/teams/${matchDetails.player1_submission?.team_id || matchDetails.player1_team || ''}`} className="text-blue-400 hover:text-blue-300 hover:underline">
                    &larr; Back to Team
                </Link>
            </div>
        </div>
    );
}