'use client';

import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  FiFile,
  FiChevronRight,
  FiChevronDown,
  BsFolderFill,
  BsFolder2Open,
  SiJavascript,
  SiReact,
  SiCss3,
  SiJson,
} from '@/lib/icons';
import type { GenerationProgress } from '../types';

interface CodePanelProps {
  generationProgress: GenerationProgress;
  expandedFolders: Set<string>;
  toggleFolder: (folderPath: string) => void;
  selectedFile: string | null;
  setSelectedFile: (file: string | null) => void;
  handleFileClick: (filePath: string) => void;
  codeDisplayRef: React.RefObject<HTMLDivElement | null>;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'jsx' || ext === 'js') {
    return <SiJavascript style={{ width: '16px', height: '16px' }} className="text-yellow-500" />;
  } else if (ext === 'tsx' || ext === 'ts') {
    return <SiReact style={{ width: '16px', height: '16px' }} className="text-blue-500" />;
  } else if (ext === 'css') {
    return <SiCss3 style={{ width: '16px', height: '16px' }} className="text-blue-500" />;
  } else if (ext === 'json') {
    return <SiJson style={{ width: '16px', height: '16px' }} className="text-gray-600" />;
  } else {
    return <FiFile style={{ width: '16px', height: '16px' }} className="text-gray-600" />;
  }
}

function getFileSyntaxLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'css') return 'css';
  if (ext === 'json') return 'json';
  if (ext === 'html') return 'html';
  return 'jsx';
}

function getFileTypeBadgeClass(type: string): string {
  if (type === 'css') return 'bg-blue-600 text-white';
  if (type === 'javascript') return 'bg-yellow-600 text-white';
  if (type === 'json') return 'bg-green-600 text-white';
  return 'bg-gray-200 text-gray-700';
}

