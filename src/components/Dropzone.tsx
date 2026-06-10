import React, { useCallback, useState } from 'react';
import { UploadCloud, FileType } from 'lucide-react';

interface DropzoneProps {
  onFileAccepted: (file: File) => void;
}

export function Dropzone({ onFileAccepted }: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        onFileAccepted(file);
      } else {
        alert('Please drop a valid PDF file.');
      }
    }
  }, [onFileAccepted]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        onFileAccepted(file);
      } else {
        alert('Please select a valid PDF file.');
      }
    }
  }, [onFileAccepted]);

  return (
    <div
      className={`glass-panel animate-float`}
      style={{
        padding: '4rem 2rem',
        textAlign: 'center',
        border: isDragActive ? '2px dashed var(--brand-cyan)' : '2px dashed var(--glass-border)',
        backgroundColor: isDragActive ? 'rgba(0, 255, 225, 0.05)' : 'var(--bg-panel)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById('fileUpload')?.click()}
    >
      <div style={{
        background: 'rgba(0, 255, 225, 0.1)',
        padding: '1.5rem',
        borderRadius: '50%',
        boxShadow: isDragActive ? '0 0 20px rgba(0, 255, 225, 0.4)' : 'none',
        transition: 'box-shadow 0.3s ease'
      }}>
        <UploadCloud size={64} color="var(--brand-cyan)" />
      </div>
      
      <div>
        <h2 style={{ marginBottom: '0.5rem' }}>
          Drag & Drop your PDF here
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          Or click to browse from your device
        </p>
      </div>

      <input
        type="file"
        id="fileUpload"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        color: 'var(--brand-pink)',
        fontSize: '0.9rem',
        fontWeight: 'bold',
        marginTop: '1rem',
        padding: '0.5rem 1rem',
        background: 'rgba(255, 0, 234, 0.1)',
        borderRadius: '20px'
      }}>
        <FileType size={18} />
        <span>100% Client-Side Processing • Your files never leave your device</span>
      </div>
    </div>
  );
}
