import { useState } from 'react';
import { Input, Button, Space, Typography } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { validateAPIKey } from '../../utils/validators';
import './APIKeyInput.css';

const { Text } = Typography;

interface APIKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/**
 * API 密钥输入组件
 */
export function APIKeyInput({ value, onChange, error }: APIKeyInputProps) {
  const [visible, setVisible] = useState(false);
  const isValid = validateAPIKey(value);

  const toggleVisibility = () => {
    setVisible(!visible);
  };

  const getStatus = (): "" | "error" | "warning" | undefined => {
    if (!value) return undefined;
    return isValid ? "" : 'error';
  };

  const getSuffix = () => {
    if (!value) return null;
    
    return (
      <Space>
        {isValid ? (
          <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />
        ) : (
          <CloseCircleOutlined style={{ color: 'var(--color-error)' }} />
        )}
        <Button
          type="text"
          size="small"
          icon={visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          onClick={toggleVisibility}
        />
      </Space>
    );
  };

  return (
    <div className="api-key-input">
      <label className="input-label">API Key</label>
      <Input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="请输入 SiliconFlow API Key"
        status={getStatus()}
        suffix={getSuffix()}
        size="large"
      />
      {error && (
        <Text type="danger" className="input-error">
          {error}
        </Text>
      )}
      <Text type="secondary" className="input-hint">
        从 SiliconFlow 控制台获取 API Key
      </Text>
    </div>
  );
}
