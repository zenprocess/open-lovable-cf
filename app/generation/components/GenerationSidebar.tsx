'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import HeroInput from '@/components/HeroInput';
import SidebarInput from '@/components/app/generation/SidebarInput';
import CodeApplicationProgress from '@/components/CodeApplicationProgress';
import type { ChatMessage, GenerationProgress, ConversationContext, SandboxData } from '../types';
import type { CodeApplicationState } from '@/components/CodeApplicationProgress';

interface GenerationSidebarProps {
  hasInitialSubmission: boolean;
  loading: boolean;
  generationProgress: GenerationProgress;
  conversationContext: ConversationContext;
  chatMessages: ChatMessage[];
  chatMessagesRef: React.RefObject<HTMLDivElement | null>;
  codeApplicationState: CodeApplicationState;
  sandboxData: SandboxData | null;
  projectLoading: boolean;
  projectInstructions: string;
  setProjectInstructions: React.Dispatch<React.SetStateAction<string>>;
  instructionsExpanded: boolean;
  setInstructionsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  instructionsDirty: boolean;
  setInstructionsDirty: React.Dispatch<React.SetStateAction<boolean>>;
  screenshotCollapsed: boolean;
  setScreenshotCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  aiChatInput: string;
  setAiChatInput: React.Dispatch<React.SetStateAction<string>>;
  sendChatMessage: () => Promise<void>;
  setHomeUrlInput: React.Dispatch<React.SetStateAction<string>>;
  setHomeContextInput: React.Dispatch<React.SetStateAction<string>>;
  startGeneration: () => Promise<void>;
  saveInstructions: () => void;
}

function BrandingDisplay({ brandingData, sourceUrl }: { brandingData: unknown; sourceUrl?: string }) {
  const bd = brandingData as Record<string, unknown>;
  const colorScheme = (bd.colorScheme as string) || '';
  const colorsRaw = bd.colors as Record<string, unknown> | undefined;
  const colors = colorsRaw || {};
  const typographyRaw = bd.typography as Record<string, unknown> | undefined;
  const typography = typographyRaw || {};
  const spacingRaw = bd.spacing as Record<string, unknown> | undefined;
  const spacing = spacingRaw || {};
  const componentsRaw = bd.components as Record<string, unknown> | undefined;
  const components = componentsRaw || {};
  const personalityRaw = bd.personality as Record<string, unknown> | undefined;
  const personality = personalityRaw || {};

  const primaryColor = (colors.primary as string) || '';
  const secondaryColor = (colors.secondary as string) || '';
  const accentColor = (colors.accent as string) || '';
  const backgroundColorVal = (colors.background as string) || '';
  const textColorVal = (colors.text as string) || '';

  const fontFamily = (typography.fontFamily as string) || '';
  const fontSize = (typography.fontSize as string) || '';
  const fontWeight = (typography.fontWeight as string) || '';

  const borderRadius = (spacing.borderRadius as string) || '';
  const padding = (spacing.padding as string) || '';

  const buttonStyle = (components.button as string) || '';
  const cardStyle = (components.card as string) || '';

  const tone = (personality.tone as string) || '';
  const style = (personality.style as string) || '';

  return (
    <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="text-xs font-semibold text-gray-700 mb-2">Brand Analysis</div>
      {sourceUrl && (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline block mb-2 truncate">
          {sourceUrl}
        </a>
      )}
      {colorScheme && <div className="text-xs text-gray-600 mb-1">Color Scheme: <span className="font-medium">{colorScheme}</span></div>}
      {(primaryColor || secondaryColor || accentColor || backgroundColorVal || textColorVal) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {primaryColor && <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: primaryColor }} /><span className="text-xs text-gray-500">Primary</span></div>}
          {secondaryColor && <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: secondaryColor }} /><span className="text-xs text-gray-500">Secondary</span></div>}
          {accentColor && <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: accentColor }} /><span className="text-xs text-gray-500">Accent</span></div>}
          {backgroundColorVal && <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: backgroundColorVal }} /><span className="text-xs text-gray-500">BG</span></div>}
          {textColorVal && <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: textColorVal }} /><span className="text-xs text-gray-500">Text</span></div>}
        </div>
      )}
      {(fontFamily || fontSize || fontWeight) && (
        <div className="text-xs text-gray-600 mb-1">
          Typography:{fontFamily && ` ${fontFamily}`}{fontSize && ` ${fontSize}`}{fontWeight && ` ${fontWeight}`}
        </div>
      )}
      {(borderRadius || padding) && (
        <div className="text-xs text-gray-600 mb-1">
          Spacing:{borderRadius && ` radius:${borderRadius}`}{padding && ` padding:${padding}`}
        </div>
      )}
      {(buttonStyle || cardStyle) && (
        <div className="text-xs text-gray-600 mb-1">
          Components:{buttonStyle && ` btn:${buttonStyle}`}{cardStyle && ` card:${cardStyle}`}
        </div>
      )}
      {(tone || style) && (
        <div className="text-xs text-gray-600">
          Personality:{tone && ` ${tone}`}{style && ` ${style}`}
        </div>
      )}
    </div>
  );
}

