'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { HeaderProvider } from '@/components/shared/header/HeaderContext';
import { useSandbox } from './hooks/useSandbox';
import { useConversation } from './hooks/useConversation';
import { useProjectState } from './hooks/useProjectState';
import { useAIGeneration } from './hooks/useAIGeneration';
import { GenerationHeader } from './components/GenerationHeader';
import { GenerationSidebar } from './components/GenerationSidebar';
import { SandboxFrame } from './components/SandboxFrame';
import { CodePanel } from './components/CodePanel';

function AISandboxPage() {
  const searchParams = useSearchParams();

  // --- Declare all local state first so it can be passed to hooks ---
  const [activeTab, setActiveTab] = useState<'generation' | 'preview'>('preview');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['app', 'src', 'src/components'])
  );
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [urlScreenshot, setUrlScreenshot] = useState<string | null>(null);
  const [isScreenshotLoaded, setIsScreenshotLoaded] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [isPreparingDesign, setIsPreparingDesign] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'gathering' | 'planning' | 'generating' | null>(null);
  const [isStartingNewGeneration, setIsStartingNewGeneration] = useState(false);
  const [screenshotCollapsed, setScreenshotCollapsed] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlStatus, setUrlStatus] = useState<string[]>([]);
  const [showLoadingBackground, setShowLoadingBackground] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedStyle, setSelectedStyle_unused] = useState<string | null>(null);

  // Keep a ref to setActiveTab for use inside hooks before their stable reference is ready
  const setActiveTabRef = useRef(setActiveTab);
  useEffect(() => { setActiveTabRef.current = setActiveTab; }, []);

  // --- Hooks --- (order matters: conversation + project state before sandbox)
  const {
    chatMessages,
    setChatMessages,
    aiChatInput,
    setAiChatInput,
    conversationContext,
    setConversationContext,
    chatMessagesRef,
    addChatMessage,
  } = useConversation();

  const {
    projectInstructions,
    setProjectInstructions,
    instructionsExpanded,
    setInstructionsExpanded,
    instructionsDirty,
    setInstructionsDirty,
    hasPreloadedProject,
    setHasPreloadedProject,
    projectLoading,
    setProjectLoading,
    aiModel,
    setAiModel,
    hasInitialSubmission,
    setHasInitialSubmission,
    homeUrlInput,
    setHomeUrlInput,
    homeContextInput,
    setHomeContextInput,
    showHomeScreen,
    setShowHomeScreen,
    homeScreenFading: _homeScreenFading,
    setHomeScreenFading,
    shouldAutoGenerate,
    setShouldAutoGenerate,
    saveInstructions,
  } = useProjectState();

  const {
    sandboxData,
    setSandboxData,
    loading,
    setLoading,
    structureContent,
    iframeRef,
    log,
    createSandbox,
    checkSandboxStatus,
    fetchSandboxFiles,
  } = useSandbox(aiModel, addChatMessage);

  const {
    generationProgress,
    setGenerationProgress,
    codeApplicationState,
    codeDisplayRef,
    applyGeneratedCode,
    sendChatMessage,
    reapplyLastGeneration,
    downloadZip,
  } = useAIGeneration(
    sandboxData,
    setSandboxData,
    iframeRef,
    aiModel,
    aiChatInput,
    setAiChatInput,
    loading,
    setLoading,
    conversationContext,
    setConversationContext,
    hasPreloadedProject,
    structureContent,
    chatMessages,
    setChatMessages,
    addChatMessage,
    log,
    fetchSandboxFiles,
    setActiveTab,
    createSandbox,
  );

  // --- Mount initialization ---
  useEffect(() => {
    let isMounted = true;
    let sandboxCreated = false;

    const initializePage = async () => {
      if (sandboxCreated) return;

      const urlParam = searchParams.get('url');
      const templateParam = searchParams.get('template');
      const detailsParam = searchParams.get('details');

      const storedUrl = urlParam || sessionStorage.getItem('targetUrl');
      const storedStyle = templateParam || sessionStorage.getItem('selectedStyle');
      const storedModel = sessionStorage.getItem('selectedModel');
      const storedInstructions = sessionStorage.getItem('additionalInstructions');

      if (storedUrl) {
        setHasInitialSubmission(true);
        sessionStorage.removeItem('targetUrl');
        sessionStorage.removeItem('selectedStyle');
        sessionStorage.removeItem('selectedModel');
        sessionStorage.removeItem('additionalInstructions');

        setHomeUrlInput(storedUrl);
        setSelectedStyle_unused(storedStyle || 'modern');

        if (detailsParam) {
          setHomeContextInput(detailsParam);
        } else if (storedStyle && !urlParam) {
          const styleNames: Record<string, string> = {
            '1': 'Glassmorphism', '2': 'Neumorphism', '3': 'Brutalism',
            '4': 'Minimalist', '5': 'Dark Mode', '6': 'Gradient Rich',
            '7': '3D Depth', '8': 'Retro Wave',
            'modern': 'Modern clean and minimalist', 'playful': 'Fun colorful and playful',
            'professional': 'Corporate professional and sleek', 'artistic': 'Creative artistic and unique',
          };
          let contextString = `${styleNames[storedStyle] || storedStyle} style design`;
          if (storedInstructions) contextString += `. ${storedInstructions}`;
          setHomeContextInput(contextString);
        } else if (storedInstructions && !urlParam) {
          setHomeContextInput(storedInstructions);
        }

        if (storedModel) setAiModel(storedModel);
        setShowHomeScreen(false);
        setHomeScreenFading(false);
        setShouldAutoGenerate(true);
        sessionStorage.setItem('autoStart', 'true');
      }

      try {
        await fetch('/api/conversation-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear-old' }),
        });
      } catch (error) {
        console.error('[ai-sandbox] Failed to clear old conversation:', error);
        if (isMounted) addChatMessage('Failed to clear old conversation data.', 'error');
      }

      if (!isMounted) return;

      setLoading(true);
      try {
        sandboxCreated = true;
        await createSandbox(true);

        if (storedUrl && isMounted) {
          sessionStorage.setItem('autoStart', 'true');
        }

        if (isMounted) {
          try {
            const instrRes = await fetch('/api/project-instructions');
            const instrData = await instrRes.json();
            if (instrData.text) {
              setProjectInstructions(instrData.text);
              setInstructionsExpanded(true);
            }
            if (instrData.hasProject) setHasPreloadedProject(true);
            setProjectLoading(false);
          } catch { /* handled by useProjectState initial fetch */ }
        }
      } catch (error) {
        console.error('[ai-sandbox] Failed to create or restore sandbox:', error);
        if (isMounted) addChatMessage('Failed to create or restore sandbox.', 'error');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializePage();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-screenshot when URL set
  useEffect(() => {
    if (!showHomeScreen && homeUrlInput && !urlScreenshot && !isCapturingScreenshot) {
      let screenshotUrl = homeUrlInput.trim();
      if (!screenshotUrl.match(/^https?:\/\//i)) screenshotUrl = 'https://' + screenshotUrl;
      captureUrlScreenshot(screenshotUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHomeScreen, homeUrlInput]);

  // Auto-start generation from session flag
  useEffect(() => {
    const autoStart = sessionStorage.getItem('autoStart');
    if (autoStart === 'true' && !showHomeScreen && homeUrlInput) {
      sessionStorage.removeItem('autoStart');
      setTimeout(() => { startGeneration(); }, 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHomeScreen, homeUrlInput]);

  // Sandbox status check on mount
  useEffect(() => {
    const autoStart = sessionStorage.getItem('autoStart');
    if (!sandboxData && autoStart !== 'true') {
      checkSandboxStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chat auto-scroll
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages, chatMessagesRef]);

  // shouldAutoGenerate flag trigger
  useEffect(() => {
    if (shouldAutoGenerate && homeUrlInput && !showHomeScreen) {
      setShouldAutoGenerate(false);
      const timer = setTimeout(() => { startGeneration(); }, 1000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoGenerate, homeUrlInput, showHomeScreen]);

  // Code display auto-scroll
  useEffect(() => {
    if (generationProgress.isStreaming && codeDisplayRef.current) {
      codeDisplayRef.current.scrollTop = codeDisplayRef.current.scrollHeight;
    }
  }, [generationProgress.streamedCode, generationProgress.isStreaming, codeDisplayRef]);

  // --- Functions ---
  const captureUrlScreenshot = async (url: string) => {
    setIsCapturingScreenshot(true);
    setScreenshotError(null);
    try {
      const response = await fetch('/api/scrape-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (data.success && data.screenshot) {
        setIsScreenshotLoaded(false);
        setUrlScreenshot(data.screenshot);
        setIsPreparingDesign(true);
        const cleanUrl = url.replace(/^https?:\/\//i, '');
        setTargetUrl(cleanUrl);
        if (activeTab !== 'preview') setActiveTab('preview');
      } else {
        setScreenshotError(data.error || 'Failed to capture screenshot');
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      setScreenshotError('Network error while capturing screenshot');
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  const startGeneration = async () => {
    if (!homeUrlInput.trim()) return;

    setHomeScreenFading(true);
    setIsStartingNewGeneration(true);
    setLoadingStage('gathering');
    setActiveTab('preview');
    setShowLoadingBackground(true);
    setChatMessages([]);

    let displayUrl = homeUrlInput.trim();
    if (!displayUrl.match(/^https?:\/\//i)) displayUrl = 'https://' + displayUrl;
    const cleanUrl = displayUrl.replace(/^https?:\/\//i, '');
    const brandExtensionMode = sessionStorage.getItem('brandExtensionMode') === 'true';

    addChatMessage(
      brandExtensionMode
        ? `Analyzing brand from ${cleanUrl}...`
        : `Starting to clone ${cleanUrl}...`,
      'system'
    );

    const sandboxPromise = !sandboxData ? createSandbox(true) : Promise.resolve(null);
    captureUrlScreenshot(displayUrl);

    setTimeout(async () => {
      setShowHomeScreen(false);
      setHomeScreenFading(false);
      setTimeout(() => { setIsStartingNewGeneration(false); }, 1000);

      await sandboxPromise;

      setUrlInput(homeUrlInput);
      setUrlStatus(['Scraping website content...']);

      try {
        let url = homeUrlInput.trim();
        if (!url.match(/^https?:\/\//i)) url = 'https://' + url;

        const brandExtMode = sessionStorage.getItem('brandExtensionMode') === 'true';
        const brandExtPrompt = sessionStorage.getItem('brandExtensionPrompt') || '';

        let scrapeData: Record<string, unknown> | undefined;
        let brandGuidelines: Record<string, unknown> | undefined;

        if (brandExtMode) {
          addChatMessage('Extracting brand styles from the website...', 'system');
          const extractResponse = await fetch('/api/extract-brand-styles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, prompt: brandExtPrompt }),
          });
          if (!extractResponse.ok) throw new Error('Failed to extract brand styles');
          brandGuidelines = await extractResponse.json();
          if (!brandGuidelines?.success) {
            throw new Error((brandGuidelines?.error as string) || 'Failed to extract brand styles');
          }

          addChatMessage(`Acquired branding format from ${cleanUrl}`, 'system', {
            brandingData: brandGuidelines.guidelines,
            sourceUrl: cleanUrl,
          });
          addChatMessage('Building your custom component using these brand guidelines...', 'system');
          sessionStorage.removeItem('brandExtensionMode');
          sessionStorage.removeItem('brandExtensionPrompt');
        } else {
          const storedMarkdown = sessionStorage.getItem('siteMarkdown');
          if (storedMarkdown) {
            let hostname = url;
            try { hostname = new URL(url).hostname; } catch { /* ignore */ }
            scrapeData = { success: true, content: storedMarkdown, title: hostname, source: 'search-result' };
            sessionStorage.removeItem('siteMarkdown');
            addChatMessage('Using cached content from search results...', 'system');
          } else {
            const scrapeResponse = await fetch('/api/scrape-url-enhanced', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url }),
            });
            if (!scrapeResponse.ok) throw new Error('Failed to scrape website');
            scrapeData = await scrapeResponse.json();
            if (!scrapeData?.success) {
              throw new Error((scrapeData?.error as string) || 'Failed to scrape website');
            }
          }
        }

        setUrlStatus(brandExtMode
          ? ['Brand styles extracted!', 'Building your component...']
          : ['Website scraped successfully!', 'Generating React app...']);
        setIsPreparingDesign(false);
        setIsScreenshotLoaded(false);
        setUrlScreenshot(null);
        setTargetUrl('');
        setLoadingStage('planning');
        setTimeout(() => {
          setLoadingStage('generating');
          setActiveTab('generation');
        }, 1500);

        let prompt: string;
        if (brandExtMode && brandGuidelines) {
          const branding = brandGuidelines.guidelines as Record<string, unknown>;
          setConversationContext(prev => ({
            ...prev,
            scrapedWebsites: [...prev.scrapedWebsites, { url, content: { brandGuidelines }, timestamp: new Date() }],
            currentProject: `Custom build using ${url} brand`,
          }));
          prompt = `Build a NEW React component/application based on these brand guidelines.
<branding-format source="${url}">
${JSON.stringify(branding, null, 2)}
</branding-format>
USER'S REQUEST: ${brandExtPrompt || 'Build a modern web component using these brand guidelines'}
CRITICAL: DO NOT recreate the original website. Build ONLY what the user requested.`;
        } else {
          if (!scrapeData) throw new Error('Scrape data is missing');

          let filteredContext = homeContextInput;
          if (homeUrlInput && homeContextInput) {
            const stylePatterns = [
              'Glassmorphism style design', 'Neumorphism style design', 'Brutalism style design',
              'Minimalist style design', 'Dark Mode style design', 'Gradient Rich style design',
              '3D Depth style design', 'Retro Wave style design',
              'Modern clean and minimalist style design', 'Fun colorful and playful style design',
              'Corporate professional and sleek style design', 'Creative artistic and unique style design',
            ];
            const startsWithStyle = stylePatterns.some(p => homeContextInput.trim().startsWith(p));
            if (startsWithStyle) {
              const additionalMatch = homeContextInput.match(/\. (.+)$/);
              filteredContext = additionalMatch ? additionalMatch[1] : '';
            }
          }

          setConversationContext(prev => ({
            ...prev,
            scrapedWebsites: [...prev.scrapedWebsites, { url, content: scrapeData as Record<string, unknown>, timestamp: new Date() }],
            currentProject: `${url} Clone`,
          }));

          prompt = `I want to recreate the ${url} website as a complete React application.
${JSON.stringify(scrapeData, null, 2)}
${filteredContext ? `ADDITIONAL CONTEXT: ${filteredContext}` : ''}
IMPORTANT: Create a COMPLETE, working React application. Use Tailwind CSS. Make it responsive.`;
        }

        setGenerationProgress(prev => ({
          isGenerating: true,
          status: 'Initializing AI...',
          components: [],
          currentComponent: 0,
          streamedCode: '',
          isStreaming: true,
          isThinking: false,
          thinkingText: undefined,
          thinkingDuration: undefined,
          files: prev.files || [],
          currentFile: undefined,
          lastProcessedPosition: 0,
        }));

        const aiResponse = await fetch('/api/generate-ai-code-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            model: aiModel,
            context: { sandboxId: sandboxData?.sandboxId, structure: structureContent, conversationContext },
          }),
        });

        if (!aiResponse.ok || !aiResponse.body) throw new Error('Failed to generate code');

        const reader = aiResponse.body.getReader();
        const decoder = new TextDecoder();
        let generatedCode = '';
        let explanation = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'status') {
                  setGenerationProgress(prev => ({ ...prev, status: data.message }));
                } else if (data.type === 'thinking') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: true,
                    thinkingText: (prev.thinkingText || '') + data.text,
                  }));
                } else if (data.type === 'content') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    streamedCode: (prev.streamedCode || '') + data.text,
                    isThinking: false,
                  }));
                } else if (data.type === 'complete') {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;
                  setConversationContext(prev => ({ ...prev, lastGeneratedCode: generatedCode }));
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }

        setGenerationProgress(prev => ({ ...prev, isGenerating: false, isStreaming: false, status: 'Generation complete!' }));

        if (generatedCode) {
          addChatMessage('AI recreation generated!', 'system');
          if (explanation?.trim()) addChatMessage(explanation, 'ai');

          await applyGeneratedCode(generatedCode, false);

          addChatMessage(
            brandExtMode
              ? `Successfully built your custom component using ${cleanUrl}'s brand guidelines!`
              : `Successfully recreated ${url} as a modern React app${homeContextInput ? ` with your requested context: "${homeContextInput}"` : ''}!`,
            'ai',
            { scrapedUrl: url, generatedCode }
          );

          setConversationContext(prev => ({
            ...prev,
            generatedComponents: [],
            appliedCode: [...prev.appliedCode, { files: [], timestamp: new Date() }],
          }));
        } else {
          throw new Error('Failed to generate recreation');
        }

        setUrlInput('');
        setUrlStatus([]);
        setHomeContextInput('');
        setGenerationProgress(prev => ({ ...prev, isGenerating: false, isStreaming: false, status: 'Generation complete!' }));
        setIsScreenshotLoaded(false);
        setUrlScreenshot(null);
        setIsPreparingDesign(false);
        setTargetUrl('');
        setScreenshotError(null);
        setLoadingStage(null);
        setIsStartingNewGeneration(false);
        setShowLoadingBackground(false);
        setTimeout(() => { setActiveTab('preview'); }, 1000);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        addChatMessage(`Failed to clone website: ${msg}`, 'system');
        setUrlStatus([]);
        setIsPreparingDesign(false);
        setIsStartingNewGeneration(false);
        setLoadingStage(null);
        setGenerationProgress(prev => ({
          ...prev, isGenerating: false, isStreaming: false, status: '', files: prev.files,
        }));
      }
    }, 500);
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(folderPath)) {
        newExpanded.delete(folderPath);
      } else {
        newExpanded.add(folderPath);
      }
      return newExpanded;
    });
  };

  const handleFileClick = (filePath: string) => {
    setSelectedFile(filePath);
  };

  const renderMainContent = () => {
    if (activeTab === 'generation' && (generationProgress.isGenerating || generationProgress.files.length > 0)) {
      return (
        <CodePanel
          generationProgress={generationProgress}
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          handleFileClick={handleFileClick}
          codeDisplayRef={codeDisplayRef}
        />
      );
    }
    return (
      <SandboxFrame
        sandboxData={sandboxData}
        iframeRef={iframeRef}
        urlScreenshot={urlScreenshot}
        isScreenshotLoaded={isScreenshotLoaded}
        setIsScreenshotLoaded={setIsScreenshotLoaded}
        isCapturingScreenshot={isCapturingScreenshot}
        isPreparingDesign={isPreparingDesign}
        loadingStage={loadingStage}
        loading={loading}
        generationProgress={generationProgress}
        isStartingNewGeneration={isStartingNewGeneration}
        screenshotError={screenshotError}
        codeApplicationState={codeApplicationState}
      />
    );
  };

  // Suppress unused variable warnings
  void urlInput; void urlStatus; void showLoadingBackground; void targetUrl;

  return (
    <HeaderProvider>
      <div className="font-sans bg-background text-foreground h-screen flex flex-col">
        <GenerationHeader
          aiModel={aiModel}
          setAiModel={setAiModel}
          sandboxData={sandboxData}
          conversationContextHasLastCode={!!conversationContext.lastGeneratedCode}
          createSandbox={createSandbox}
          reapplyLastGeneration={reapplyLastGeneration}
          downloadZip={downloadZip}
        />

        <div className="flex-1 flex overflow-hidden">
          <GenerationSidebar
            hasInitialSubmission={hasInitialSubmission}
            loading={loading}
            generationProgress={generationProgress}
            conversationContext={conversationContext}
            chatMessages={chatMessages}
            chatMessagesRef={chatMessagesRef}
            codeApplicationState={codeApplicationState}
            sandboxData={sandboxData}
            projectLoading={projectLoading}
            projectInstructions={projectInstructions}
            setProjectInstructions={setProjectInstructions}
            instructionsExpanded={instructionsExpanded}
            setInstructionsExpanded={setInstructionsExpanded}
            instructionsDirty={instructionsDirty}
            setInstructionsDirty={setInstructionsDirty}
            screenshotCollapsed={screenshotCollapsed}
            setScreenshotCollapsed={setScreenshotCollapsed}
            aiChatInput={aiChatInput}
            setAiChatInput={setAiChatInput}
            sendChatMessage={sendChatMessage}
            setHomeUrlInput={setHomeUrlInput}
            setHomeContextInput={setHomeContextInput}
            startGeneration={startGeneration}
            saveInstructions={saveInstructions}
          />

          {/* Right Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 pt-4 pb-4 bg-white border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="inline-flex bg-gray-100 border border-gray-200 rounded-md p-0.5">
                  <button
                    onClick={() => setActiveTab('generation')}
                    data-testid="generation-tab-code-btn"
                    className={`px-3 py-1 rounded transition-all text-xs font-medium ${
                      activeTab === 'generation'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'bg-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      <span>Code</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('preview')}
                    data-testid="generation-tab-preview-btn"
                    className={`px-3 py-1 rounded transition-all text-xs font-medium ${
                      activeTab === 'preview'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'bg-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>View</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 items-center">
                {activeTab === 'generation' && !generationProgress.isEdit && generationProgress.files.length > 0 && (
                  <div className="text-gray-500 text-xs font-medium">
                    {generationProgress.files.length} files generated
                  </div>
                )}
                {activeTab === 'generation' && generationProgress.isGenerating && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-md text-xs font-medium text-gray-700">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    {generationProgress.isEdit ? 'Editing code' : 'Live generation'}
                  </div>
                )}
                {sandboxData && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-md text-xs font-medium text-gray-700">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    Sandbox active
                  </div>
                )}
                {sandboxData && (
                  <a
                    href={sandboxData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in new tab"
                    data-testid="generation-open-sandbox-link"
                    className="p-1.5 rounded-md transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>

            <div className="flex-1 relative overflow-hidden">{renderMainContent()}</div>
          </div>
        </div>
      </div>
    </HeaderProvider>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <AISandboxPage />
    </Suspense>
  );
}
