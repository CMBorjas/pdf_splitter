import { useEffect, useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { X, ZoomIn, Plus, Trash2, Check, Info, Loader2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerProps {
  file: File;
}

type SplitMode = 'custom' | 'fixed' | 'smart';
type PageRange = { id: string; from: number; to: number; name?: string };

// Helper functions for Extract mode
const parseInputToSet = (input: string, maxPages: number): Set<number> => {
  const newSet = new Set<number>();
  if (!input.trim()) return newSet;
  const parts = input.split(',');
  for (const part of parts) {
    const range = part.split('-');
    if (range.length === 1) {
      const page = parseInt(range[0].trim());
      if (!isNaN(page) && page >= 1 && page <= maxPages) {
        newSet.add(page);
      }
    } else if (range.length === 2) {
      let start = parseInt(range[0].trim());
      let end = parseInt(range[1].trim());
      if (!isNaN(start) && !isNaN(end)) {
        start = Math.max(1, start);
        end = Math.min(maxPages, end);
        if (start <= end) {
          for (let i = start; i <= end; i++) {
            newSet.add(i);
          }
        }
      }
    }
  }
  return newSet;
};

const formatSetToInput = (set: Set<number>): string => {
  if (set.size === 0) return '';
  const arr = Array.from(set).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = arr[0];
  let end = arr[0];
  
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === end + 1) {
      end = arr[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = arr[i];
      end = arr[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(',');
};

export function PdfViewer({ file }: PdfViewerProps) {
  const fileStateKey = `pdfSplitterState_${file.name}`;
  const savedStateStr = localStorage.getItem(fileStateKey);
  const savedState = savedStateStr ? JSON.parse(savedStateStr) : null;

  const [numPages, setNumPages] = useState<number>(0);
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoomedPage, setZoomedPage] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [thumbnailScale, setThumbnailScale] = useState<number>(1);
  
  // Range mode state
  const [viewMode, setViewMode] = useState<'pages' | 'range' | 'size'>(savedState?.viewMode || 'pages');
  const [rangeMode, setRangeMode] = useState<SplitMode>(savedState?.rangeMode || 'custom');
  const [ranges, setRanges] = useState<PageRange[]>(savedState?.ranges || []);
  const [mergeAll, setMergeAll] = useState<boolean>(savedState?.mergeAll ?? false);
  const [fixedAmount, setFixedAmount] = useState<number>(savedState?.fixedAmount || 2);

  // Extract mode state
  const [extractMode, setExtractMode] = useState<'all' | 'select'>(savedState?.extractMode || 'select');
  const [selectedPages, setSelectedPages] = useState<Set<number>>(savedState?.selectedPages ? new Set(savedState.selectedPages) : new Set());
  const [extractInputStr, setExtractInputStr] = useState<string>(savedState?.extractInputStr || '');
  const [mergeExtract, setMergeExtract] = useState<boolean>(savedState?.mergeExtract ?? false);

  // Size mode state
  const [maxSizeStr, setMaxSizeStr] = useState<string>(savedState?.maxSizeStr || '232');
  const [sizeUnit, setSizeUnit] = useState<'KB' | 'MB'>(savedState?.sizeUnit || 'KB');
  const [allowCompression, setAllowCompression] = useState<boolean>(savedState?.allowCompression ?? false);

  useEffect(() => {
    const stateToSave = {
      viewMode,
      rangeMode,
      ranges,
      mergeAll,
      fixedAmount,
      extractMode,
      selectedPages: Array.from(selectedPages),
      extractInputStr,
      mergeExtract,
      maxSizeStr,
      sizeUnit,
      allowCompression,
    };
    localStorage.setItem(fileStateKey, JSON.stringify(stateToSave));
  }, [viewMode, rangeMode, ranges, mergeAll, fixedAmount, extractMode, selectedPages, extractInputStr, mergeExtract, maxSizeStr, sizeUnit, allowCompression, fileStateKey]);

  useEffect(() => {
    if (rangeMode === 'fixed' && numPages > 0) {
      const newRanges: PageRange[] = [];
      let currentFrom = 1;
      let idCounter = 1;
      const amount = Math.max(1, fixedAmount);
      while (currentFrom <= numPages) {
        const to = Math.min(currentFrom + amount - 1, numPages);
        newRanges.push({ id: `fixed-${idCounter++}`, from: currentFrom, to });
        currentFrom = to + 1;
      }
      setRanges(newRanges);
    }
  }, [rangeMode, fixedAmount, numPages]);

  useEffect(() => {
    const loadPdf = async () => {
      setLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        setPdfDocument(pdf);
        setNumPages(pdf.numPages);
        
        setRanges(prev => prev.length === 0 && pdf.numPages > 0 ? [{ id: Date.now().toString(), from: 1, to: pdf.numPages }] : prev);
      } catch (error) {
        console.error('Error loading PDF:', error);
      } finally {
        setLoading(false);
      }
    };
    loadPdf();
  }, [file]);

  // Extract handlers
  const handleExtractInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setExtractInputStr(val);
    setSelectedPages(parseInputToSet(val, numPages));
  };

  const togglePageSelection = (page: number) => {
    if (extractMode === 'all') return;
    
    const newSet = new Set(selectedPages);
    if (newSet.has(page)) {
      newSet.delete(page);
    } else {
      newSet.add(page);
    }
    setSelectedPages(newSet);
    setExtractInputStr(formatSetToInput(newSet));
  };

  // Range handlers
  const addRange = () => {
    setRanges([...ranges, { id: Date.now().toString(), from: 1, to: numPages }]);
  };

  const updateRangeName = (id: string, name: string) => {
    setRanges(ranges.map(r => r.id === id ? { ...r, name } : r));
  };

  const updateRange = (id: string, field: 'from' | 'to', value: number) => {
    let boundedValue = Math.max(1, Math.min(value, numPages));
    setRanges(ranges.map(r => {
      if (r.id === id) {
        const newRange = { ...r, [field]: boundedValue };
        if (field === 'from' && newRange.from > newRange.to) newRange.to = newRange.from;
        if (field === 'to' && newRange.to < newRange.from) newRange.from = newRange.to;
        return newRange;
      }
      return r;
    }));
  };

  const removeRange = (id: string) => {
    if (ranges.length > 1) {
      setRanges(ranges.filter(r => r.id !== id));
    }
  };

  const handleSplitPdf = async () => {
    if (!file || numPages === 0) return;
    
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const originalPdfBytes = new Uint8Array(arrayBuffer);
      const zip = new JSZip();
      
      const addPdfToZip = async (pdfDoc: PDFDocument, filename: string) => {
        const pdfBytes = await pdfDoc.save();
        zip.file(filename, pdfBytes);
      };

      if (viewMode === 'range') {
        if (mergeAll) {
          const mergedPdf = await PDFDocument.create();
          const srcDoc = await PDFDocument.load(originalPdfBytes);
          
          for (const range of ranges) {
            const start = Math.max(1, Math.min(range.from, range.to)) - 1;
            const end = Math.max(range.from, range.to) - 1;
            const pageIndices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            
            const copiedPages = await mergedPdf.copyPages(srcDoc, pageIndices);
            copiedPages.forEach(page => mergedPdf.addPage(page));
          }
          await addPdfToZip(mergedPdf, 'merged_ranges.pdf');
        } else {
          const srcDoc = await PDFDocument.load(originalPdfBytes);
          for (let i = 0; i < ranges.length; i++) {
            const range = ranges[i];
            const newPdf = await PDFDocument.create();
            const start = Math.max(1, Math.min(range.from, range.to)) - 1;
            const end = Math.max(range.from, range.to) - 1;
            const pageIndices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            
            const copiedPages = await newPdf.copyPages(srcDoc, pageIndices);
            copiedPages.forEach(page => newPdf.addPage(page));
            
            const filename = range.name ? `${range.name}.pdf` : `range_${i + 1}_(${range.from}-${range.to}).pdf`;
            await addPdfToZip(newPdf, filename);
          }
        }
      } else if (viewMode === 'pages') {
        const srcDoc = await PDFDocument.load(originalPdfBytes);
        const pagesToProcess = extractMode === 'all' 
          ? Array.from({ length: numPages }, (_, i) => i + 1)
          : Array.from(selectedPages).sort((a, b) => a - b);
          
        if (pagesToProcess.length === 0) {
           setIsProcessing(false);
           alert("Please select at least one page to extract.");
           return;
        }

        if (mergeExtract) {
          const newPdf = await PDFDocument.create();
          const pageIndices = pagesToProcess.map(p => p - 1);
          const copiedPages = await newPdf.copyPages(srcDoc, pageIndices);
          copiedPages.forEach(page => newPdf.addPage(page));
          await addPdfToZip(newPdf, 'extracted_pages.pdf');
        } else {
          for (const pageNum of pagesToProcess) {
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(srcDoc, [pageNum - 1]);
            copiedPages.forEach(page => newPdf.addPage(page));
            await addPdfToZip(newPdf, `page_${pageNum}.pdf`);
          }
        }
      } else if (viewMode === 'size') {
        const srcDoc = await PDFDocument.load(originalPdfBytes);
        const maxSizeBytes = parseFloat(maxSizeStr) * (sizeUnit === 'MB' ? 1024 * 1024 : 1024);
        
        let currentPdf = await PDFDocument.create();
        let fileIndex = 1;
        
        for (let i = 0; i < numPages; i++) {
          const testPdf = await PDFDocument.create();
          
          if (currentPdf.getPageCount() > 0) {
            const currentIndices = Array.from({ length: currentPdf.getPageCount() }, (_, j) => j);
            const copiedCurrentPages = await testPdf.copyPages(currentPdf, currentIndices);
            copiedCurrentPages.forEach(p => testPdf.addPage(p));
          }
          
          const copiedNextPage = await testPdf.copyPages(srcDoc, [i]);
          testPdf.addPage(copiedNextPage[0]);
          
          const testBytes = await testPdf.save({ useObjectStreams: allowCompression });
          
          if (testBytes.length > maxSizeBytes && currentPdf.getPageCount() > 0) {
             const currentBytes = await currentPdf.save({ useObjectStreams: allowCompression });
             zip.file(`split_part_${fileIndex}.pdf`, currentBytes);
             fileIndex++;
             
             currentPdf = await PDFDocument.create();
             const newPage = await currentPdf.copyPages(srcDoc, [i]);
             currentPdf.addPage(newPage[0]);
          } else {
             const pageToAdd = await currentPdf.copyPages(srcDoc, [i]);
             currentPdf.addPage(pageToAdd[0]);
          }
        }
        
        if (currentPdf.getPageCount() > 0) {
          const currentBytes = await currentPdf.save({ useObjectStreams: allowCompression });
          zip.file(`split_part_${fileIndex}.pdf`, currentBytes);
        }
      }

      // Generate Zip and Download
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pdf_splitter_result.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error("Error splitting PDF:", error);
      alert("An error occurred while processing the PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--brand-cyan)' }}>
        <div className="animate-pulse">Loading PDF Document...</div>
      </div>
    );
  }

  if (zoomedPage !== null && pdfDocument) {
    return (
      <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: 'var(--text-muted)' }}>Viewing Page {zoomedPage} of {numPages}</h3>
          <button 
            onClick={() => setZoomedPage(null)}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
          >
            <X size={18} />
            Back to Thumbnails
          </button>
        </div>
        
        <div style={{ 
          background: 'rgba(0,0,0,0.4)', 
          padding: '1rem', 
          borderRadius: '12px',
          border: '1px solid var(--glass-border)',
          overflowY: 'auto',
          maxHeight: '70vh',
          width: '100%',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <PdfCanvas pdf={pdfDocument} pageNumber={zoomedPage} scale={1.5} />
        </div>
      </div>
    );
  }

  const generatedFilesCount = mergeExtract ? 1 : (extractMode === 'all' ? numPages : selectedPages.size);

  return (
    <div style={{ width: '100%', display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
      
      {/* Left Area: Visual Preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
              {(viewMode === 'pages' || viewMode === 'size') ? `Document Pages (${numPages})` : 'Range Preview'}
            </h3>
            {(viewMode === 'pages' || viewMode === 'size') && <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--brand-pink)' }}>(Click page to {viewMode === 'size' ? 'zoom' : 'select'})</p>}
          </div>
          
          {(viewMode === 'pages' || viewMode === 'size') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Size</span>
              <input 
                type="range" 
                min="0.5" 
                max="3" 
                step="0.1" 
                value={thumbnailScale} 
                onChange={(e) => setThumbnailScale(parseFloat(e.target.value))}
                style={{ width: '100px', cursor: 'pointer' }}
              />
            </div>
          )}
        </div>
        
        <div style={{ 
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.5rem',
          overflowY: 'auto',
          maxHeight: '600px',
          padding: '1.5rem',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '12px',
          border: '1px solid var(--glass-border)'
        }}>
          {(viewMode === 'pages' || viewMode === 'size') ? (
            Array.from({ length: numPages }, (_, i) => {
              const isSelected = viewMode === 'pages' && (extractMode === 'all' || selectedPages.has(i + 1));
              return (
                <div 
                  key={i + 1} 
                  onClick={() => {
                    if (viewMode === 'pages') {
                      togglePageSelection(i + 1);
                    } else {
                      setZoomedPage(i + 1);
                    }
                  }}
                  className="thumbnail-card"
                  style={{ 
                    position: 'relative',
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    cursor: (viewMode === 'pages' && extractMode === 'select') ? 'pointer' : 'zoom-in',
                    padding: '0.75rem',
                    background: 'var(--bg-panel)',
                    border: isSelected ? '2px solid #10b981' : '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease-in-out',
                    width: `${180 * thumbnailScale}px`
                  }}
                >
                  {isSelected && (
                    <div style={{ 
                      position: 'absolute', top: '-10px', left: '-10px', 
                      background: '#10b981', color: 'white', borderRadius: '50%', 
                      padding: '4px', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' 
                    }}>
                      <Check size={16} strokeWidth={3} />
                    </div>
                  )}
                  
                  <PdfCanvas pdf={pdfDocument!} pageNumber={i + 1} fixedWidth={160 * thumbnailScale} />
                  
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomedPage(i + 1);
                    }}
                    style={{ 
                      marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--brand-cyan)', 
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      cursor: 'zoom-in', padding: '0.2rem 0.5rem', borderRadius: '4px',
                      background: 'rgba(0,255,225,0.1)'
                    }}
                  >
                    <ZoomIn size={14} />
                    <span>Page {i + 1}</span>
                  </div>
                </div>
              );
            })
          ) : (
            // Range Preview Mode
            ranges.map((range, index) => (
              <div 
                key={range.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  border: '1px dashed var(--glass-border)',
                  minWidth: '280px'
                }}
              >
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--brand-cyan)' }}>{range.name || `Range ${index + 1}`}</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  
                  {/* From Page */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ background: 'var(--bg-panel)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                      <PdfCanvas pdf={pdfDocument!} pageNumber={range.from} fixedWidth={100} />
                    </div>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{range.from}</span>
                  </div>

                  {range.from !== range.to && (
                    <>
                      <div style={{ color: 'var(--text-muted)', fontSize: '1.5rem', letterSpacing: '2px' }}>...</div>
                      {/* To Page */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ background: 'var(--bg-panel)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                          <PdfCanvas pdf={pdfDocument!} pageNumber={range.to} fixedWidth={100} />
                        </div>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{range.to}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Area: Sidebar Controls */}
      <div style={{ 
        width: '320px', 
        flexShrink: 0, 
        background: 'var(--bg-panel)', 
        borderRadius: '12px',
        border: '1px solid var(--glass-border)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)' }}>
          <button 
            onClick={() => setViewMode('range')}
            style={{ 
              flex: 1, padding: '1rem 0.5rem', background: 'transparent', border: 'none', cursor: 'pointer',
              color: viewMode === 'range' ? 'var(--brand-cyan)' : 'var(--text-muted)',
              borderBottom: viewMode === 'range' ? '2px solid var(--brand-cyan)' : '2px solid transparent',
              fontWeight: viewMode === 'range' ? 'bold' : 'normal'
            }}
          >
            Range
          </button>
          <button 
            onClick={() => setViewMode('pages')}
            style={{ 
              flex: 1, padding: '1rem 0.5rem', background: 'transparent', border: 'none', cursor: 'pointer',
              color: viewMode === 'pages' ? 'var(--brand-cyan)' : 'var(--text-muted)',
              borderBottom: viewMode === 'pages' ? '2px solid var(--brand-cyan)' : '2px solid transparent',
              fontWeight: viewMode === 'pages' ? 'bold' : 'normal'
            }}
          >
            Pages
          </button>
          <button 
            onClick={() => setViewMode('size')}
            style={{ 
              flex: 1, padding: '1rem 0.5rem', background: 'transparent', border: 'none', cursor: 'pointer',
              color: viewMode === 'size' ? 'var(--brand-cyan)' : 'var(--text-muted)',
              borderBottom: viewMode === 'size' ? '2px solid var(--brand-cyan)' : '2px solid transparent',
              fontWeight: viewMode === 'size' ? 'bold' : 'normal'
            }}
          >
            Size
          </button>
        </div>

        {viewMode === 'range' && (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
            {/* Range Mode Selectors */}
            <div>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Range mode:</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => setRangeMode('custom')}
                  style={{ 
                    flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--brand-pink)',
                    background: rangeMode === 'custom' ? 'rgba(255,0,234,0.1)' : 'transparent',
                    color: rangeMode === 'custom' ? 'var(--brand-pink)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Custom
                </button>
                <button 
                  onClick={() => setRangeMode('fixed')}
                  style={{ 
                    flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--brand-cyan)',
                    background: rangeMode === 'fixed' ? 'rgba(0,255,225,0.1)' : 'transparent',
                    color: rangeMode === 'fixed' ? 'var(--brand-cyan)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Fixed
                </button>
              </div>
            </div>

            {/* Ranges List */}
            {rangeMode === 'custom' ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {ranges.map((range, index) => (
                    <div key={range.id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <input 
                          type="text"
                          value={range.name ?? `Range ${index + 1}`}
                          onChange={(e) => updateRangeName(range.id, e.target.value)}
                          placeholder={`Range ${index + 1}`}
                          style={{ 
                            fontWeight: 'bold', 
                            background: 'transparent', 
                            border: '1px solid transparent',
                            borderBottom: '1px solid rgba(255,255,255,0.2)',
                            color: 'white', 
                            outline: 'none', 
                            padding: '0.2rem',
                            width: '180px',
                            fontSize: '1rem'
                          }}
                        />
                        {ranges.length > 1 && (
                          <button onClick={() => removeRange(range.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '0.2rem' }}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>from page</label>
                          <input 
                            type="number" 
                            min={1} 
                            max={numPages} 
                            value={range.from}
                            onChange={(e) => updateRange(range.id, 'from', parseInt(e.target.value) || 1)}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: 'white' }}
                          />
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>to</label>
                          <input 
                            type="number" 
                            min={1} 
                            max={numPages} 
                            value={range.to}
                            onChange={(e) => updateRange(range.id, 'to', parseInt(e.target.value) || 1)}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', background: 'var(--bg-main)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: 'white' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={addRange}
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', 
                    width: '100%', padding: '0.75rem', background: 'transparent', 
                    border: '1px dashed var(--brand-pink)', color: 'var(--brand-pink)', borderRadius: '8px', cursor: 'pointer' 
                  }}
                >
                  <Plus size={18} /> Add Range
                </button>
              </>
            ) : (
              // Fixed Range UI
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Split in page ranges of</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={numPages} 
                    value={fixedAmount}
                    onChange={(e) => setFixedAmount(parseInt(e.target.value) || 1)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem', background: 'var(--bg-main)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: 'white' }}
                  />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Generated Ranges:</h4>
                  {ranges.map((range, index) => (
                    <div key={range.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                      <input 
                        type="text"
                        value={range.name ?? `Range ${index + 1}`}
                        onChange={(e) => updateRangeName(range.id, e.target.value)}
                        placeholder={`Range ${index + 1}`}
                        style={{ 
                          fontSize: '0.9rem', 
                          background: 'transparent', 
                          border: 'none',
                          borderBottom: '1px dotted rgba(255,255,255,0.3)',
                          color: 'white', 
                          outline: 'none',
                          width: '120px'
                        }}
                      />
                      <span style={{ color: 'var(--brand-cyan)', fontWeight: 'bold' }}>{range.from} - {range.to}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input 
                type="checkbox" 
                id="mergeRanges" 
                checked={mergeAll} 
                onChange={(e) => setMergeAll(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--brand-cyan)' }}
              />
              <label htmlFor="mergeRanges" style={{ cursor: 'pointer', userSelect: 'none' }}>
                Merge all ranges in one PDF file.
              </label>
            </div>

            <button 
              onClick={handleSplitPdf}
              disabled={isProcessing}
              style={{ 
                width: '100%', padding: '1rem', background: '#E53935', color: 'white', 
                border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', 
                cursor: isProcessing ? 'not-allowed' : 'pointer', marginTop: 'auto',
                boxShadow: '0 4px 12px rgba(229, 57, 53, 0.3)',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
                opacity: isProcessing ? 0.7 : 1
              }}
            >
              {isProcessing ? <><Loader2 size={20} className="animate-spin" /> Processing...</> : 'Split PDF'}
            </button>
          </div>
        )}

        {viewMode === 'pages' && (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
            
            <div>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Extract mode:</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => setExtractMode('all')}
                  style={{ 
                    flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--brand-pink)',
                    background: extractMode === 'all' ? 'rgba(255,0,234,0.1)' : 'transparent',
                    color: extractMode === 'all' ? 'var(--brand-pink)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Extract all pages
                </button>
                <button 
                  onClick={() => setExtractMode('select')}
                  style={{ 
                    flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ef4444',
                    background: extractMode === 'select' ? 'rgba(239,68,68,0.1)' : 'transparent',
                    color: extractMode === 'select' ? '#ef4444' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Select pages
                </button>
              </div>
            </div>

            {extractMode === 'select' && (
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Pages to extract:</label>
                <input 
                  type="text" 
                  value={extractInputStr}
                  onChange={handleExtractInputChange}
                  placeholder="e.g. 1, 3-5"
                  style={{ 
                    width: '100%', boxSizing: 'border-box', padding: '0.75rem', 
                    background: 'var(--bg-main)', border: '1px solid var(--glass-border)', 
                    borderRadius: '4px', color: 'white', fontSize: '1rem',
                    outline: 'none'
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input 
                type="checkbox" 
                id="mergeExtract" 
                checked={mergeExtract} 
                onChange={(e) => setMergeExtract(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--brand-cyan)' }}
              />
              <label htmlFor="mergeExtract" style={{ cursor: 'pointer', userSelect: 'none' }}>
                Merge extracted pages into one PDF file.
              </label>
            </div>

            <div style={{ 
              background: 'rgba(56, 189, 248, 0.1)', 
              border: '1px solid rgba(56, 189, 248, 0.3)', 
              borderRadius: '8px', 
              padding: '1rem', 
              color: '#38bdf8', 
              display: 'flex', 
              gap: '0.5rem' 
            }}>
              <Info size={20} style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                Selected pages will be converted into {mergeExtract ? 'one' : 'separate'} PDF file{mergeExtract ? '' : 's'}.<br/>
                <strong>{generatedFilesCount} PDF{(generatedFilesCount !== 1) ? 's' : ''}</strong> will be created.
              </div>
            </div>

            <button 
              onClick={handleSplitPdf}
              disabled={isProcessing}
              style={{ 
                width: '100%', padding: '1rem', background: '#E53935', color: 'white', 
                border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', 
                cursor: isProcessing ? 'not-allowed' : 'pointer', marginTop: 'auto',
                boxShadow: '0 4px 12px rgba(229, 57, 53, 0.3)',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
                opacity: isProcessing ? 0.7 : 1
              }}
            >
              {isProcessing ? <><Loader2 size={20} className="animate-spin" /> Processing...</> : 'Split PDF'}
            </button>
          </div>
        )}

        {viewMode === 'size' && (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
            <div>
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)' }}>
                <strong>Original file size:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                <strong>Total pages:</strong> {numPages}
              </p>
            </div>
            
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Maximum size per file:</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input 
                  type="number" 
                  value={maxSizeStr}
                  onChange={(e) => setMaxSizeStr(e.target.value)}
                  style={{ 
                    flex: 1, boxSizing: 'border-box', padding: '0.75rem', 
                    background: 'var(--bg-main)', border: '1px solid var(--glass-border)', 
                    borderRadius: '4px', color: 'white', fontSize: '1rem',
                    outline: 'none', minWidth: 0
                  }}
                />
                <div style={{ display: 'flex', background: 'var(--bg-main)', border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <button 
                    onClick={() => setSizeUnit('KB')}
                    style={{ 
                      padding: '0.5rem 1rem', border: 'none', cursor: 'pointer', fontWeight: 'bold',
                      background: sizeUnit === 'KB' ? 'white' : 'transparent',
                      color: sizeUnit === 'KB' ? 'black' : 'var(--text-muted)',
                      transition: 'all 0.2s'
                    }}
                  >
                    KB
                  </button>
                  <button 
                    onClick={() => setSizeUnit('MB')}
                    style={{ 
                      padding: '0.5rem 1rem', border: 'none', cursor: 'pointer', fontWeight: 'bold',
                      background: sizeUnit === 'MB' ? 'white' : 'transparent',
                      color: sizeUnit === 'MB' ? 'black' : 'var(--text-muted)',
                      transition: 'all 0.2s'
                    }}
                  >
                    MB
                  </button>
                </div>
              </div>
            </div>

            <div style={{ 
              background: 'rgba(56, 189, 248, 0.1)', 
              border: '1px solid rgba(56, 189, 248, 0.3)', 
              borderRadius: '8px', 
              padding: '1rem', 
              color: '#38bdf8', 
              display: 'flex', 
              gap: '0.5rem' 
            }}>
              <Info size={20} style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                This PDF will be split into files no larger than {maxSizeStr || 0} {sizeUnit} each.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input 
                type="checkbox" 
                id="allowCompression" 
                checked={allowCompression} 
                onChange={(e) => setAllowCompression(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--brand-cyan)' }}
              />
              <label htmlFor="allowCompression" style={{ cursor: 'pointer', userSelect: 'none' }}>
                Allow compression
              </label>
            </div>

            <button 
              style={{ 
                width: '100%', padding: '1rem', background: '#E53935', color: 'white', 
                border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', 
                cursor: 'pointer', marginTop: 'auto',
                boxShadow: '0 4px 12px rgba(229, 57, 53, 0.3)'
              }}
            >
              Split PDF
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

interface PdfCanvasProps {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale?: number;
  fixedWidth?: number;
}

function PdfCanvas({ pdf, pageNumber, scale = 1.0, fixedWidth }: PdfCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    let renderTask: pdfjsLib.RenderTask | null = null;
    
    const renderPage = async () => {
      const page = await pdf.getPage(pageNumber);
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      let finalScale = scale;
      
      if (fixedWidth) {
        finalScale = fixedWidth / unscaledViewport.width;
      }
      
      const viewport = page.getViewport({ scale: finalScale });
      const context = canvas.getContext('2d');
      if (!context) return;
      
      const outputScale = window.devicePixelRatio || 1;
      
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = Math.floor(viewport.width) + "px";
      canvas.style.height = Math.floor(viewport.height) + "px";
      
      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
      
      const renderContext = {
        canvasContext: context,
        canvas: canvas,
        transform: transform as number[] | undefined,
        viewport: viewport,
      };
      
      renderTask = page.render(renderContext);
      try {
        await renderTask.promise;
      } catch (err) {
        if (err instanceof pdfjsLib.RenderingCancelledException) {
          // ignore
        } else {
          console.error(err);
        }
      }
    };
    
    renderPage();
    
    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdf, pageNumber, scale, fixedWidth]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        maxWidth: '100%', 
        height: 'auto', 
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '4px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        backgroundColor: 'white'
      }} 
    />
  );
}
