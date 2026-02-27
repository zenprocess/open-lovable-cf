'use client';

import React from 'react';
import type { SandboxData } from '../types';
import type { CodeApplicationState } from '@/components/CodeApplicationProgress';
import type { GenerationProgress } from '../types';

interface SandboxFrameProps {
  sandboxData: SandboxData | null;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  urlScreenshot: string | null;
  isScreenshotLoaded: boolean;
  setIsScreenshotLoaded: (v: boolean) => void;
  isCapturingScreenshot: boolean;
  isPreparingDesign: boolean;
  loadingStage: 'gathering' | 'planning' | 'generating' | null;
  loading: boolean;
  generationProgress: GenerationProgress;
  isStartingNewGeneration: boolean;
  screenshotError: string | null;
  codeApplicationState: CodeApplicationState;
}

export function SandboxFrame({
  sandboxData,
  iframeRef,
  urlScreenshot,
  isScreenshotLoaded,
  setIsScreenshotLoaded,
  isCapturingScreenshot,
  isPreparingDesign,
  loadingStage,
  loading,
  generationProgress,
  isStartingNewGeneration,
  screenshotError,
  codeApplicationState,
}: SandboxFrameProps) {
  const isInitialGeneration =
    !sandboxData?.url && (urlScreenshot || isCapturingScreenshot || isPreparingDesign || loadingStage);
  const isNewGenerationWithSandbox = isStartingNewGeneration && sandboxData?.url;
  const shouldShowLoadingOverlay =
    (isInitialGeneration || isNewGenerationWithSandbox) &&
    (loading || generationProgress.isGenerating || isPreparingDesign || loadingStage || isCapturingScreenshot || isStartingNewGeneration);

  if (isInitialGeneration || isNewGenerationWithSandbox) {
    return (
      <div className="relative w-full h-full bg-gray-900">
        {urlScreenshot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlScreenshot}
            alt="Website preview"
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            style={{ opacity: isScreenshotLoaded ? 1 : 0, willChange: 'opacity' }}
            onLoad={() => setIsScreenshotLoaded(true)}
            loading="eager"
          />
        )}

        {shouldShowLoadingOverlay && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
            <div className="text-center max-w-md">
              <div className="mb-6 space-y-3">
                <div
                  className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse"
                  style={{ animationDuration: '1.5s', animationDelay: '0s' }}
                />
                <div
                  className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse w-4/5 mx-auto"
                  style={{ animationDuration: '1.5s', animationDelay: '0.2s' }}
                />
                <div
                  className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse w-3/5 mx-auto"
                  style={{ animationDuration: '1.5s', animationDelay: '0.4s' }}
                />
              </div>

              <p className="text-white text-lg font-medium">
                {isCapturingScreenshot
                  ? 'Analyzing website...'
                  : isPreparingDesign
                  ? 'Preparing design...'
                  : generationProgress.isGenerating
                  ? 'Generating code...'
                  : 'Loading...'}
              </p>

              <p className="text-white/60 text-sm mt-2">
                {isCapturingScreenshot
                  ? 'Taking a screenshot of the site'
                  : isPreparingDesign
                  ? 'Understanding the layout and structure'
                  : generationProgress.isGenerating
                  ? 'Writing React components'
                  : 'Please wait...'}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (sandboxData?.url) {
    return (
      <div className="relative w-full h-full">
        <iframe
          ref={iframeRef as React.RefObject<HTMLIFrameElement>}
          src={sandboxData.url}
          className="w-full h-full border-none"
          title="Open Lovable Sandbox"
          allow="clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />

        {codeApplicationState.stage && codeApplicationState.stage !== 'complete' && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-center max-w-md">
              <div className="mb-6">
                {codeApplicationState.stage === 'installing' ? (
                  <div className="w-16 h-16 mx-auto">
                    <svg className="w-full h-full animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </div>
                ) : null}
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {codeApplicationState.stage === 'analyzing' && 'Analyzing code...'}
                {codeApplicationState.stage === 'installing' && 'Installing packages...'}
                {codeApplicationState.stage === 'applying' && 'Applying changes...'}
              </h3>

              {codeApplicationState.stage === 'installing' && codeApplicationState.packages && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2 justify-center">
                    {codeApplicationState.packages.map((pkg, index) => (
                      <span
                        key={index}
                        className={`px-2 py-1 text-xs rounded-full transition-all ${
                          codeApplicationState.installedPackages?.includes(pkg)
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {pkg}
                        {codeApplicationState.installedPackages?.includes(pkg) && (
                          <span className="ml-1">&#10003;</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {codeApplicationState.stage === 'applying' && codeApplicationState.filesGenerated && (
                <div className="text-sm text-gray-600">
                  Creating {codeApplicationState.filesGenerated.length} files...
                </div>
              )}

              <p className="text-sm text-gray-500 mt-2">
                {codeApplicationState.stage === 'analyzing' &&
                  'Parsing generated code and detecting dependencies...'}
                {codeApplicationState.stage === 'installing' &&
                  'This may take a moment while npm installs the required packages...'}
                {codeApplicationState.stage === 'applying' &&
                  'Writing files to your sandbox environment...'}
              </p>
            </div>
          </div>
        )}

        {generationProgress.isGenerating && generationProgress.isEdit && !codeApplicationState.stage && (
          <div className="absolute top-4 right-4 inline-flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-white text-xs font-medium">Generating code...</span>
          </div>
        )}

        <button
          onClick={() => {
            if (iframeRef.current && sandboxData?.url) {
              const newSrc = `${sandboxData.url}?t=${Date.now()}&manual=true`;
              iframeRef.current.src = newSrc;
            }
          }}
          data-testid="generation-refresh-sandbox-btn"
          className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-gray-700 p-2 rounded-lg shadow-lg transition-all duration-200 hover:scale-105"
          title="Refresh sandbox"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
    );
  }

  // Default empty state
  return (
    <div className="flex items-center justify-center h-full bg-gray-50 text-gray-600 text-lg">
      {screenshotError ? (
        <div className="text-center">
          <p className="mb-2">Failed to capture screenshot</p>
          <p className="text-sm text-gray-500">{screenshotError}</p>
        </div>
      ) : sandboxData ? (
        <div className="text-gray-500">
          <div className="w-16 h-16 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading preview...</p>
        </div>
      ) : (
        <div className="text-gray-500 text-center">
          <p className="text-sm">Start chatting to create your first app</p>
        </div>
      )}
    </div>
  );
}
