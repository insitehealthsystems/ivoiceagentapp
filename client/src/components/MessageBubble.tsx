import type { ChatMessage } from '../types/conversation';

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const className = ['message-bubble', message.speaker === 'You' ? 'message-bubble--you' : 'message-bubble--agent', message.isError ? 'message-bubble--error' : ''].join(' ').trim();

  return (
    <div className={className}>
      <div className="message-speaker">{message.speaker}</div>
      <div className="message-text">{message.text}</div>
    </div>
  );
}
