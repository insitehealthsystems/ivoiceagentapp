import { useState, type FormEvent } from 'react';

interface TextInputProps {
  disabled: boolean;
  onSubmit: (text: string) => void;
}

/** Optional text entry for development, debugging, accessibility, and testing without a microphone (spec section 35) -- uses the same /api/conversation path as voice. */
export default function TextInput({ disabled, onSubmit }: TextInputProps) {
  const [value, setValue] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    onSubmit(value);
    setValue('');
  }

  return (
    <form className="text-input-row" onSubmit={handleSubmit}>
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Type a question instead of speaking..."
        disabled={disabled}
      />
      <button type="submit" disabled={disabled}>
        Send
      </button>
    </form>
  );
}
