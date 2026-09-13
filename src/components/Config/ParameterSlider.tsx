
import { Slider, InputNumber, Typography, Row, Col } from 'antd';
import './ParameterSlider.css';

const { Text } = Typography;

interface ParameterSliderProps {
  temperature: number;
  maxTokens: number;
  onTemperatureChange: (value: number) => void;
  onMaxTokensChange: (value: number) => void;
}

/**
 * 参数滑块组件
 */
export function ParameterSlider({
  temperature,
  maxTokens,
  onTemperatureChange,
  onMaxTokensChange,
}: ParameterSliderProps) {
  return (
    <div className="parameter-slider">
      {/* Temperature */}
      <div className="parameter-item">
        <div className="parameter-header">
          <label className="input-label">Temperature</label>
          <Text type="secondary" className="parameter-value">
            {temperature.toFixed(1)}
          </Text>
        </div>
        <Slider
          min={0}
          max={2}
          step={0.1}
          value={temperature}
          onChange={onTemperatureChange}
          marks={{
            0: '精确',
            1: '平衡',
            2: '创意',
          }}
        />
        <Text type="secondary" className="parameter-hint">
          较低的值使输出更确定，较高的值使输出更随机
        </Text>
      </div>

      {/* Max Tokens */}
      <div className="parameter-item">
        <div className="parameter-header">
          <label className="input-label">Max Tokens</label>
        </div>
        <Row gutter={16}>
          <Col span={16}>
            <Slider
              min={100}
              max={8192}
              step={100}
              value={maxTokens}
              onChange={onMaxTokensChange}
            />
          </Col>
          <Col span={8}>
            <InputNumber
              min={100}
              max={8192}
              step={100}
              value={maxTokens}
              onChange={(value) => value && onMaxTokensChange(value)}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>
        <Text type="secondary" className="parameter-hint">
          控制回复的最大长度
        </Text>
      </div>
    </div>
  );
}
