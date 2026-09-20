import { useEffect, useMemo, useState } from 'react';
import { Tooltip } from 'antd';
import {
  MessageOutlined,
  FieldTimeOutlined,
  ThunderboltOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { Message, StreamPhase } from '../../types';
import { formatResponseTime } from '../../utils/formatters';
import {
  deriveSessionOverview,
  getGeneratingElapsed,
  PHASE_LABELS,
  STOP_REASON_LABELS,
} from './overviewModel';
import './SessionOverview.css';

interface SessionOverviewProps {
  messages: Message[];
  /** 是否正在生成 */
  isGenerating: boolean;
  /** 正在生成的消息 ID */
  generatingMessageId: string | null;
  /** 当前生成阶段 */
  generatingPhase: StreamPhase | null;
  /** 点击统计项，定位到对应消息 */
  onLocate: (messageId: string) => void;
}

/**
 * 聊天区域顶部的本次会话概览视图：
 * 轮数 / 最近一条回复耗时 / 是否仍在生成，点击可定位到对应消息。
 */
export function SessionOverview({
  messages,
  isGenerating,
  generatingMessageId,
  generatingPhase,
  onLocate,
}: SessionOverviewProps) {
  const overview = useMemo(
    () =>
      deriveSessionOverview(messages, {
        isGenerating,
        messageId: generatingMessageId,
        phase: generatingPhase,
      }),
    [messages, isGenerating, generatingMessageId, generatingPhase],
  );

  // 生成过程中每秒刷新一次，用于展示实时耗时
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!overview.isGenerating) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [overview.isGenerating]);

  // 空态：一条消息都还没有时给出明确提示
  if (messages.length === 0) {
    return (
      <div className="session-overview session-overview-empty">
        <MessageOutlined className="overview-empty-icon" />
        <div className="overview-empty-text">
          <p className="overview-empty-title">本次会话还没有任何消息</p>
          <p className="overview-empty-hint">在下方输入并发送第一条消息后，这里会显示轮数、最近回复耗时与生成状态</p>
        </div>
      </div>
    );
  }

  const generatingElapsed = getGeneratingElapsed(messages, overview.generatingMessageId, now);

  // 第二项：最近一条回复耗时
  const renderDurationValue = () => {
    if (overview.isGenerating && generatingElapsed !== null) {
      return (
        <span className="overview-value overview-value-live">
          {formatResponseTime(generatingElapsed)}
          <span className="overview-value-suffix">生成中…</span>
        </span>
      );
    }
    if (overview.lastResponseTime !== null) {
      return <span className="overview-value">{formatResponseTime(overview.lastResponseTime)}</span>;
    }
    // 最近一条回复未完成（超时 / 手动停止 / 中断）
    const stopInfo = overview.lastReply?.stopInfo;
    if (stopInfo) {
      const phaseText = stopInfo.phase ? `（停在「${PHASE_LABELS[stopInfo.phase]}」）` : '';
      return (
        <span className="overview-value overview-value-stopped">
          未完成
          <span className="overview-value-suffix">
            {STOP_REASON_LABELS[stopInfo.reason]}
            {phaseText}
          </span>
        </span>
      );
    }
    return <span className="overview-value overview-value-muted">—</span>;
  };

  // 第三项：眼下是否还在生成
  const renderStatusValue = () => {
    if (overview.isGenerating) {
      const phaseText = overview.generatingPhase
        ? PHASE_LABELS[overview.generatingPhase]
        : '';
      return (
        <span className="overview-value overview-value-live">
          <SyncOutlined spin className="overview-status-spinner" />
          生成中
          {phaseText && <span className="overview-value-suffix">{phaseText}</span>}
        </span>
      );
    }

    const lastReply = overview.lastReply;
    if (lastReply?.status === 'error' && lastReply.stopInfo) {
      const phaseText = lastReply.stopInfo.phase
        ? `，停在「${PHASE_LABELS[lastReply.stopInfo.phase]}」`
        : '';
      return (
        <span className="overview-value overview-value-stopped">
          <ExclamationCircleOutlined />
          {STOP_REASON_LABELS[lastReply.stopInfo.reason]}
          <span className="overview-value-suffix">{phaseText}</span>
        </span>
      );
    }

    return <span className="overview-value overview-value-idle">空闲</span>;
  };

  const items = [
    {
      key: 'rounds',
      icon: <MessageOutlined />,
      label: '本次轮数',
      target: overview.roundsTarget,
      tooltip: `共 ${overview.messageCount} 条消息，点击定位到最近一条`,
      children: (
        <span className="overview-value">
          {overview.rounds}
          <span className="overview-value-suffix">轮（{overview.messageCount} 条）</span>
        </span>
      ),
    },
    {
      key: 'duration',
      icon: <FieldTimeOutlined />,
      label: '最近回复耗时',
      target: overview.durationTarget,
      tooltip: '点击定位到最近一条回复',
      children: renderDurationValue(),
    },
    {
      key: 'status',
      icon: <ThunderboltOutlined />,
      label: '当前状态',
      target: overview.statusTarget,
      tooltip: '点击定位到最近一条回复',
      children: renderStatusValue(),
    },
  ];

  return (
    <div className="session-overview" aria-label="会话概览">
      {items.map((item) => {
        const content = (
          <div
            className={`overview-stat${item.target.disabled ? ' is-disabled' : ''}${
              item.key === 'status' && overview.isGenerating ? ' is-active' : ''
            }`}
          >
            <span className="overview-stat-icon">{item.icon}</span>
            <span className="overview-stat-body">
              <span className="overview-stat-label">{item.label}</span>
              {item.children}
            </span>
          </div>
        );

        return item.target.disabled ? (
          <div key={item.key} className="overview-stat-wrapper">
            {content}
          </div>
        ) : (
          <div key={item.key} className="overview-stat-wrapper">
            <Tooltip title={item.tooltip}>
              <button
                type="button"
                className="overview-stat-button"
                onClick={() => onLocate(item.target.messageId)}
              >
                {content}
              </button>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}
