import React, { useState } from 'react';
import { Dropzone } from './components/Dropzone';
import { Layers, Settings, ChevronLeft, AlertCircle } from 'lucide-react';
import './index.css';

function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [rateLimitWarning, setRateLimitWarning] = useState<string | null>(null);

  const checkRateLimit = () => {
    const now = Date.now();
    const storedData = localStorage.getItem('pdf_rate_limit');
    let limitData = storedData ? JSON.parse(storedData) : { count: 0, timestamp: now };

    if (now - limitData.timestamp > 60000) {
      limitData = { count: 1, timestamp: now };
      localStorage.setItem('pdf_rate_limit', JSON.stringify(limitData));
      return true;
    }

    if (limitData.count >= 5) {
      return false;
    }

    limitData.count += 1;
    localStorage.setItem('pdf_rate_limit', JSON.stringify(limitData));
    return true;
  };

  const handleFileAccepted = (file: File) => {
    if (checkRateLimit()) {
      setRateLimitWarning(null);
      setPdfFile(file);
    } else {
      setRateLimitWarning("Rate limit exceeded! Please wait a minute before processing more files (Limit: 5 per minute).");
    }
  };

  const handleReset = () => {
    setPdfFile(null);
  };

  return (
    <div>
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '3rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--glass-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--brand-cyan), var(--brand-purple))',
            padding: '0.75rem',
            borderRadius: '12px',
            boxShadow: '0 0 20px rgba(0,255,225,0.3)'
          }}>
            <Layers color="#fff" size={28} />
          </div>
          <h1 className="text-gradient">PDF Splitter Pro</h1>
        </div>
        
        {pdfFile && (
          <button onClick={handleReset} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ChevronLeft size={18} />
            Upload Different File
          </button>
        )}
      </header>

      <main>
        {!pdfFile ? (
          <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
                Secure <span className="text-gradient">Client-Side</span> PDF Editing
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
                Extract, split, and merge your PDF documents directly in your browser. Complete privacy with zero server uploads.
              </p>
            </div>
            
            <Dropzone onFileAccepted={handleFileAccepted} />
            
            {rateLimitWarning && (
              <div style={{
                marginTop: '2rem',
                padding: '1rem',
                backgroundColor: 'rgba(255, 68, 68, 0.1)',
                border: '1px solid rgba(255, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#ff4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={20} />
                <span>{rateLimitWarning}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
              <Settings size={24} color="var(--brand-cyan)" />
              <h2 style={{ fontSize: '1.8rem' }}>Editor Workspace</h2>
            </div>
            
            <div style={{ 
              background: 'rgba(0,0,0,0.2)', 
              borderRadius: '8px', 
              padding: '1rem',
              border: '1px solid var(--glass-border)',
              marginBottom: '2rem'
            }}>
              <p><strong>Active File:</strong> {pdfFile.name}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4rem',
              border: '1px dashed var(--glass-border)',
              borderRadius: '12px',
              color: 'var(--text-muted)'
            }}>
              <p>The visual page preview and split controls will be implemented here next!</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
