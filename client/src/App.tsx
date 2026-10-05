import './styles/app.css';
import ConversationPanel from './components/ConversationPanel';
import MicrophoneButton from './components/MicrophoneButton';
import StatusIndicator from './components/StatusIndicator';
import TextInput from './components/TextInput';
import { useConversation } from './hooks/useConversation';

function App() {
  const { state, messages, canStartNewRequest, tapMicrophone, sendTypedText, resetConversation } = useConversation();

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>iLocate</h1>
          <p className="app-subtitle">Hospital Asset Assistant</p>
        </div>
        <button className="reset-button" onClick={resetConversation}>
          New Conversation
        </button>
      </header>

      <ConversationPanel messages={messages} />

      <TextInput disabled={!canStartNewRequest} onSubmit={sendTypedText} />

      <div className="control-area">
        <StatusIndicator state={state} />
        <MicrophoneButton state={state} onTap={tapMicrophone} />
      </div>
    </div>
  );
}

export default App;
