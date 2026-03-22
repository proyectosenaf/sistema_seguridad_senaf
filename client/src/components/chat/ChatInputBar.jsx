import React from "react";
import FileUploadButton from "./FileUploadButton.jsx";
import AudioRecorderButton from "./AudioRecorderButton.jsx";

const EmojiIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M8 15s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

export default function ChatInputBar({
  inputRef,
  value,
  onChange,
  onKeyDown,
  onSend,
  onToggleEmoji,
  emojiOpen,
  placeholder,
  disabled,
  onFileSelected,
  onAudioRecorded,
}) {
  return (
    <div className="chat-input">
      <button
        type="button"
        onClick={onToggleEmoji}
        className="chat-input__action"
        aria-label="Emojis"
        title={emojiOpen ? "Ocultar emojis" : "Emojis"}
      >
        <EmojiIcon />
      </button>

      <FileUploadButton onFileSelected={onFileSelected} />
      <AudioRecorderButton onAudioRecorded={onAudioRecorded} />

      <input
        ref={inputRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={false}
      />

      <button
        type="button"
        onClick={onSend}
        className="chat-send"
        disabled={disabled}
      >
        Enviar
      </button>
    </div>
  );
}