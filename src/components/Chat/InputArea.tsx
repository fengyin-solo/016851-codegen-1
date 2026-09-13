import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Button, Input, message, Tooltip } from 'antd';
import { SendOutlined, StopOutlined, FileTextOutlined } from '@ant-design/icons';
import { validateMessageContent } from '../../utils/validators';
import { PromptTemplateLibrary } from '../PromptTemplate';
import './InputArea.css';

const { TextArea } = Input;

interface InputAreaProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  isLoading: boolean;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * 输入区域组件
 */
export function InputArea({
  onSend,
  onStop,
  isLoading,
  isStreaming,
  disabled = false,
  placeholder = '输入消息，按 Enter 发送，Shift + Enter 换行',
}: InputAreaProps) {
  const [content, setContent] = useState('');
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleUseTemplate = useCallback((templateContent: string) => {
    setContent(templateContent);
    setTemplateLibraryOpen(false);

    setTimeout(() => {
      const textArea = textAreaRef.current;
      if (textArea) {
        textArea.focus();
        textArea.selectionStart = templateContent.length;
        textArea.selectionEnd = templateContent.length;
      }
    }, 50);
  }, []);

  const handleSend = useCallback(() => {
    if (!validateMessageContent(content)) {
      message.warning('请输入消息内容');
      return;
    }

    if (isLoading || isStreaming) {
      return;
    }

    onSend(content.trim());
    setContent('');

    // 重新聚焦输入框
    setTimeout(() => {
      textAreaRef.current?.focus();
    }, 0);
  }, [content, isLoading, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter 发送，Shift + Enter 换行
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleStop = useCallback(() => {
    if (onStop) {
      onStop();
    }
  }, [onStop]);

  const isDisabled = disabled || (!isStreaming && isLoading);
  const showStopButton = isStreaming;

  return (
    <div className="input-area">
      <div className="input-container glass-card">
        <div className="input-toolbar">
          <Tooltip title="提示词模板库">
            <Button
              type="text"
              icon={<FileTextOutlined />}
              onClick={() => setTemplateLibraryOpen(true)}
              disabled={isDisabled}
              className="template-library-btn"
            >
              模板
            </Button>
          </Tooltip>
        </div>

        <div className="input-content-row">
          <TextArea
            ref={textAreaRef as React.RefObject<any>}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isDisabled}
            autoSize={{ minRows: 1, maxRows: 6 }}
            className="message-input"
          />

          <div className="input-actions">
          {showStopButton ? (
            <Button
              type="primary"
              danger
              icon={<StopOutlined />}
              onClick={handleStop}
              className="stop-button"
            >
              停止
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={isLoading}
              disabled={isDisabled || !content.trim()}
              className="send-button"
            >
              发送
            </Button>
          )}
          </div>
        </div>
      </div>

      <div className="input-hint">
        <span>按 Enter 发送，Shift + Enter 换行</span>
        <span className="hint-separator">|</span>
        <span className="template-hint" onClick={() => setTemplateLibraryOpen(true)}>
          <FileTextOutlined /> 点击打开提示词模板库
        </span>
      </div>

      <PromptTemplateLibrary
        open={templateLibraryOpen}
        onClose={() => setTemplateLibraryOpen(false)}
        onUseTemplate={handleUseTemplate}
      />
    </div>
  );
}
