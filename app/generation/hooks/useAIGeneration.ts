'use client';

import { useState, useRef, useCallback } from 'react';
import { appConfig } from '@/config/app.config';
import type { SandboxData, GenerationProgress, ConversationContext, ChatMessage } from '../types';
import type { CodeApplicationState } from '@/components/CodeApplicationProgress';

const INITIAL_GENERATION_PROGRESS: GenerationProgress = {
  isGenerating: false,
  status: '',
  components: [],
  currentComponent: 0,
  streamedCode: '',
  isStreaming: false,
  isThinking: false,
  files: [],
  lastProcessedPosition: 0,
};

export interface UseAIGenerationReturn {
  generationProgress: GenerationProgress;
  setGenerationProgress: React.Dispatch<React.SetStateAction<GenerationProgress>>;
  codeApplicationState: CodeApplicationState;
  setCodeApplicationState: React.Dispatch<React.SetStateAction<CodeApplicationState>>;
  promptInput: string;
  setPromptInput: React.Dispatch<React.SetStateAction<string>>;
  codeDisplayRef: React.RefObject<HTMLDivElement | null>;
  applyGeneratedCode: (
    code: string,
    isEdit?: boolean,
    overrideSandboxData?: SandboxData
  ) => Promise<void>;
  sendChatMessage: () => Promise<void>;
  installPackages: (packages: string[]) => Promise<void>;
  checkAndInstallPackages: () => Promise<void>;
  reapplyLastGeneration: () => Promise<void>;
  downloadZip: () => Promise<void>;
}

