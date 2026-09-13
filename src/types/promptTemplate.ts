export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  description?: string;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreatePromptTemplateParams {
  name: string;
  content: string;
  category: string;
  description?: string;
}

export interface UpdatePromptTemplateParams {
  name?: string;
  content?: string;
  category?: string;
  description?: string;
  isFavorite?: boolean;
}

export const DEFAULT_CATEGORIES = [
  '通用',
  '编程',
  '写作',
  '翻译',
  '数据分析',
  '创意',
  '学习',
  '其他',
] as const;

export type DefaultCategory = typeof DEFAULT_CATEGORIES[number];

export const DEFAULT_TEMPLATES: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '代码优化助手',
    category: '编程',
    description: '帮助优化代码性能和可读性',
    isFavorite: true,
    content: `请帮我优化以下代码，要求：
1. 提高代码性能
2. 增强可读性和可维护性
3. 添加必要的注释
4. 遵循最佳实践

代码：
\`\`\`
{{code}}
\`\`\``,
  },
  {
    name: 'Bug 调试专家',
    category: '编程',
    description: '帮助分析和修复代码中的 bug',
    isFavorite: true,
    content: `请帮我分析以下代码中的问题：

错误信息：
\`\`\`
{{error}}
\`\`\`

代码：
\`\`\`
{{code}}
\`\`\`

请帮我：
1. 定位问题根源
2. 提供修复方案
3. 解释为什么会出现这个问题`,
  },
  {
    name: '文章润色',
    category: '写作',
    description: '帮助润色和改进文章',
    isFavorite: false,
    content: `请帮我润色以下文章，要求：
1. 语言更加流畅自然
2. 结构更加清晰
3. 保持原意不变
4. 适合目标读者：{{audience}}

文章内容：
{{content}}`,
  },
  {
    name: '专业翻译',
    category: '翻译',
    description: '专业的多语言翻译助手',
    isFavorite: false,
    content: `请将以下文本从 {{source_language}} 翻译成 {{target_language}}：

要求：
1. 保持专业术语准确
2. 符合目标语言的表达习惯
3. 保留原文的语气和风格

文本：
{{text}}`,
  },
  {
    name: '数据分析报告',
    category: '数据分析',
    description: '帮助生成数据分析报告',
    isFavorite: false,
    content: `请帮我分析以下数据并生成报告：

数据：
\`\`\`
{{data}}
\`\`\`

请提供：
1. 数据概览和关键指标
2. 趋势分析
3. 异常值识别
4. 业务建议`,
  },
  {
    name: '创意头脑风暴',
    category: '创意',
    description: '帮助产生创意和灵感',
    isFavorite: false,
    content: `请帮我围绕以下主题进行头脑风暴：

主题：{{topic}}

目标：{{goal}}

请提供至少 10 个创意想法，按类别分组，并简要说明每个想法的实现思路。`,
  },
  {
    name: '学习计划制定',
    category: '学习',
    description: '帮助制定个性化学习计划',
    isFavorite: false,
    content: `请帮我制定一个学习计划：

学习目标：{{goal}}
当前水平：{{level}}
可支配时间：{{time_per_week}} 小时/周
计划周期：{{duration}} 周

请提供：
1. 阶段性目标拆解
2. 每周学习内容安排
3. 推荐学习资源
4. 检验学习成果的方法`,
  },
  {
    name: '通用问答',
    category: '通用',
    description: '通用的问题解答模板',
    isFavorite: true,
    content: `请详细回答以下问题：

{{question}}

请：
1. 先给出简洁的答案
2. 然后分点详细解释
3. 如有需要，提供实际例子
4. 最后给出相关的延伸阅读或进一步思考的方向`,
  },
];
