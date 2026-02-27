'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { appConfig } from '@/config/app.config';

export interface UseProjectStateReturn {
  projectInstructions: string;
  setProjectInstructions: React.Dispatch<React.SetStateAction<string>>;
  instructionsExpanded: boolean;
  setInstructionsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  instructionsDirty: boolean;
  setInstructionsDirty: React.Dispatch<React.SetStateAction<boolean>>;
  hasPreloadedProject: boolean;
  setHasPreloadedProject: React.Dispatch<React.SetStateAction<boolean>>;
  projectLoading: boolean;
  setProjectLoading: React.Dispatch<React.SetStateAction<boolean>>;
  aiModel: string;
  setAiModel: React.Dispatch<React.SetStateAction<string>>;
  hasInitialSubmission: boolean;
  setHasInitialSubmission: React.Dispatch<React.SetStateAction<boolean>>;
  homeUrlInput: string;
  setHomeUrlInput: React.Dispatch<React.SetStateAction<string>>;
  homeContextInput: string;
  setHomeContextInput: React.Dispatch<React.SetStateAction<string>>;
  selectedStyle: string | null;
  setSelectedStyle: React.Dispatch<React.SetStateAction<string | null>>;
  showHomeScreen: boolean;
  setShowHomeScreen: React.Dispatch<React.SetStateAction<boolean>>;
  homeScreenFading: boolean;
  setHomeScreenFading: React.Dispatch<React.SetStateAction<boolean>>;
  shouldAutoGenerate: boolean;
  setShouldAutoGenerate: React.Dispatch<React.SetStateAction<boolean>>;
  saveInstructions: () => void;
}

export function useProjectState(): UseProjectStateReturn {
  const searchParams = useSearchParams();

  const [projectInstructions, setProjectInstructions] = useState('');
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  const [instructionsDirty, setInstructionsDirty] = useState(false);
  const [hasPreloadedProject, setHasPreloadedProject] = useState(false);
  const [projectLoading, setProjectLoading] = useState(true);
  const [hasInitialSubmission, setHasInitialSubmission] = useState(false);
  const [homeUrlInput, setHomeUrlInput] = useState('');
  const [homeContextInput, setHomeContextInput] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [showHomeScreen, setShowHomeScreen] = useState(true);
  const [homeScreenFading, setHomeScreenFading] = useState(false);
  const [shouldAutoGenerate, setShouldAutoGenerate] = useState(false);

  const [aiModel, setAiModel] = useState(() => {
    const modelParam = searchParams.get('model');
    return appConfig.ai.availableModels.includes(modelParam || '')
      ? modelParam!
      : appConfig.ai.defaultModel;
  });

  // Fetch preloaded instructions and project status
  useEffect(() => {
    fetch('/api/project-instructions')
      .then(r => r.json())
      .then(data => {
        if (data.text) {
          setProjectInstructions(data.text);
          setInstructionsExpanded(true);
        }
        if (data.hasProject) {
          setHasPreloadedProject(true);
        }
        setProjectLoading(false);
      })
      .catch(() => {
        setProjectLoading(false);
      });
  }, []);

  // Escape key closes home screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showHomeScreen) {
        setHomeScreenFading(true);
        setTimeout(() => {
          setShowHomeScreen(false);
          setHomeScreenFading(false);
        }, 500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHomeScreen]);

  const saveInstructions = useCallback(() => {
    fetch('/api/project-instructions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: projectInstructions }),
    })
      .then(() => setInstructionsDirty(false))
      .catch(() => {});
  }, [projectInstructions]);

  return {
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
    selectedStyle,
    setSelectedStyle,
    showHomeScreen,
    setShowHomeScreen,
    homeScreenFading,
    setHomeScreenFading,
    shouldAutoGenerate,
    setShouldAutoGenerate,
    saveInstructions,
  };
}