export function CodePanel({
  generationProgress,
  expandedFolders,
  toggleFolder,
  selectedFile,
  setSelectedFile,
  handleFileClick,
  codeDisplayRef,
}: CodePanelProps) {
  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {/* File Explorer - Hide during edits */}
      {!generationProgress.isEdit && (
        <div className="w-[250px] border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
          <div className="p-4 bg-gray-100 text-gray-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BsFolderFill style={{ width: '16px', height: '16px' }} />
              <span className="text-sm font-medium">Explorer</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
            <div className="text-sm">
              <div
                className="flex items-center gap-2 py-0.5 px-3 hover:bg-gray-100 rounded cursor-pointer text-gray-700"
                onClick={() => toggleFolder('app')}
              >
                {expandedFolders.has('app') ? (
                  <FiChevronDown style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                ) : (
                  <FiChevronRight style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                )}
                {expandedFolders.has('app') ? (
                  <BsFolder2Open style={{ width: '16px', height: '16px' }} className="text-blue-500" />
                ) : (
                  <BsFolderFill style={{ width: '16px', height: '16px' }} className="text-blue-500" />
                )}
                <span className="font-medium text-gray-800">app</span>
              </div>

              {expandedFolders.has('app') && (
                <div className="ml-6">
                  {(() => {
                    const fileTree: { [key: string]: Array<{ name: string; edited?: boolean }> } = {};

                    generationProgress.files.forEach(file => {
                      const parts = file.path.split('/');
                      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
                      const fileName = parts[parts.length - 1];
                      if (!fileTree[dir]) fileTree[dir] = [];
                      fileTree[dir].push({ name: fileName, edited: file.edited || false });
                    });

                    return Object.entries(fileTree).map(([dir, files]) => (
                      <div key={dir} className="mb-1">
                        {dir && (
                          <div
                            className="flex items-center gap-2 py-0.5 px-3 hover:bg-gray-100 rounded cursor-pointer text-gray-700"
                            onClick={() => toggleFolder(dir)}
                          >
                            {expandedFolders.has(dir) ? (
                              <FiChevronDown style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                            ) : (
                              <FiChevronRight style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                            )}
                            {expandedFolders.has(dir) ? (
                              <BsFolder2Open style={{ width: '16px', height: '16px' }} className="text-yellow-600" />
                            ) : (
                              <BsFolderFill style={{ width: '16px', height: '16px' }} className="text-yellow-600" />
                            )}
                            <span className="text-gray-700">{dir.split('/').pop()}</span>
                          </div>
                        )}
                        {(!dir || expandedFolders.has(dir)) && (
                          <div className={dir ? 'ml-8' : ''}>
                            {files
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map(fileInfo => {
                                const fullPath = dir ? `${dir}/${fileInfo.name}` : fileInfo.name;
                                const isSelected = selectedFile === fullPath;

                                return (
                                  <div
                                    key={fullPath}
                                    className={`flex items-center gap-2 py-0.5 px-3 rounded cursor-pointer transition-all ${
                                      isSelected
                                        ? 'bg-blue-500 text-white'
                                        : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                    onClick={() => handleFileClick(fullPath)}
                                  >
                                    {getFileIcon(fileInfo.name)}
                                    <span className={`text-xs flex items-center gap-1 ${isSelected ? 'font-medium' : ''}`}>
                                      {fileInfo.name}
                                      {fileInfo.edited && (
                                        <span
                                          className={`text-[10px] px-1 rounded ${
                                            isSelected ? 'bg-blue-400' : 'bg-orange-500 text-white'
                                          }`}
                                        >
                                          &#10003;
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Code Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Thinking Mode Display */}
        {generationProgress.isGenerating &&
          (generationProgress.isThinking || generationProgress.thinkingText) && (
            <div className="px-6 pb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-purple-600 font-medium flex items-center gap-2">
                  {generationProgress.isThinking ? (
                    <>
                      <div className="w-3 h-3 bg-purple-600 rounded-full animate-pulse" />
                      AI is thinking...
                    </>
                  ) : (
                    <>
                      <span className="text-purple-600">&#10003;</span>
                      Thought for {generationProgress.thinkingDuration || 0} seconds
                    </>
                  )}
                </div>
              </div>
              {generationProgress.thinkingText && (
                <div className="bg-purple-950 border border-purple-700 rounded-lg p-4 max-h-48 overflow-y-auto scrollbar-hide">
                  <pre className="text-xs font-mono text-purple-300 whitespace-pre-wrap">
                    {generationProgress.thinkingText}
                  </pre>
                </div>
              )}
            </div>
          )}

        {/* Live Code Display */}
        <div className="flex-1 rounded-lg p-6 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide" ref={codeDisplayRef}>
            {selectedFile ? (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="bg-black border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getFileIcon(selectedFile)}
                      <span className="font-mono text-sm">{selectedFile}</span>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      data-testid="generation-close-file-btn"
                      className="hover:bg-black/20 p-1 rounded transition-colors"
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="bg-gray-900 border border-gray-700 rounded">
                    <SyntaxHighlighter
                      language={getFileSyntaxLanguage(selectedFile)}
                      style={vscDarkPlus}
                      customStyle={{ margin: 0, padding: '1rem', fontSize: '0.875rem', background: 'transparent' }}
                      showLineNumbers={true}
                    >
                      {generationProgress.files.find(f => f.path === selectedFile)?.content ||
                        '// File content will appear here'}
                    </SyntaxHighlighter>
                  </div>
                </div>
              </div>
            ) : generationProgress.files.length === 0 && !generationProgress.currentFile ? (
              generationProgress.isThinking ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="mb-8 relative">
                      <div className="w-48 h-48 mx-auto">
                        <div className="absolute inset-0 border-8 border-gray-800 rounded-full"></div>
                        <div className="absolute inset-0 border-8 border-green-500 rounded-full animate-spin border-t-transparent"></div>
                      </div>
                    </div>
                    <h3 className="text-xl font-medium text-white mb-2">AI is analyzing your request</h3>
                    <p className="text-gray-400 text-sm">
                      {generationProgress.status || 'Preparing to generate code...'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-black border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-gray-100 text-gray-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-16 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      <span className="font-mono text-sm">Streaming code...</span>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-900 rounded">
                    <SyntaxHighlighter
                      language="jsx"
                      style={vscDarkPlus}
                      customStyle={{ margin: 0, padding: '1rem', fontSize: '0.875rem', background: 'transparent' }}
                      showLineNumbers={true}
                    >
                      {generationProgress.streamedCode || 'Starting code generation...'}
                    </SyntaxHighlighter>
                    <span className="inline-block w-3 h-5 bg-orange-400 ml-1 animate-pulse" />
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-4">
                {generationProgress.currentFile && (
                  <div className="bg-black border-2 border-gray-400 rounded-lg overflow-hidden shadow-sm">
                    <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-16 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span className="font-mono text-sm">{generationProgress.currentFile.path}</span>
                        <span className={`px-2 py-0.5 text-xs rounded ${getFileTypeBadgeClass(generationProgress.currentFile.type)}`}>
                          {generationProgress.currentFile.type === 'javascript'
                            ? 'JSX'
                            : generationProgress.currentFile.type.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-900 border border-gray-700 rounded">
                      <SyntaxHighlighter
                        language={
                          generationProgress.currentFile.type === 'css'
                            ? 'css'
                            : generationProgress.currentFile.type === 'json'
                            ? 'json'
                            : generationProgress.currentFile.type === 'html'
                            ? 'html'
                            : 'jsx'
                        }
                        style={vscDarkPlus}
                        customStyle={{ margin: 0, padding: '1rem', fontSize: '0.75rem', background: 'transparent' }}
                        showLineNumbers={true}
                      >
                        {generationProgress.currentFile.content}
                      </SyntaxHighlighter>
                      <span className="inline-block w-3 h-4 bg-orange-400 ml-4 mb-4 animate-pulse" />
                    </div>
                  </div>
                )}

                {generationProgress.files.map((file, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-green-500">&#10003;</span>
                        <span className="font-mono text-sm">{file.path}</span>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded ${getFileTypeBadgeClass(file.type)}`}>
                        {file.type === 'javascript' ? 'JSX' : file.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="bg-gray-900 border border-gray-700 max-h-48 overflow-y-auto scrollbar-hide">
                      <SyntaxHighlighter
                        language={
                          file.type === 'css'
                            ? 'css'
                            : file.type === 'json'
                            ? 'json'
                            : file.type === 'html'
                            ? 'html'
                            : 'jsx'
                        }
                        style={vscDarkPlus}
                        customStyle={{ margin: 0, padding: '1rem', fontSize: '0.75rem', background: 'transparent' }}
                        showLineNumbers={true}
                        wrapLongLines={true}
                      >
                        {file.content}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                ))}

                {!generationProgress.currentFile && generationProgress.streamedCode.length > 0 && (
                  <div className="bg-black border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-16 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        <span className="font-mono text-sm">Processing...</span>
                      </div>
                    </div>
                    <div className="bg-gray-900 border border-gray-700 rounded">
                      <SyntaxHighlighter
                        language="jsx"
                        style={vscDarkPlus}
                        customStyle={{ margin: 0, padding: '1rem', fontSize: '0.75rem', background: 'transparent' }}
                        showLineNumbers={false}
                      >
                        {(() => {
                          const lastFileEnd =
                            generationProgress.files.length > 0
                              ? generationProgress.streamedCode.lastIndexOf('</file>') + 7
                              : 0;
                          let remainingContent = generationProgress.streamedCode.slice(lastFileEnd).trim();
                          remainingContent = remainingContent
                            .replace(/<explanation>[\s\S]*?<\/explanation>/g, '')
                            .trim();
                          return remainingContent || 'Loading sandbox...';
                        })()}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Progress indicator */}
        {generationProgress.components.length > 0 && (
          <div className="mx-6 mb-6">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-300"
                style={{
                  width: `${
                    (generationProgress.currentComponent /
                      Math.max(generationProgress.components.length, 1)) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
