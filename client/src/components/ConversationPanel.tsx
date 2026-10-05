import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types/conversation';
import MessageBubble from './MessageBubble';

export default function ConversationPanel({ messages }: { messages: ChatMessage[] }) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="conversation-panel">
      {messages.length === 0 && <p className="conversation-empty">Ask iLocate where hospital equipment is located.</p>}
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