export function useAIGeneration(
  sandboxData: SandboxData | null,
  setSandboxData: React.Dispatch<React.SetStateAction<SandboxData | null>>,
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  aiModel: string,
  aiChatInput: string,
  setAiChatInput: React.Dispatch<React.SetStateAction<string>>,
  loading: boolean,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  conversationContext: ConversationContext,
  setConversationContext: React.Dispatch<React.SetStateAction<ConversationContext>>,
  hasPreloadedProject: boolean,
  structureContent: string,
  chatMessages: ChatMessage[],
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  addChatMessage: (content: string, type: ChatMessage['type'], metadata?: ChatMessage['metadata']) => void,
  log: (message: string, type?: 'info' | 'error' | 'command') => void,
  fetchSandboxFiles: () => Promise<void>,
  setActiveTab: React.Dispatch<React.SetStateAction<'generation' | 'preview'>>,
  createSandbox: (fromHomeScreen?: boolean) => Promise<SandboxData | null>
): UseAIGenerationReturn {
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>(INITIAL_GENERATION_PROGRESS);
  const [codeApplicationState, setCodeApplicationState] = useState<CodeApplicationState>({ stage: null });
  const [promptInput, setPromptInput] = useState('');

  const codeDisplayRef = useRef<HTMLDivElement | null>(null);

  const applyGeneratedCode = useCallback(
    async (code: string, isEdit: boolean = false, overrideSandboxData?: SandboxData) => {
      setLoading(true);
      log('Applying AI-generated code...');

      try {
        setCodeApplicationState({ stage: 'analyzing' });

        const pendingPackages = ((window as unknown as Record<string, unknown>).pendingPackages as string[] || []).filter(
          (pkg: unknown) => pkg && typeof pkg === 'string'
        );
        if (pendingPackages.length > 0) {
          console.log('[applyGeneratedCode] Sending packages from tool calls:', pendingPackages);
          (window as unknown as Record<string, unknown>).pendingPackages = [];
        }

        const effectiveSandboxData = overrideSandboxData || sandboxData;
        const response = await fetch('/api/apply-ai-code-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            response: code,
            isEdit: isEdit,
            packages: pendingPackages,
            sandboxId: effectiveSandboxData?.sandboxId,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to apply code: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let finalData: Record<string, unknown> | null = null;

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                switch (data.type) {
                  case 'start':
                    setCodeApplicationState({ stage: 'analyzing' });
                    break;
                  case 'step':
                    if (data.message.includes('Installing') && data.packages) {
                      setCodeApplicationState({ stage: 'installing', packages: data.packages });
                    } else if (data.message.includes('Creating files') || data.message.includes('Applying')) {
                      setCodeApplicationState({ stage: 'applying', filesGenerated: [] });
                    }
                    break;
                  case 'package-progress':
                    if (data.installedPackages) {
                      setCodeApplicationState(prev => ({ ...prev, installedPackages: data.installedPackages }));
                    }
                    break;
                  case 'command':
                    if (data.command && !data.command.includes('npm install')) {
                      addChatMessage(data.command, 'command', { commandType: 'input' });
                    }
                    break;
                  case 'success':
                    if (data.installedPackages) {
                      setCodeApplicationState(prev => ({ ...prev, installedPackages: data.installedPackages }));
                    }
                    break;
                  case 'file-progress':
                    break;
                  case 'file-complete':
                    break;
                  case 'command-progress':
                    addChatMessage(`${data.action} command: ${data.command}`, 'command', { commandType: 'input' });
                    break;
                  case 'command-output':
                    addChatMessage(data.output, 'command', {
                      commandType: data.stream === 'stderr' ? 'error' : 'output',
                    });
                    break;
                  case 'command-complete':
                    if (data.success) {
                      addChatMessage('Command completed successfully', 'system');
                    } else {
                      addChatMessage(`Command failed with exit code ${data.exitCode}`, 'system');
                    }
                    break;
                  case 'complete':
                    finalData = data;
                    setCodeApplicationState({ stage: 'complete' });
                    setTimeout(() => setCodeApplicationState({ stage: null }), 3000);
                    setLoading(false);
                    break;
                  case 'error':
                    addChatMessage(`Error: ${data.message || data.error || 'Unknown error'}`, 'system');
                    setLoading(false);
                    break;
                  case 'warning':
                    addChatMessage(`${data.message}`, 'system');
                    break;
                  case 'info':
                    if (data.message) {
                      addChatMessage(data.message, 'system');
                    }
                    break;
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        if (finalData && finalData.type === 'complete') {
          const data: Record<string, unknown> = {
            success: true,
            results: finalData.results,
            explanation: finalData.explanation,
            structure: finalData.structure,
            message: finalData.message,
            autoCompleted: finalData.autoCompleted,
            autoCompletedComponents: finalData.autoCompletedComponents,
            warning: finalData.warning,
            missingImports: finalData.missingImports,
            debug: finalData.debug,
          };

          if (data.success) {
            const results = data.results as Record<string, unknown>;

            if ((results.packagesInstalled as string[])?.length > 0) {
              log(`Packages installed: ${(results.packagesInstalled as string[]).join(', ')}`);
            }

            if ((results.filesCreated as string[])?.length > 0) {
              log('Files created:');
              (results.filesCreated as string[]).forEach((file: string) => log(`  ${file}`, 'command'));

              if (sandboxData?.sandboxId && (results.filesCreated as string[]).length > 0) {
                setTimeout(() => {
                  if (iframeRef.current) {
                    iframeRef.current.src = iframeRef.current.src;
                  }
                }, 1000);
              }
            }

            if ((results.filesUpdated as string[])?.length > 0) {
              log('Files updated:');
              (results.filesUpdated as string[]).forEach((file: string) => log(`  ${file}`, 'command'));
            }

            setConversationContext(prev => ({
              ...prev,
              appliedCode: [
                ...prev.appliedCode,
                {
                  files: [
                    ...((results.filesCreated as string[]) || []),
                    ...((results.filesUpdated as string[]) || []),
                  ],
                  timestamp: new Date(),
                },
              ],
            }));

            if ((results.commandsExecuted as string[])?.length > 0) {
              log('Commands executed:');
              (results.commandsExecuted as string[]).forEach((cmd: string) => log(`  $ ${cmd}`, 'command'));
            }

            if ((results.errors as string[])?.length > 0) {
              (results.errors as string[]).forEach((err: string) => log(err, 'error'));
            }

            if (data.explanation) {
              log(data.explanation as string);
            }

            if (data.autoCompleted) {
              log('Auto-generating missing components...', 'command');
              if (data.autoCompletedComponents) {
                setTimeout(() => {
                  log('Auto-generated missing components:', 'info');
                  (data.autoCompletedComponents as string[]).forEach((comp: string) => log(`  ${comp}`, 'command'));
                }, 1000);
              }
            } else if (data.warning) {
              log(data.warning as string, 'error');
              if (data.missingImports && (data.missingImports as string[]).length > 0) {
                const missingList = (data.missingImports as string[]).join(', ');
                addChatMessage(
                  `Ask me to "create the missing components: ${missingList}" to fix these import errors.`,
                  'system'
                );
              }
            }

            log('Code applied successfully!');

            if ((results.filesCreated as string[])?.length > 0) {
              setConversationContext(prev => ({
                ...prev,
                appliedCode: [
                  ...prev.appliedCode,
                  { files: results.filesCreated as string[], timestamp: new Date() },
                ],
              }));

              if (isEdit) {
                addChatMessage('Edit applied successfully!', 'system');
              } else {
                const recentMessages = chatMessages.slice(-5);
                const isPartOfGeneration = recentMessages.some(
                  m =>
                    m.content.includes('AI recreation generated') ||
                    m.content.includes('Code generated')
                );

                if (isPartOfGeneration) {
                  addChatMessage(`Applied ${(results.filesCreated as string[]).length} files successfully!`, 'system');
                } else {
                  addChatMessage(
                    `Applied ${(results.filesCreated as string[]).length} files successfully!`,
                    'system',
                    { appliedFiles: results.filesCreated as string[] }
                  );
                }
              }

              if ((results.packagesFailed as string[])?.length > 0) {
                addChatMessage('Some packages failed to install. Check the error banner above for details.', 'system');
              }

              await fetchSandboxFiles();

              const refreshDelay = appConfig.codeApplication.defaultRefreshDelay;

              setTimeout(() => {
                const currentSandboxData = effectiveSandboxData;
                if (iframeRef.current && currentSandboxData?.url) {
                  const urlWithTimestamp = `${currentSandboxData.url}?t=${Date.now()}&applied=true`;
                  iframeRef.current.src = urlWithTimestamp;

                  setTimeout(() => {
                    try {
                      if (iframeRef.current?.contentWindow) {
                        iframeRef.current.contentWindow.location.reload();
                      }
                    } catch (e) {
                      console.log('[home] Could not reload iframe (cross-origin):', e);
                    }
                  }, 1000);
                }
              }, refreshDelay);
            }

            const currentSandboxData = effectiveSandboxData;
            if (iframeRef.current && currentSandboxData?.url) {
              const packagesInstalled =
                (results?.packagesInstalled as string[])?.length > 0 ||
                (data.results as Record<string, unknown>)?.packagesInstalled;
              const refreshDelay = packagesInstalled
                ? appConfig.codeApplication.packageInstallRefreshDelay
                : appConfig.codeApplication.defaultRefreshDelay;

              setTimeout(async () => {
                if (iframeRef.current && currentSandboxData?.url) {
                  try {
                    const urlWithTimestamp = `${currentSandboxData.url}?t=${Date.now()}&force=true`;
                    iframeRef.current.onload = null;
                    iframeRef.current.src = urlWithTimestamp;

                    await new Promise(resolve => setTimeout(resolve, 2000));

                    try {
                      const iframeDoc =
                        iframeRef.current.contentDocument ||
                        iframeRef.current.contentWindow?.document;
                      if (iframeDoc && iframeDoc.readyState === 'complete') {
                        return;
                      }
                    } catch {
                      return;
                    }
                  } catch (e) {
                    console.error('[applyGeneratedCode] Direct navigation failed:', e);
                  }

                  const parent = iframeRef.current.parentElement;
                  const newIframe = document.createElement('iframe');
                  newIframe.className = iframeRef.current.className;
                  newIframe.title = iframeRef.current.title;
                  newIframe.allow = iframeRef.current.allow;
                  const sandboxValue = iframeRef.current.getAttribute('sandbox');
                  if (sandboxValue) newIframe.setAttribute('sandbox', sandboxValue);
                  iframeRef.current.remove();
                  newIframe.src = `${currentSandboxData.url}?t=${Date.now()}&recreated=true`;
                  parent?.appendChild(newIframe);
                  (iframeRef as React.MutableRefObject<HTMLIFrameElement>).current = newIframe;
                }
              }, refreshDelay);
            }
          } else {
            throw new Error((finalData?.error as string) || 'Failed to apply code');
          }
        } else {
          addChatMessage('Code application may have partially succeeded. Check the preview.', 'system');
        }
      } catch (error: unknown) {
        const err = error as Error;
        log(`Failed to apply code: ${err.message}`, 'error');
      } finally {
        setLoading(false);
        setGenerationProgress(prev => ({ ...prev, isEdit: false }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sandboxData, iframeRef, addChatMessage, log, fetchSandboxFiles, setConversationContext, chatMessages]
  );

  const installPackages = useCallback(
    async (packages: string[]) => {
      if (!sandboxData) {
        addChatMessage('No active sandbox. Create a sandbox first!', 'system');
        return;
      }

      try {
        const response = await fetch('/api/install-packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packages }),
        });

        if (!response.ok) throw new Error(`Failed to install packages: ${response.statusText}`);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                switch (data.type) {
                  case 'command':
                    if (!data.command.includes('npm install')) {
                      addChatMessage(data.command, 'command', { commandType: 'input' });
                    }
                    break;
                  case 'output':
                    addChatMessage(data.message, 'command', { commandType: 'output' });
                    break;
                  case 'error':
                    if (data.message && data.message !== 'undefined') {
                      addChatMessage(data.message, 'command', { commandType: 'error' });
                    }
                    break;
                  case 'warning':
                    addChatMessage(data.message, 'command', { commandType: 'output' });
                    break;
                  case 'success':
                    addChatMessage(`${data.message}`, 'system');
                    break;
                  case 'status':
                    addChatMessage(data.message, 'system');
                    break;
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      } catch (error: unknown) {
        const err = error as Error;
        addChatMessage(`Failed to install packages: ${err.message}`, 'system');
      }
    },
    [sandboxData, addChatMessage]
  );

  const checkAndInstallPackages = useCallback(async () => {
    if (!sandboxData) {
      console.log('[checkAndInstallPackages] No sandbox data available yet');
      return;
    }
    addChatMessage('Checking packages... Sandbox is ready with Vite configuration.', 'system');
  }, [sandboxData, addChatMessage]);

  const sendChatMessage = useCallback(async () => {
    const message = aiChatInput.trim();
    if (!message) return;

    addChatMessage(message, 'user');
    setAiChatInput('');

    const lowerMessage = message.toLowerCase().trim();
    if (
      lowerMessage === 'check packages' ||
      lowerMessage === 'install packages' ||
      lowerMessage === 'npm install'
    ) {
      if (!sandboxData) {
        addChatMessage(
          'The sandbox is still being set up. Please wait for the generation to complete, then try again.',
          'system'
        );
        return;
      }
      await checkAndInstallPackages();
      return;
    }

    let sandboxPromise: Promise<SandboxData | null> | null = null;
    let sandboxCreating = false;

    if (!sandboxData) {
      sandboxCreating = true;
      addChatMessage('Creating sandbox while I plan your app...', 'system');
      sandboxPromise = createSandbox(true).catch((error: unknown) => {
        const err = error as Error;
        addChatMessage(`Failed to create sandbox: ${err.message}`, 'system');
        throw err;
      });
    }

    const isEdit = conversationContext.appliedCode.length > 0 || hasPreloadedProject;

    try {
      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: true,
        status: 'Starting AI generation...',
        components: [],
        currentComponent: 0,
        streamedCode: '',
        isStreaming: false,
        isThinking: true,
        thinkingText: 'Analyzing your request...',
        thinkingDuration: undefined,
        currentFile: undefined,
        lastProcessedPosition: 0,
        isEdit: isEdit,
        files: prev.files,
      }));

      console.log('[chat] Using backend file cache for context');

      const fullContext = {
        sandboxId: sandboxData?.sandboxId || (sandboxCreating ? 'pending' : null),
        structure: structureContent,
        recentMessages: chatMessages.slice(-20),
        conversationContext: conversationContext,
        currentCode: promptInput,
        sandboxUrl: sandboxData?.url,
        sandboxCreating: sandboxCreating,
      };

      const clientIsEdit = conversationContext.appliedCode.length > 0 || hasPreloadedProject;

      const response = await fetch('/api/generate-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: message,
          model: aiModel,
          context: fullContext,
          isEdit: clientIsEdit,
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let generatedCode = '';
      let explanation = '';
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
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
                } else if (data.type === 'thinking_complete') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingDuration: data.duration,
                  }));
                } else if (data.type === 'conversation') {
                  let text = data.text || '';
                  text = text.replace(/<package>[^<]*<\/package>/g, '');
                  text = text.replace(/<packages>[^<]*<\/packages>/g, '');

                  if (
                    !text.includes('<file') &&
                    !text.includes('import React') &&
                    !text.includes('export default') &&
                    !text.includes('className=') &&
                    text.trim().length > 0
                  ) {
                    addChatMessage(text.trim(), 'ai');
                  }
                } else if (data.type === 'stream' && data.raw) {
                  setGenerationProgress(prev => {
                    const newStreamedCode = prev.streamedCode + data.text;
                    const updatedState = {
                      ...prev,
                      streamedCode: newStreamedCode,
                      isStreaming: true,
                      isThinking: false,
                      status: 'Generating code...',
                    };

                    const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                    let match;
                    const processedFiles = new Set(prev.files.map(f => f.path));

                    while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                      const filePath = match[1];
                      const fileContent = match[2];

                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType =
                          fileExt === 'jsx' || fileExt === 'js'
                            ? 'javascript'
                            : fileExt === 'css'
                            ? 'css'
                            : fileExt === 'json'
                            ? 'json'
                            : fileExt === 'html'
                            ? 'html'
                            : 'text';

                        const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);

                        if (existingFileIndex >= 0) {
                          updatedState.files = [
                            ...updatedState.files.slice(0, existingFileIndex),
                            {
                              ...updatedState.files[existingFileIndex],
                              content: fileContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: true,
                            },
                            ...updatedState.files.slice(existingFileIndex + 1),
                          ];
                        } else {
                          updatedState.files = [
                            ...updatedState.files,
                            { path: filePath, content: fileContent.trim(), type: fileType, completed: true, edited: false },
                          ];
                        }

                        if (!prev.isEdit) {
                          updatedState.status = `Completed ${filePath}`;
                        }
                        processedFiles.add(filePath);
                      }
                    }

                    const lastFileMatch = newStreamedCode.match(/<file path="([^"]+)">([^]*?)$/);
                    if (lastFileMatch && !lastFileMatch[0].includes('</file>')) {
                      const filePath = lastFileMatch[1];
                      const partialContent = lastFileMatch[2];

                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType =
                          fileExt === 'jsx' || fileExt === 'js'
                            ? 'javascript'
                            : fileExt === 'css'
                            ? 'css'
                            : fileExt === 'json'
                            ? 'json'
                            : fileExt === 'html'
                            ? 'html'
                            : 'text';

                        updatedState.currentFile = { path: filePath, content: partialContent, type: fileType };
                        if (!prev.isEdit) {
                          updatedState.status = `Generating ${filePath}`;
                        }
                      }
                    } else {
                      updatedState.currentFile = undefined;
                    }

                    return updatedState;
                  });
                } else if (data.type === 'app') {
                  setGenerationProgress(prev => ({ ...prev, status: 'Generated App.jsx structure' }));
                } else if (data.type === 'component') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: `Generated ${data.name}`,
                    components: [...prev.components, { name: data.name, path: data.path, completed: true }],
                    currentComponent: data.index,
                  }));
                } else if (data.type === 'package') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: data.message || `Installing ${data.name}`,
                  }));
                } else if (data.type === 'complete') {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;

                  setConversationContext(prev => ({ ...prev, lastGeneratedCode: generatedCode }));

                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingText: undefined,
                    thinkingDuration: undefined,
                  }));

                  if (data.packagesToInstall && data.packagesToInstall.length > 0) {
                    (window as unknown as Record<string, unknown>).pendingPackages = data.packagesToInstall;
                  }

                  const fileRegex2 = /<file path="([^"]+)">([^]*?)<\/file>/g;
                  const parsedFiles: GenerationProgress['files'] = [];
                  let fileMatch;

                  while ((fileMatch = fileRegex2.exec(data.generatedCode)) !== null) {
                    const filePath = fileMatch[1];
                    const fileContent = fileMatch[2];
                    const fileExt = filePath.split('.').pop() || '';
                    const fileType =
                      fileExt === 'jsx' || fileExt === 'js'
                        ? 'javascript'
                        : fileExt === 'css'
                        ? 'css'
                        : fileExt === 'json'
                        ? 'json'
                        : fileExt === 'html'
                        ? 'html'
                        : 'text';

                    parsedFiles.push({ path: filePath, content: fileContent.trim(), type: fileType, completed: true });
                  }

                  setGenerationProgress(prev => ({
                    ...prev,
                    status: `Generated ${parsedFiles.length > 0 ? parsedFiles.length : prev.files.length} file${
                      (parsedFiles.length > 0 ? parsedFiles.length : prev.files.length) !== 1 ? 's' : ''
                    }!`,
                    isGenerating: false,
                    isStreaming: false,
                    isEdit: prev.isEdit,
                    files: prev.files.length > 0 ? prev.files : parsedFiles,
                  }));
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      }

      if (generatedCode) {
        const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
        const generatedFiles = [];
        let match;
        while ((match = fileRegex.exec(generatedCode)) !== null) {
          generatedFiles.push(match[1]);
        }

        if (isEdit && generatedFiles.length > 0) {
          const editedFileNames = generatedFiles.map(f => f.split('/').pop()).join(', ');
          addChatMessage(explanation || `Updated ${editedFileNames}`, 'ai', {
            appliedFiles: [generatedFiles[0]],
          });
        } else {
          addChatMessage(explanation || 'Code generated!', 'ai', { appliedFiles: generatedFiles });
        }

        setPromptInput(generatedCode);

        let activeSandboxData = sandboxData;
        if (sandboxPromise) {
          addChatMessage('Waiting for sandbox to be ready...', 'system');
          try {
            const newSandboxData = await sandboxPromise;
            if (newSandboxData != null) {
              activeSandboxData = newSandboxData;
              setSandboxData(newSandboxData);
            }
            setChatMessages(prev =>
              prev.filter(msg => msg.content !== 'Waiting for sandbox to be ready...')
            );
          } catch {
            addChatMessage('Sandbox creation failed. Cannot apply code.', 'system');
            return;
          }
        }

        if (activeSandboxData && generatedCode) {
          if (sandboxCreating) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          await applyGeneratedCode(
            generatedCode,
            isEdit,
            activeSandboxData !== sandboxData ? activeSandboxData : undefined
          );
        }
      }

      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: false,
        isStreaming: false,
        status: 'Generation complete!',
        isEdit: prev.isEdit,
        isThinking: false,
        thinkingText: undefined,
        thinkingDuration: undefined,
      }));

      setTimeout(() => setActiveTab('preview'), 1000);
    } catch (error: unknown) {
      const err = error as Error;
      setChatMessages(prev => prev.filter(msg => msg.content !== 'Thinking...'));
      addChatMessage(`Error: ${err.message}`, 'system');
      setGenerationProgress({
        isGenerating: false,
        status: '',
        components: [],
        currentComponent: 0,
        streamedCode: '',
        isStreaming: false,
        isThinking: false,
        thinkingText: undefined,
        thinkingDuration: undefined,
        files: [],
        currentFile: undefined,
        lastProcessedPosition: 0,
      });
      setActiveTab('preview');
    }
  }, [
    aiChatInput,
    sandboxData,
    setSandboxData,
    addChatMessage,
    setAiChatInput,
    conversationContext,
    hasPreloadedProject,
    structureContent,
    chatMessages,
    setChatMessages,
    promptInput,
    aiModel,
    createSandbox,
    applyGeneratedCode,
    setConversationContext,
    setActiveTab,
    checkAndInstallPackages,
  ]);

  const reapplyLastGeneration = useCallback(async () => {
    if (!conversationContext.lastGeneratedCode) {
      addChatMessage('No previous generation to re-apply', 'system');
      return;
    }
    if (!sandboxData) {
      addChatMessage('Please create a sandbox first', 'system');
      return;
    }
    addChatMessage('Re-applying last generation...', 'system');
    const isEdit = conversationContext.appliedCode.length > 0 || hasPreloadedProject;
    await applyGeneratedCode(conversationContext.lastGeneratedCode, isEdit);
  }, [conversationContext, sandboxData, hasPreloadedProject, addChatMessage, applyGeneratedCode]);

  const downloadZip = useCallback(async () => {
    if (!sandboxData) {
      addChatMessage('Please wait for the sandbox to be created before downloading.', 'system');
      return;
    }

    setLoading(true);
    log('Creating zip file...');
    addChatMessage('Creating ZIP file of your Vite app...', 'system');

    try {
      const response = await fetch('/api/create-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.success) {
        log('Zip file created!');
        addChatMessage('ZIP file created! Download starting...', 'system');

        const link = document.createElement('a');
        link.href = data.dataUrl;
        link.download = data.fileName || 'e2b-project.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        addChatMessage(
          'Your Vite app has been downloaded! To run it locally:\n1. Unzip the file\n2. Run: npm install\n3. Run: npm run dev\n4. Open http://localhost:5173',
          'system'
        );
      } else {
        throw new Error(data.error);
      }
    } catch (error: unknown) {
      const err = error as Error;
      log(`Failed to create zip: ${err.message}`, 'error');
      addChatMessage(`Failed to create ZIP: ${err.message}`, 'system');
    } finally {
      setLoading(false);
    }
  }, [sandboxData, addChatMessage, log, setLoading]);

  return {
    generationProgress,
    setGenerationProgress,
    codeApplicationState,
    setCodeApplicationState,
    promptInput,
    setPromptInput,
    codeDisplayRef,
    applyGeneratedCode,
    sendChatMessage,
    installPackages,
    checkAndInstallPackages,
    reapplyLastGeneration,
    downloadZip,
  };
}
