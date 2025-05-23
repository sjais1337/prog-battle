'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Editor from '@monaco-editor/react'; 
import { useAuth } from '@/context/AuthContext';

export default function EditSubmissionPage() {
    const params = useParams();
    const teamId = params.teamId;
    const submissionId = params.submissionId;
    const router = useRouter();

    const [submissionDetails, setSubmissionDetails] = useState(null);
    const [code, setCode] = useState('');
    const [initialCode, setInitialCode] = useState(''); 
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const { authFetch, accessToken, loading: authLoading } = useAuth();

    const fetchSubmissionAndCode = useCallback(async () => {
        if (!submissionId || !teamId || !accessToken) { 
            if (!authLoading && !accessToken) {
                router.push(`/login?message=Please log in to edit submissions.&next=${window.location.pathname}`);
            }
            return;
        }
        
        setLoading(true);
        setError(null);
        try {
            const subDetailsResponse = await authFetch(
                `http://localhost:8000/api/tournament/teams/${teamId}/submissions/${submissionId}/`
            );
            if (!subDetailsResponse.ok) {
                const errData = await subDetailsResponse.json().catch(() => ({}));
                throw new Error(errData.detail || `Failed to fetch submission details (Status: ${subDetailsResponse.status})`);
            }
            const subData = await subDetailsResponse.json();
            setSubmissionDetails(subData);

            if (subData.code_file) {
                const codeFileResponse = await authFetch(subData.code_file); 
                if (!codeFileResponse.ok) {
                    throw new Error(`Failed to fetch code file content (Status: ${codeFileResponse.status})`);
                }
                const codeContent = await codeFileResponse.text();
                setCode(codeContent);
                setInitialCode(codeContent); 
            } else {
                setCode(''); 
                setInitialCode('');
                console.warn("No code file URL found for this submission.");
            }
        } catch (err) {
            setError(err.message);
            console.error("Error fetching submission/code:", err);
        } finally {
            setLoading(false);
        }
    }, [submissionId, teamId, authFetch, accessToken, authLoading, router]); 

    useEffect(() => {
        if (!authLoading) { 
             fetchSubmissionAndCode();
        }
    }, [authLoading, fetchSubmissionAndCode]); 

    const handleEditorChange = (value, event) => {
        setCode(value || '');
    };

    const handleSaveChanges = async () => {
        if (code === initialCode) {
            alert("No changes made to the code.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const response = await authFetch(
                `http://localhost:8000/api/tournament/teams/${teamId}/submissions/${submissionId}/`, 
                {
                    method: 'PATCH',
                    body: {
                        code_text: code, 
                    },
                }
            );
            if (response.ok) {
                alert('Changes saved successfully!');
                setInitialCode(code); 
                router.push(`/teams/${teamId}`); 
            } else {
                const errorData = await response.json();
                setError(errorData.detail || JSON.stringify(errorData) || 'Failed to save changes.');
            }
        } catch (err) {
            setError('An error occurred while saving. Please try again.');
            console.error("Save submission error:", err);
        } finally {
            setSaving(false);
        }
    };

    

    if (authLoading || loading) {
        return <div className = 'p-5 text-center'>Loading submission editor...</div>;
    }

    if (!accessToken && !authLoading) { 
        return <div className = 'p-5 text-center'>Please log in to edit submissions.</div>;
    }
    
    if (error) {
        return <div className = 'p-5 text-center text-red-500'>Error: {error}</div>;
    }

    if (!submissionDetails) {
        return <div className = 'p-5 text-center'>Submission not found.</div>;
    }

    return (
        <div className="p-5 max-w-5xl mx-auto my-5">
            <h1 className="text-center mb-5 text-2xl sm:text-3xl font-bold text-neutral-100 break-all">
                Edit Bot: {submissionDetails.code_file ? decodeURIComponent(submissionDetails.code_file.split('/').pop()) : `Submission ${submissionDetails.id.substring(0,8)}`}
            </h1>
            <p className="text-center mb-4 text-neutral-300">For Team: {submissionDetails.team_name || teamId}</p>
            
            <div className="border border-neutral-700 rounded-md overflow-hidden min-h-[400px]">
                <Editor
                    height="60vh" 
                    language="python"
                    theme="vs-dark" 
                    value={code}
                    onChange={handleEditorChange}
                    options={{
                        selectOnLineNumbers: true,
                        minimap: { enabled: true },
                        automaticLayout: true, 
                    }}
                />
            </div>

            {error && <p className="text-red-400 mt-4 text-center font-medium">{error}</p>}
            
            <div className="mt-5 flex flex-col sm:flex-row flex-wrap justify-between items-center gap-4">
                <Link 
                    href={`/teams/${teamId}`} 
                    className="w-full sm:w-auto py-2.5 px-5 text-center text-neutral-200 border border-neutral-600 rounded-md hover:bg-neutral-700 hover:border-neutral-500 hover:text-neutral-100 transition-colors duration-150"
                >
                    Cancel & Back to Team
                </Link>
                <button 
                    onClick={handleSaveChanges} 
                    disabled={saving || code === initialCode}
                    className="w-full sm:w-auto py-2.5 px-5 bg-green-600 hover:bg-green-700 text-white rounded-md text-base transition-colors duration-150 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}