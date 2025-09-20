import React from 'react';
import { useParams } from 'react-router-dom';
import AIChat from '@/pages/AIChat';

const AIChatWrapper = () => {
  const { modelId, conversationId } = useParams<{ modelId: string; conversationId?: string }>();
  
  // Use uma chave que muda quando modelId ou conversationId mudam
  // Isso força o AIChat a remontar e reinicializar seu estado
  const key = `${modelId}-${conversationId || 'new'}`;

  return <AIChat key={key} />;
};

export default AIChatWrapper;