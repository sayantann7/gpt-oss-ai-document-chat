'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient, type Document, type QueryResult, type Stats } from '../lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [query, setQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Check server health
  useEffect(() => {
    checkServerHealth();
    loadDocuments();
    loadStats();
  }, []);

  // Typing effect for AI response
  useEffect(() => {
    if (queryResult && queryResult.answer && !isTyping) {
      setIsTyping(true);
      setTypedText('');
      
      const fullText = queryResult.answer;
      let currentIndex = 0;
      
      const typeInterval = setInterval(() => {
        if (currentIndex < fullText.length) {
          setTypedText(fullText.substring(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(typeInterval);
          setIsTyping(false);
        }
      }, 10); // Adjust speed as needed (lower = faster)
      
      return () => clearInterval(typeInterval);
    }
  }, [queryResult]);

  const checkServerHealth = async () => {
    try {
      await apiClient.checkHealth();
      setServerStatus('online');
    } catch (error) {
      setServerStatus('offline');
    }
  };

  const loadDocuments = async () => {
    try {
      const data = await apiClient.getDocuments();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const loadStats = async () => {
    try {
      const data = await apiClient.getStats();
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      setMessage('Please select a file');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('pdf', selectedFile);

      const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ Document processed successfully!`);
        setSelectedFile(null);
        loadDocuments();
        loadStats();
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessExisting = async () => {
    if (!fileName.trim()) {
      setMessage('Please enter a file name');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName: fileName.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ Document processed successfully! ${data.chunksProcessed} chunks created.`);
        setFileName('');
        loadDocuments();
        loadStats();
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = async () => {
    if (!query.trim()) {
      setMessage('Please enter a query');
      return;
    }

    setLoading(true);
    setMessage('');
    setQueryResult(null);
    setTypedText('');
    setIsTyping(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          documentName: selectedDocument || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setQueryResult(data);
        setMessage('');
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (docName: string) => {
    if (!confirm(`Are you sure you want to delete "${docName}" and all its data?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(docName)}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ Document "${docName}" deleted successfully!`);
        loadDocuments();
        loadStats();
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format query results with proper styling
  const formatQueryResult = (text: string) => {
    if (!text) return null;

    // Extract think content before removing it
    const thinkMatches = text.match(/<think>(.*?)<\/think>/gi);
    let thinkContent = null;
    
    if (thinkMatches && thinkMatches.length > 0) {
      const thinkText = thinkMatches[0].replace(/<\/?think>/gi, '').trim();
      if (thinkText) {
        thinkContent = (
          <div className="mb-6 p-4 bg-gray-700/50 border-l-4 border-yellow-500 rounded-r-lg">
            <h4 className="text-lg font-nexa-heavy text-yellow-400 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Thought
            </h4>
            <p className="text-gray-300 font-nexa-light leading-relaxed italic">
              {thinkText}
            </p>
          </div>
        );
      }
    }

    // Remove <think> tags and their content
    const cleanText = text.replace(/<think>.*?<\/think>\s*/gi, '');
    
    // Split into paragraphs
    const paragraphs = cleanText.split(/\n\s*\n/).filter(p => p.trim());
    
    const formattedParagraphs = paragraphs.map((paragraph, pIndex) => {
      const trimmedParagraph = paragraph.trim();
      
      // Check if it's a main heading (starts with **bold**)
      if (/^\*\*.*\*\*$/.test(trimmedParagraph)) {
        const headingText = trimmedParagraph.replace(/\*\*/g, '');
        return (
          <h3 key={pIndex} className="text-2xl font-nexa-heavy text-gray-300 mb-4 mt-6 first:mt-0">
            {headingText}
          </h3>
        );
      }

      // Check if it's a numbered section (starts with number.)
      if (/^\d+\.\s+\*\*.*\*\*/.test(trimmedParagraph)) {
        const match = trimmedParagraph.match(/^(\d+\.\s+)\*\*(.*?)\*\*(.*)/);
        if (match) {
          const [, number, title, content] = match;
          return (
            <div key={pIndex} className="mb-6">
              <h4 className="text-xl font-nexa-heavy text-gray-300 mb-3 flex items-center gap-2">
                <span className="text-gray-400 font-nexa-light">{number}</span>
                {title}
              </h4>
              {content && (
                <div className="ml-6 text-gray-200 font-nexa-light leading-relaxed">
                  {formatInlineContent(content.trim())}
                </div>
              )}
            </div>
          );
        }
      }

      // Handle bullet points and sub-bullets
      const lines = trimmedParagraph.split('\n').map(line => line.trim()).filter(line => line);
      const formattedLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Main bullet point
        if (line.startsWith('- ')) {
          formattedLines.push(
            <li key={`${pIndex}-${i}`} className="mb-2 text-gray-200 font-nexa-light leading-relaxed">
              {formatInlineContent(line.substring(2))}
            </li>
          );
        }
        // Sub-bullet point
        else if (line.startsWith('* ')) {
          formattedLines.push(
            <li key={`${pIndex}-${i}`} className="mb-1 ml-6 text-gray-300 font-nexa-light text-sm list-disc">
              {formatInlineContent(line.substring(2))}
            </li>
          );
        }
        // Numbered list item
        else if (/^\d+\.\s+/.test(line)) {
          const match = line.match(/^(\d+\.\s+)(.*)/);
          if (match) {
            const [, number, content] = match;
            formattedLines.push(
              <li key={`${pIndex}-${i}`} className="mb-2 text-gray-200 font-nexa-light leading-relaxed flex">
                <span className="text-blue-400 font-nexa-heavy mr-2 min-w-fit">{number}</span>
                <span>{formatInlineContent(content)}</span>
              </li>
            );
          }
        }
        // Regular paragraph line
        else {
          formattedLines.push(
            <p key={`${pIndex}-${i}`} className="mb-3 text-gray-200 font-nexa-light leading-relaxed">
              {formatInlineContent(line)}
            </p>
          );
        }
      }

      return (
        <div key={pIndex} className="mb-4">
          {formattedLines.length > 1 && formattedLines.some(line => 
            line.props.children && line.props.children.toString().includes('–')
          ) ? (
            <ul className="space-y-1">{formattedLines}</ul>
          ) : (
            <div>{formattedLines}</div>
          )}
        </div>
      );
    });

    return (
      <div>
        {thinkContent}
        {formattedParagraphs}
      </div>
    );
  };

  // Helper function to format inline content (bold, italics, code, etc.)
  const formatInlineContent = (text: string) => {
    if (!text) return text;
    
    // Handle bold text **text**
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-nexa-heavy text-blue-300">$1</strong>');
    
    // Handle code/technical terms (words with underscores or in parentheses)
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-gray-700 text-blue-300 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
    
    // Handle arrows and special symbols
    formatted = formatted.replace(/→/g, '<span class="text-blue-400 mx-1">→</span>');
    formatted = formatted.replace(/–/g, '<span class="text-gray-400">–</span>');
    
    // Handle ranges (numbers with … between them)
    formatted = formatted.replace(/(\-?\d+(?:,\d{3})*)\s*…\s*(\+?\-?\d+(?:,\d{3})*)/g, 
      '<span class="text-purple-300 font-mono">$1</span><span class="text-gray-400 mx-1">…</span><span class="text-purple-300 font-mono">$2</span>');
    
    // Handle binary/hex numbers
    formatted = formatted.replace(/\b[01]+₂\b/g, '<span class="text-green-400 font-mono">$&</span>');
    formatted = formatted.replace(/\b0x[0-9A-Fa-f]+\b/g, '<span class="text-green-400 font-mono">$&</span>');
    
    // Return JSX with dangerouslySetInnerHTML
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-black text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between">
            <div className="mb-4 lg:mb-0">
              <h1 className="text-4xl lg:text-5xl font-nexa-heavy bg-gradient-to-br from-blue-500 to-blue-600 bg-clip-text text-transparent mb-3">
                AI Document Chat
              </h1>
              <p className="text-xl text-gray-300 mb-4 font-nexa-light">Transform your documents into intelligent, searchable knowledge. NO LIMITS ON DOCUMENT SIZE OR PAGE NUMBERS.</p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-nexa-light text-gray-400">Server Status:</span>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-nexa-heavy ${
                  serverStatus === 'online' ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50' :
                  serverStatus === 'offline' ? 'bg-red-900/50 text-red-300 border border-red-700/50' :
                  'bg-amber-900/50 text-amber-300 border border-amber-700/50'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    serverStatus === 'online' ? 'bg-blue-400' :
                    serverStatus === 'offline' ? 'bg-red-400' :
                    'bg-amber-400'
                  }`}></div>
                  {serverStatus === 'online' ? 'Online' :
                   serverStatus === 'offline' ? 'Offline' :
                   'Checking...'}
                </div>
              </div>
            </div>
            {/* <Link 
              href="/advanced" 
              className="group bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-6 py-3 rounded-xl hover:from-purple-600 hover:to-indigo-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium"
            >
              <span className="flex items-center gap-2">
                Advanced Features 
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M6 12h12" />
                </svg>
              </span>
            </Link> */}
          </div>
        </div>

        {/* Stats */}
        {/* {stats && (
          <div className="bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-gray-700/50 mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-nexa-heavy text-gray-100">Platform Statistics</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center p-6 bg-gradient-to-br from-blue-900/70 to-blue-800/70 rounded-xl border border-blue-700/50">
                <div className="text-3xl font-nexa-heavy text-blue-300 mb-2">{stats.totalDocuments}</div>
                <div className="text-sm font-nexa-heavy text-blue-200">Documents</div>
                <div className="text-xs font-nexa-light text-blue-400 mt-1">Total processed</div>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-blue-900/70 to-blue-800/70 rounded-xl border border-blue-700/50">
                <div className="text-3xl font-nexa-heavy text-blue-300 mb-2">{stats.totalChunks.toLocaleString()}</div>
                <div className="text-sm font-nexa-heavy text-blue-200">Chunks</div>
                <div className="text-xs font-nexa-light text-blue-400 mt-1">Content segments</div>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-purple-900/70 to-purple-800/70 rounded-xl border border-purple-700/50">
                <div className="text-3xl font-nexa-heavy text-purple-300 mb-2">{stats.averageChunkSize}</div>
                <div className="text-sm font-nexa-heavy text-purple-200">Avg Size</div>
                <div className="text-xs font-nexa-light text-purple-400 mt-1">Characters per chunk</div>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-orange-900/70 to-orange-800/70 rounded-xl border border-orange-700/50">
                <div className="text-3xl font-nexa-heavy text-orange-300 mb-2">{stats.documentsWithExamples}</div>
                <div className="text-sm font-nexa-heavy text-orange-200">Enhanced</div>
                <div className="text-xs font-nexa-light text-orange-400 mt-1">With examples</div>
              </div>
            </div>
          </div>
        )} */}

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-xl mb-8 border ${
            message.includes('✅') 
              ? 'bg-blue-900/50 text-blue-200 border-blue-700/50' 
              : 'bg-red-900/50 text-red-200 border-red-700/50'
          } shadow-lg`}>
            <div className="flex items-center gap-3">
              {message.includes('✅') ? (
                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className="font-nexa-heavy">{message}</span>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Side - Document Management and Query */}
          <div className="space-y-4">
            {/* Upload File */}
            <div className="bg-gray-800/90 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h2 className="text-xl font-nexa-heavy text-gray-100">Upload PDF Document</h2>
              </div>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-blue-600/50 rounded-xl p-4 bg-blue-900/20 hover:bg-blue-900/30 transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-300 font-nexa-light file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-nexa-heavy file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer cursor-pointer"
                  />
                  <p className="text-sm text-blue-400 mt-2 font-nexa-light">Choose a PDF file to upload and process</p>
                </div>
                <button
                  onClick={handleFileUpload}
                  disabled={loading || !selectedFile}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-nexa-heavy shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 disabled:transform-none"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="font-nexa-light">Processing...</span>
                    </span>
                  ) : 'Upload & Process'}
                </button>
              </div>
            </div>

            {/* Query Form */}
            <div className="bg-gray-800/90 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-nexa-heavy text-gray-100">Query Documents</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-nexa-heavy text-gray-300 mb-2">Document Selection</label>
                  <select
                    value={selectedDocument}
                    onChange={(e) => setSelectedDocument(e.target.value)}
                    className="w-full p-3 border border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors bg-gray-700/80 text-gray-100 font-nexa-light"
                  >
                    <option value="">All Documents</option>
                    {documents.map((doc, index) => (
                      <option key={index} value={doc.name}>
                        {doc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-nexa-heavy text-gray-300 mb-2">Your Question</label>
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask anything about your documents... e.g., 'What are the key features mentioned in the document?'"
                    rows={3}
                    className="w-full p-3 border border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors bg-gray-700/80 text-gray-100 placeholder-gray-400 resize-none font-nexa-light"
                  />
                </div>
                <button
                  onClick={handleQuery}
                  disabled={loading || !query.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-600 text-white py-3 px-4 rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-nexa-heavy shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 disabled:transform-none"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="font-nexa-light">Analyzing...</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Ask Question
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Documents List */}
            <div className="bg-gray-800/90 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-nexa-heavy text-gray-100">Processed Documents</h2>
              </div>
              {documents.length === 0 ? (
                <div className="text-center py-6">
                  <svg className="w-12 h-12 text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-400 font-nexa-light">No documents processed yet</p>
                  <p className="text-gray-500 text-sm mt-1 font-nexa-light">Upload your first PDF to get started</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {documents.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-700/70 to-gray-600/70 rounded-xl border border-gray-600/50 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-blue-900/50 rounded-lg">
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-nexa-heavy text-gray-200 text-sm">{doc.name}</div>
                          <div className="text-xs text-gray-400 font-nexa-light">
                            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteDocument(doc.name)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-1.5 rounded-lg transition-colors"
                        disabled={loading}
                        title="Delete document"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Side - AI Response */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800/90 backdrop-blur-sm p-6 rounded-xl shadow-xl border border-gray-700/50 h-full min-h-[500px]">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h2 className="text-xl font-nexa-heavy text-gray-100">AI Response</h2>
              </div>
              
              {/* Show placeholder when no query result */}
              {!queryResult ? (
                <div className="flex flex-col items-center justify-start h-full min-h-[350px] text-center pt-[80px]">
                  <div className="p-4 bg-gray-700/30 rounded-full mb-4">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-nexa-heavy text-gray-300 mb-3">Ready to Answer Your Questions</h3>
                  <p className="text-gray-400 font-nexa-light text-lg mb-2">Enter your query to see the AI response</p>
                  <p className="text-gray-500 font-nexa-light text-sm max-w-md">
                    Upload a document and ask any question about its content. I'll analyze it and provide detailed answers with source references.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-6 bg-gray-700/50 rounded-xl border border-gray-600/50">
                    <div className="text-gray-100 leading-relaxed">
                      {formatQueryResult(typedText || '')}
                    </div>
                  </div>
                  
                  {queryResult.sources.length > 0 && (
                    <div>
                      <h3 className="font-nexa-heavy text-gray-100 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Reference Sources:
                      </h3>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {queryResult.sources.map((source, index) => (
                          <div key={index} className="p-4 bg-gray-700/30 border border-gray-600/50 rounded-xl hover:bg-gray-700/50 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-nexa-heavy text-gray-100">{source.document_name}</span>
                              <span className="text-xs font-nexa-light text-gray-400 bg-gray-600/50 px-2 py-1 rounded">
                                Chunk {source.chunk_index}
                              </span>
                            </div>
                            <div className="text-gray-300 font-nexa-light text-sm leading-relaxed">{source.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        {/* <div className="mt-12 bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-white/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Quick Actions</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <button
              onClick={loadDocuments}
              className="flex items-center justify-center gap-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white py-3 px-6 rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:transform-none"
              disabled={loading}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Documents
            </button>
            <button
              onClick={loadStats}
              className="flex items-center justify-center gap-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white py-3 px-6 rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:transform-none"
              disabled={loading}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Refresh Stats
            </button>
            <button
              onClick={checkServerHealth}
              className="flex items-center justify-center gap-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white py-3 px-6 rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:transform-none"
              disabled={loading}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Check Server
            </button>
          </div>
        </div> */}
      </div>
    </div>
  );
}
