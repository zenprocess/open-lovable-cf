'use client';

import { useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { SandboxData, ChatMessage } from '../types';

export interface SandboxStatus {
  text: string;
  active: boolean;
}

export interface UseSandboxReturn {
  sandboxData: SandboxData | null;
  setSandboxData: React.Dispatch<React.SetStateAction<SandboxData | null>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  status: SandboxStatus;
  showLoadingBackground: boolean;
  setShowLoadingBackground: React.Dispatch<React.SetStateAction<boolean>>;
  responseArea: string[];
  structureContent: string;
  updateStatus: (text: string, active: boolean) => void;
  log: (message: string, type?: 'info' | 'error' | 'command') => void;
  displayStructure: (structure: unknown) => void;
  checkSandboxStatus: () => Promise<void>;
  createSandbox: (fromHomeScreen?: boolean) => Promise<SandboxData | null>;
  fetchSandboxFiles: () => Promise<void>;
  sandboxFiles: Record<string, string>;
  fileStructure: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  sandboxCreationRef: React.RefObject<boolean>;
}

export function useSandbox(
  aiModel: string,
  addChatMessage: (content: string, type: ChatMessage['type'], metadata?: ChatMessage['metadata']) => void
): UseSandboxReturn {
  const [sandboxData, setSandboxData] = useState<SandboxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<SandboxStatus>({ text: 'Not connected', active: false });
  const [responseArea, setResponseArea] = useState<string[]>([]);
  const [structureContent, setStructureContent] = useState('No sandbox created yet');
  const [showLoadingBackground, setShowLoadingBackground] = useState(false);
  const [sandboxFiles, setSandboxFiles] = useState<Record<string, string>>({});
  const [fileStructure, setFileStructure] = useState<string>('');

  const searchParams = useSearchParams();
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sandboxCreationRef = useRef<boolean>(false);

  const updateStatus = useCallback((text: string, active: boolean) => {
    setStatus({ text, active });
  }, []);

  const log = useCallback((message: string, type: 'info' | 'error' | 'command' = 'info') => {
    setResponseArea(prev => [...prev, `[${type}] ${message}`]);
  }, []);

  const displayStructure = useCallback((structure: unknown) => {
    if (typeof structure === 'object') {
      setStructureContent(JSON.stringify(structure, null, 2));
    } else {
      setStructureContent((structure as string) || 'No structure available');
    }
  }, []);

  const checkSandboxStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/sandbox-status');
      const data = await response.json();

      if (data.active && data.healthy && data.sandboxData) {
        setSandboxData(data.sandboxData);
        updateStatus('Sandbox active', true);
      } else if (data.active && !data.healthy) {
        updateStatus('Sandbox not responding', false);
      } else {
        setSandboxData(prev => {
          if (!prev) {
            updateStatus('No sandbox', false);
            return null;
          }
          updateStatus('Sandbox status unknown', false);
          return prev;
        });
      }
    } catch (error) {
      console.error('Failed to check sandbox status:', error);
      setSandboxData(prev => {
        if (!prev) {
          updateStatus('Error', false);
          return null;
        }
        updateStatus('Status check failed', false);
        return prev;
      });
    }
  }, [updateStatus]);

  const createSandbox = useCallback(async (fromHomeScreen = false): Promise<SandboxData | null> => {
    if (sandboxCreationRef.current) {
      console.log('[createSandbox] Sandbox creation already in progress, skipping...');
      return null;
    }

    sandboxCreationRef.current = true;
    console.log('[createSandbox] Starting sandbox creation...');
    setLoading(true);
    setShowLoadingBackground(true);
    updateStatus('Creating sandbox...', false);
    setResponseArea([]);

    try {
      const response = await fetch('/api/create-ai-sandbox-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();
      console.log('[createSandbox] Response data:', data);

      if (data.success) {
        sandboxCreationRef.current = false;
        console.log('[createSandbox] Setting sandboxData from creation:', data);
        setSandboxData(data);
        updateStatus('Sandbox active', true);
        log('Sandbox created successfully!');
        log(`Sandbox ID: ${data.sandboxId}`);
        log(`URL: ${data.url}`);

        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('sandbox', data.sandboxId);
        newParams.set('model', aiModel);
        router.push(`/generation?${newParams.toString()}`, { scroll: false });

        setTimeout(() => {
          setShowLoadingBackground(false);
        }, 3000);

        if (data.structure) {
          displayStructure(data.structure);
        }

        setTimeout(fetchSandboxFiles, 1000);

        console.log('[createSandbox] Sandbox ready with Vite server running');

        if (!fromHomeScreen) {
          addChatMessage(
            `Sandbox created! ID: ${data.sandboxId}. I now have context of your sandbox and can help you build your app. Just ask me to create components and I'll automatically apply them!\n\nTip: I automatically detect and install npm packages from your code imports (like react-router-dom, axios, etc.)`,
            'system'
          );
        }

        setTimeout(() => {
          if (iframeRef.current) {
            iframeRef.current.src = data.url;
          }
        }, 100);

        return data;
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error('[createSandbox] Error:', err);
      updateStatus('Error', false);
      log(`Failed to create sandbox: ${err.message}`, 'error');
      addChatMessage(`Failed to create sandbox: ${err.message}`, 'system');
      throw err;
    } finally {
      setLoading(false);
      sandboxCreationRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiModel, searchParams, router, updateStatus, log, displayStructure, addChatMessage]);

  const fetchSandboxFiles = useCallback(async () => {
    if (!sandboxData) return;

    try {
      const response = await fetch('/api/get-sandbox-files', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSandboxFiles(data.files || {});
          setFileStructure(data.structure || '');
          console.log('[fetchSandboxFiles] Updated file list:', Object.keys(data.files || {}).length, 'files');
        }
      }
    } catch (error) {
      console.error('[fetchSandboxFiles] Error fetching files:', error);
    }
  }, [sandboxData]);

  return {
    sandboxData,
    setSandboxData,
    loading,
    setLoading,
    status,
    showLoadingBackground,
    setShowLoadingBackground,
    responseArea,
    structureContent,
    updateStatus,
    log,
    displayStructure,
    checkSandboxStatus,
    createSandbox,
    fetchSandboxFiles,
    sandboxFiles,
    fileStructure,
    iframeRef,
    sandboxCreationRef,
  };
}
