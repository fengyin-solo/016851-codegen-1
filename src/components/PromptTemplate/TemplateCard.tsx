import { Card, Tag, Tooltip, Button, Popconfirm } from 'antd';
import {
  StarOutlined,
  StarFilled,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import type { PromptTemplate } from '../../types';
import './TemplateCard.css';

interface TemplateCardProps {
  template: PromptTemplate;
  onUse: (content: string) => void;
  onEdit: (template: PromptTemplate) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onPreview: (template: PromptTemplate) => void;
}

export function TemplateCard({
  template,
  onUse,
  onEdit,
  onDelete,
  onToggleFavorite,
  onPreview,
}: TemplateCardProps) {
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card
      className="template-card"
      hoverable
      onClick={() => onPreview(template)}
      actions={[
        <Tooltip key="favorite" title={template.isFavorite ? '取消收藏' : '收藏'}>
          <Button
            type="text"
            icon={template.isFavorite ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(template.id);
            }}
          />
        </Tooltip>,
        <Tooltip key="copy" title="复制内容">
          <Button
            type="text"
            icon={<CopyOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(template.content);
            }}
          />
        </Tooltip>,
        <Tooltip key="edit" title="编辑">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(template);
            }}
          />
        </Tooltip>,
        <Tooltip key="delete" title="删除">
          <Popconfirm
            title="确认删除"
            description="确定要删除这个模板吗？"
            onConfirm={() => onDelete(template.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDeleteClick}
            />
          </Popconfirm>
        </Tooltip>,
      ]}
    >
      <div className="template-card-header">
        <h4 className="template-name" title={template.name}>
          {template.name}
        </h4>
        <Tag color="blue" className="template-category">
          {template.category}
        </Tag>
      </div>

      {template.description && (
        <p className="template-description" title={template.description}>
          {template.description}
        </p>
      )}

      <div className="template-content-preview">
        {template.content.length > 100
          ? `${template.content.substring(0, 100)}...`
          : template.content}
      </div>

      <Button
        type="primary"
        size="small"
        className="use-template-btn"
        onClick={(e) => {
          e.stopPropagation();
          onUse(template.content);
        }}
      >
        使用模板
      </Button>
    </Card>
  );
}