export function GenerationSidebar({
  hasInitialSubmission,
  loading,
  generationProgress,
  conversationContext,
  chatMessages,
  chatMessagesRef,
  codeApplicationState,
  sandboxData,
  projectLoading,
  projectInstructions,
  setProjectInstructions,
  instructionsExpanded,
  setInstructionsExpanded,
  instructionsDirty,
  setInstructionsDirty,
  screenshotCollapsed,
  setScreenshotCollapsed,
  aiChatInput,
  setAiChatInput,
  sendChatMessage,
  setHomeUrlInput,
  setHomeContextInput,
  startGeneration,
  saveInstructions,
}: GenerationSidebarProps) {
  return (
    <div className="flex-1 max-w-[400px] flex flex-col border-r border-border bg-background">
      {/* Sidebar Input */}
      {!hasInitialSubmission ? (
        <div className="p-4 border-b border-border">
          <SidebarInput
            onSubmit={(url, style, model, instructions) => {
              sessionStorage.setItem('targetUrl', url);
              sessionStorage.setItem('selectedStyle', style);
              sessionStorage.setItem('selectedModel', model);
              if (instructions) {
                sessionStorage.setItem('additionalInstructions', instructions);
              }
              sessionStorage.setItem('autoStart', 'true');
              setHomeUrlInput(url);
              setHomeContextInput(instructions || '');
              startGeneration();
            }}
            disabled={loading || generationProgress.isGenerating}
          />
        </div>
      ) : null}

      {/* Scraped websites */}
      {conversationContext.scrapedWebsites.length > 0 && (
        <div className="p-4 bg-card border-b border-gray-200">
          <div className="flex flex-col gap-4">
            {conversationContext.scrapedWebsites.map((site, idx) => {
              const metadata = (site.content as Record<string, unknown>)?.metadata as Record<string, string> | undefined;
              const sourceURL = metadata?.sourceURL || site.url;
              let hostname = site.url;
              try { hostname = new URL(sourceURL).hostname; } catch { /* ignore */ }
              const favicon = metadata?.favicon || `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
              const siteName = metadata?.ogSiteName || metadata?.title || hostname;
              const contentRecord = site.content as Record<string, unknown>;
              const screenshot = (contentRecord?.screenshot as string) || sessionStorage.getItem('websiteScreenshot');

              return (
                <div key={idx} className="flex flex-col gap-3">
                  <div className="flex items-center gap-4 text-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={favicon}
                      alt={siteName}
                      className="w-16 h-16 rounded"
                      onError={(e) => {
                        e.currentTarget.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
                      }}
                    />
                    <a
                      href={sourceURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="generation-source-url-link"
                      className="text-black hover:text-gray-700 truncate max-w-[250px] font-medium"
                      title={sourceURL}
                    >
                      {siteName}
                    </a>
                  </div>

                  {screenshot && (
                    <div className="w-full">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600">Screenshot Preview</span>
                        <button
                          onClick={() => setScreenshotCollapsed(!screenshotCollapsed)}
                          data-testid="generation-screenshot-collapse-btn"
                          className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                          aria-label={screenshotCollapsed ? 'Expand screenshot' : 'Collapse screenshot'}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className={`transition-transform duration-300 ${screenshotCollapsed ? 'rotate-180' : ''}`}
                          >
                            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                      <div
                        className="w-full rounded-lg overflow-hidden border border-gray-200 transition-all duration-300"
                        style={{
                          opacity: screenshotCollapsed ? 0 : 1,
                          transform: screenshotCollapsed ? 'translateY(-20px)' : 'translateY(0)',
                          pointerEvents: screenshotCollapsed ? 'none' : 'auto',
                          maxHeight: screenshotCollapsed ? '0' : '200px',
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={screenshot}
                          alt={`${siteName} preview`}
                          className="w-full h-auto object-cover"
                          style={{ maxHeight: '200px' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div
        className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 scrollbar-hide"
        ref={chatMessagesRef}
      >
        {chatMessages.map((msg, idx) => {
          const isGenerationComplete =
            msg.content.includes('Successfully recreated') ||
            msg.content.includes('AI recreation generated!') ||
            msg.content.includes('Code generated!');

          return (
            <div key={idx} className="block">
              <div className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="block">
                  <div
                    className={`block rounded-[10px] px-14 py-8 ${
                      msg.type === 'user'
                        ? 'bg-[#36322F] text-white ml-auto max-w-[80%]'
                        : msg.type === 'ai'
                        ? 'bg-gray-100 text-gray-900 mr-auto max-w-[80%]'
                        : msg.type === 'system'
                        ? 'bg-[#36322F] text-white text-sm'
                        : msg.type === 'command'
                        ? 'bg-[#36322F] text-white font-mono text-sm'
                        : msg.type === 'error'
                        ? 'bg-red-900 text-red-100 text-sm border border-red-700'
                        : 'bg-[#36322F] text-white text-sm'
                    }`}
                  >
                    {msg.type === 'command' ? (
                      <div className="flex items-start gap-2">
                        <span
                          className={`text-xs ${
                            msg.metadata?.commandType === 'input'
                              ? 'text-blue-400'
                              : msg.metadata?.commandType === 'error'
                              ? 'text-red-400'
                              : msg.metadata?.commandType === 'success'
                              ? 'text-green-400'
                              : 'text-gray-400'
                          }`}
                        >
                          {msg.metadata?.commandType === 'input' ? '$' : '>'}
                        </span>
                        <span className="flex-1 whitespace-pre-wrap text-white">{msg.content}</span>
                      </div>
                    ) : msg.type === 'error' ? (
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-red-800 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold mb-1">Build Errors Detected</div>
                          <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                          <div className="mt-2 text-xs opacity-70">Press &apos;F&apos; or click the Fix button above to resolve</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm">{msg.content}</span>
                    )}
                  </div>

                  {/* Branding data display */}
                  {msg.metadata?.brandingData != null && <BrandingDisplay brandingData={msg.metadata.brandingData} sourceUrl={msg.metadata.sourceUrl} />}

                  {/* Applied files */}
                  {msg.metadata?.appliedFiles && msg.metadata.appliedFiles.length > 0 && (
                    <div className="mt-3 inline-block bg-gray-100 rounded-[10px] p-5">
                      <div className="text-sm font-medium mb-3 text-gray-700">
                        {msg.content.includes('Applied') ? 'Files Updated:' : 'Generated Files:'}
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        {msg.metadata.appliedFiles.map((filePath, fileIdx) => {
                          const fileName = filePath.split('/').pop() || filePath;
                          const fileExt = fileName.split('.').pop() || '';
                          const fileType =
                            fileExt === 'jsx' || fileExt === 'js'
                              ? 'javascript'
                              : fileExt === 'css'
                              ? 'css'
                              : fileExt === 'json'
                              ? 'json'
                              : 'text';
                          return (
                            <div
                              key={`applied-${fileIdx}`}
                              className="inline-flex items-center gap-1.5 px-6 py-1.5 bg-[#36322F] text-white rounded-[10px] text-sm animate-fade-in-up"
                              style={{ animationDelay: `${fileIdx * 30}ms` }}
                            >
                              <span
                                className={`inline-block w-1.5 h-1.5 rounded-full ${
                                  fileType === 'css'
                                    ? 'bg-blue-400'
                                    : fileType === 'javascript'
                                    ? 'bg-yellow-400'
                                    : fileType === 'json'
                                    ? 'bg-green-400'
                                    : 'bg-gray-400'
                                }`}
                              />
                              {fileName}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Generation complete files */}
                  {isGenerationComplete &&
                    generationProgress.files.length > 0 &&
                    idx === chatMessages.length - 1 &&
                    !msg.metadata?.appliedFiles &&
                    !chatMessages.some(m => m.metadata?.appliedFiles) && (
                      <div className="mt-2 inline-block bg-gray-100 rounded-[10px] p-3">
                        <div className="text-xs font-medium mb-1 text-gray-700">Generated Files:</div>
                        <div className="flex flex-wrap items-start gap-1">
                          {generationProgress.files.map((file, fileIdx) => (
                            <div
                              key={`complete-${fileIdx}`}
                              className="inline-flex items-center gap-1.5 px-6 py-1.5 bg-[#36322F] text-white rounded-[10px] text-xs animate-fade-in-up"
                              style={{ animationDelay: `${fileIdx * 30}ms` }}
                            >
                              <span
                                className={`inline-block w-1.5 h-1.5 rounded-full ${
                                  file.type === 'css'
                                    ? 'bg-blue-400'
                                    : file.type === 'javascript'
                                    ? 'bg-yellow-400'
                                    : file.type === 'json'
                                    ? 'bg-green-400'
                                    : 'bg-gray-400'
                                }`}
                              />
                              {file.path.split('/').pop()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Code application progress */}
        {codeApplicationState.stage && <CodeApplicationProgress state={codeApplicationState} />}

        {/* File generation progress inline */}
        {generationProgress.isGenerating && (
          <div className="inline-block bg-gray-100 rounded-lg p-3">
            <div className="text-sm font-medium mb-2 text-gray-700">{generationProgress.status}</div>
            <div className="flex flex-wrap items-start gap-1">
              {generationProgress.files.map((file, fileIdx) => (
                <div
                  key={`file-${fileIdx}`}
                  className="inline-flex items-center gap-1.5 px-6 py-1.5 bg-[#36322F] text-white rounded-[10px] text-xs animate-fade-in-up"
                  style={{ animationDelay: `${fileIdx * 30}ms` }}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  {file.path.split('/').pop()}
                </div>
              ))}

              {generationProgress.currentFile && (
                <div
                  className="flex items-center gap-1 px-2 py-1 bg-[#36322F]/70 text-white rounded-[10px] text-sm animate-pulse"
                  style={{ animationDelay: `${generationProgress.files.length * 30}ms` }}
                >
                  <div className="w-16 h-16 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {generationProgress.currentFile.path.split('/').pop()}
                </div>
              )}
            </div>

            {generationProgress.streamedCode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-3 border-t border-gray-300 pt-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-gray-600">AI Response Stream</span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent" />
                </div>
                <div className="bg-gray-900 border border-gray-700 rounded max-h-128 overflow-y-auto scrollbar-hide">
                  <SyntaxHighlighter
                    language="jsx"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: '0.75rem',
                      fontSize: '11px',
                      lineHeight: '1.5',
                      background: 'transparent',
                      maxHeight: '8rem',
                      overflow: 'hidden',
                    }}
                  >
                    {(() => {
                      const lastContent = generationProgress.streamedCode.slice(-1000);
                      const startIndex = lastContent.indexOf('<');
                      return startIndex !== -1 ? lastContent.slice(startIndex) : lastContent;
                    })()}
                  </SyntaxHighlighter>
                  <span className="inline-block w-3 h-4 bg-orange-400 ml-3 mb-3 animate-pulse" />
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Sandbox + project loading indicator */}
      {(!sandboxData || projectLoading) && (
        <div className="border-t border-border bg-background-base px-4 py-2 flex items-center gap-2 text-xs text-gray-500">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {!sandboxData ? 'Creating sandbox...' : 'Loading project files...'}
        </div>
      )}

      {/* Project Instructions */}
      <div className="border-t border-border bg-background-base">
        <button
          onClick={() => setInstructionsExpanded(!instructionsExpanded)}
          className="w-full px-4 py-2 flex items-center justify-between text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className={`transition-transform ${instructionsExpanded ? 'rotate-90' : ''}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Project Instructions
            {projectInstructions && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />}
          </span>
          <span className="flex items-center gap-2">
            {instructionsDirty && <span className="text-orange-500 text-[10px]">unsaved</span>}
            <span className="text-[10px] text-gray-400">{projectInstructions.length}/10,000</span>
          </span>
        </button>
        {instructionsExpanded && (
          <div className="px-4 pb-3">
            <textarea
              value={projectInstructions}
              onChange={(e) => {
                if (e.target.value.length <= 10000) {
                  setProjectInstructions(e.target.value);
                  setInstructionsDirty(true);
                }
              }}
              placeholder={
                'Example:\n- Backend API at /api/v1/* (REST, JSON)\n- Use Tailwind only, no inline styles\n- Color palette: blue-600 primary, gray-100 bg\n- Mobile-first responsive design\n- All buttons must have hover states'
              }
              className="w-full h-24 text-xs bg-gray-50 border border-gray-200 rounded-md p-2 resize-y focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-400"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-gray-400">
                {projectInstructions
                  ? 'Included in every AI prompt.'
                  : 'Add constraints, API specs, or design rules. Auto-populated when workers are detected.'}
              </p>
              {instructionsDirty && (
                <button
                  onClick={saveInstructions}
                  className="px-2 py-0.5 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  Save
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chat input */}
      <div className="p-4 border-t border-border bg-background-base">
        <HeroInput
          value={aiChatInput}
          onChange={setAiChatInput}
          onSubmit={sendChatMessage}
          placeholder="Describe what you want to build..."
          showSearchFeatures={false}
        />
      </div>
    </div>
  );
}
