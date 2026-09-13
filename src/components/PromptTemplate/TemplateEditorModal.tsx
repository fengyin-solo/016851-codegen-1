import { useEffect } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import type { PromptTemplate, CreatePromptTemplateParams } from '../../types';
import { DEFAULT_CATEGORIES } from '../../types';

interface TemplateEditorModalProps {
  open: boolean;
  template: PromptTemplate | null;
  onClose: () => void;
  onSave: (params: CreatePromptTemplateParams) => void;
}

export function TemplateEditorModal({ open, template, onClose, onSave }: TemplateEditorModalProps) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      if (template) {
        form.setFieldsValue({
          name: template.name,
          description: template.description,
          category: template.category,
          content: template.content,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          category: '通用',
        });
      }
    }
  }, [open, template, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onSave(values);
      message.success(template ? '模板已更新' : '模板已创建');
      onClose();
    } catch {
      message.error('请填写完整信息');
    }
  };

  return (
    <Modal
      title={template ? '编辑模板' : '新建模板'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      width={600}
      okText="保存"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 16 }}
      >
        <Form.Item
          name="name"
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        >
          <Input placeholder="例如：代码优化助手" maxLength={50} showCount />
        </Form.Item>

        <Form.Item
          name="description"
          label="模板描述"
        >
          <Input placeholder="简短描述模板的用途" maxLength={100} showCount />
        </Form.Item>

        <Form.Item
          name="category"
          label="分类"
          rules={[{ required: true, message: '请选择分类' }]}
        >
          <Select
            placeholder="选择分类"
            allowClear
            options={DEFAULT_CATEGORIES.map((cat) => ({
              label: cat,
              value: cat,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="content"
          label="提示词内容"
          rules={[{ required: true, message: '请输入提示词内容' }]}
        >
          <Input.TextArea
            placeholder="输入提示词模板内容，使用 {{变量名}} 作为占位符"
            rows={8}
            maxLength={2000}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
