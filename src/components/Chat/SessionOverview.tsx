import { memo } from 'react';
import {
  CommentOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import type { StreamingStage } from '../../types';
import type { SessionOverviewData } from '../../utils/sessionOverview';
import { formatResponseTime } from '../../utils/formatters';
import './SessionOverview.css';

interface SessionOverviewProps {
  /** 概览数据（由消息列表派生） */
  overview: SessionOverviewData;
  /** 点击概览项时定位到对应消息 */
  onLocate: (messageId: string) => void;
}

/** 流式阶段的中文描述 */
const STAGE_LABELS: Record<StreamingStage, string> = {
  connecting: '建立连接',
  receiving: '接收回复',
};

/**
 * 会话概览组件
 * 展示当前会话的轮数、最近回复耗时与生成状态，
 * 点击任意一项可定位到对应的消息
 */
export const SessionOverview = memo(function SessionOverview({
  overview,
  onLocate,
}: SessionOverviewProps) {
  const {
    roundCount,
    lastResponseTime,
    lastReplyMessageId,
    lastUserMessageId,
    isStreaming,
    streamingStage,
    streamingMessageId,
    interruption,
  } = overview;

  // 一条消息都没有时，用明确的空态提示替代空白
  if (roundCount === 0 && !isStreaming) {
    return (
      <div className="session-overview session-overview-empty">
        <MessageOutlined className="session-overview-empty-icon" />
        <span className="session-overview-empty-text">暂无对话记录</span>
        <span className="session-overview-empty-hint">
          发送第一条消息后，这里会显示本次会话的概览
        </span>
      </div>
    );
  }

  // 生成状态项的文案与定位目标
  let statusValue: string;
  let statusTargetId: string | null;
  let statusClassName = 'idle';
  if (isStreaming) {
    const stageLabel = streamingStage ? STAGE_LABELS[streamingStage] : STAGE_LABELS.connecting;
    statusValue = `生成中 · ${stageLabel}`;
    statusTargetId = streamingMessageId;
    statusClassName = 'streaming';
  } else if (interruption) {
    const prefix = interruption.reason === 'manual' ? '已停止' : '已中断';
    statusValue = `${prefix} · 停在${STAGE_LABELS[interruption.stage]}阶段`;
    statusTargetId = interruption.messageId;
    statusClassName = 'interrupted';
  } else {
    statusValue = '未在生成';
    statusTargetId = lastReplyMessageId;
  }

  const items = [
    {
      key: 'rounds',
      icon: <CommentOutlined />,
      label: '对话轮数',
      value: `${roundCount} 轮`,
      targetId: lastUserMessageId,
      className: 'rounds',
    },
    {
      key: 'response-time',
      icon: <ClockCircleOutlined />,
      label: '最近回复耗时',
      value: lastResponseTime !== null ? formatResponseTime(lastResponseTime) : '—',
      targetId: lastReplyMessageId,
      className: 'response-time',
    },
    {
      key: 'status',
      icon: <ThunderboltOutlined />,
      label: '生成状态',
      value: statusValue,
      targetId: statusTargetId,
      className: statusClassName,
    },
  ];

  return (
    <div className="session-overview">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`session-overview-item ${item.className}`}
          disabled={!item.targetId}
          onClick={() => item.targetId && onLocate(item.targetId)}
          title={item.targetId ? '点击定位到对应消息' : undefined}
        >
          <span className="session-overview-item-icon">{item.icon}</span>
          <span className="session-overview-item-body">
            <span className="session-overview-item-label">{item.label}</span>
            <span className="session-overview-item-value">{item.value}</span>
          </span>
        </button>
      ))}
    </div>
  );
});
