'use client';

import { useState, useRef, useCallback } from 'react';
import type { ChatMessage, ConversationContext } from '../types';

export interface UseConversationReturn {
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  aiChatInput: string;
  setAiChatInput: React.Dispatch<React.SetStateAction<string>>;
  conversationContext: ConversationContext;
  setConversationContext: React.Dispatch<React.SetStateAction<ConversationContext>>;
  chatMessagesRef: React.RefObject<HTMLDivElement | null>;
  addChatMessage: (content: string, type: ChatMessage['type'], metadata?: ChatMessage['metadata']) => void;
}

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  content:
    "Welcome! I can help you generate code with full context of your sandbox files and structure. Just start chatting - I'll automatically create a sandbox for you if needed!\n\nTip: If you see package errors like \"react-router-dom not found\", just type \"npm install\" or \"check packages\" to automatically install missing packages.",
  type: 'system',
  timestamp: new Date(),
};

const INITIAL_CONVERSATION_CONTEXT: ConversationContext = {
  scrapedWebsites: [],
  generatedComponents: [],
  appliedCode: [],
  currentProject: '',
  lastGeneratedCode: undefined,
};

export function useConversation(): UseConversationReturn {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([INITIAL_WELCOME_MESSAGE]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [conversationContext, setConversationContext] = useState<ConversationContext>(INITIAL_CONVERSATION_CONTEXT);

  const chatMessagesRef = useRef<HTMLDivElement | null>(null);

  const addChatMessage = useCallback(
    (content: string, type: ChatMessage['type'], metadata?: ChatMessage['metadata']) => {
      setChatMessages(prev => {
        if (type === 'system' && prev.length > 0) {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage.type === 'system' && lastMessage.content === content) {
            return prev;
          }
        }
        return [...prev, { content, type, timestamp: new Date(), metadata }];
      });
    },
    []
  );

  return {
    chatMessages,
    setChatMessages,
    aiChatInput,
    setAiChatInput,
    conversationContext,
    setConversationContext,
    chatMessagesRef,
    addChatMessage,
  };
}
