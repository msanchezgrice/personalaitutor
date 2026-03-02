insert into public.career_paths (id, name, core_skill_domain)
values
  ('product-management', 'Product Management', 'Rapid Prototyping & Strategy'),
  ('marketing-seo', 'Marketing & SEO', 'Content Automation & Growth'),
  ('branding-design', 'Branding & Design', 'Visual Identity & Generation'),
  ('quality-assurance', 'Quality Assurance', 'Automated Test Generation'),
  ('sales-revops', 'Sales / RevOps', 'Lead Scoring & Outreach'),
  ('customer-support', 'Customer Support', 'Automated Triaging & RAG'),
  ('operations', 'Operations (Ops)', 'Intelligent Workflow Automation'),
  ('software-engineering', 'Software Engineering', 'Full-Stack Execution')
on conflict (id) do update
set
  name = excluded.name,
  core_skill_domain = excluded.core_skill_domain;

insert into public.module_catalog (career_path_id, title, summary, order_index)
values
  ('product-management', 'Synthetic User Research', 'Synthetic User Research module for Product Management', 1),
  ('product-management', 'AI Wireframing', 'AI Wireframing module for Product Management', 2),
  ('product-management', 'PRD Generation', 'PRD Generation module for Product Management', 3),
  ('product-management', 'Sentiment Analysis', 'Sentiment Analysis module for Product Management', 4),

  ('marketing-seo', 'Programmatic SEO', 'Programmatic SEO module for Marketing & SEO', 1),
  ('marketing-seo', 'Bulk Content Generation', 'Bulk Content Generation module for Marketing & SEO', 2),
  ('marketing-seo', 'AI Keyword Clustering', 'AI Keyword Clustering module for Marketing & SEO', 3),
  ('marketing-seo', 'Copywriting Agents', 'Copywriting Agents module for Marketing & SEO', 4),

  ('branding-design', 'Image Synthesis', 'Image Synthesis module for Branding & Design', 1),
  ('branding-design', 'Style-consistent Training', 'Style-consistent Training module for Branding & Design', 2),
  ('branding-design', 'Vector Generation', 'Vector Generation module for Branding & Design', 3),
  ('branding-design', 'Video AI', 'Video AI module for Branding & Design', 4),

  ('quality-assurance', 'Edge-case Discovery via LLMs', 'Edge-case Discovery via LLMs module for Quality Assurance', 1),
  ('quality-assurance', 'Visual Regression', 'Visual Regression module for Quality Assurance', 2),
  ('quality-assurance', 'NLP-driven Test Scripts', 'NLP-driven Test Scripts module for Quality Assurance', 3),

  ('sales-revops', 'Predictive Lead Scoring', 'Predictive Lead Scoring module for Sales / RevOps', 1),
  ('sales-revops', 'Deep Data Enrichment', 'Deep Data Enrichment module for Sales / RevOps', 2),
  ('sales-revops', 'Hyper-personalized Cold Outreach', 'Hyper-personalized Cold Outreach module for Sales / RevOps', 3),

  ('customer-support', 'RAG Document Retrieval', 'RAG Document Retrieval module for Customer Support', 1),
  ('customer-support', 'Intelligent Ticket Routing', 'Intelligent Ticket Routing module for Customer Support', 2),
  ('customer-support', 'Tone & Sentiment Detection', 'Tone & Sentiment Detection module for Customer Support', 3),

  ('operations', 'Cross-application Data Sync', 'Cross-application Data Sync module for Operations (Ops)', 1),
  ('operations', 'OCR Document Processing', 'OCR Document Processing module for Operations (Ops)', 2),
  ('operations', 'Intelligent Extraction', 'Intelligent Extraction module for Operations (Ops)', 3),

  ('software-engineering', 'API Integration', 'API Integration module for Software Engineering', 1),
  ('software-engineering', 'System Architecture', 'System Architecture module for Software Engineering', 2),
  ('software-engineering', 'RAG Setup', 'RAG Setup module for Software Engineering', 3),
  ('software-engineering', 'Prompt Engineering in Code', 'Prompt Engineering in Code module for Software Engineering', 4)
on conflict (career_path_id, title) do update
set
  summary = excluded.summary,
  order_index = excluded.order_index;

insert into public.tool_catalog (career_path_id, name)
values
  ('product-management', 'Cursor'),
  ('product-management', 'v0.dev'),
  ('product-management', 'Claude 3.5'),
  ('product-management', 'OpenAI API'),

  ('marketing-seo', 'Jasper'),
  ('marketing-seo', 'ChatGPT'),
  ('marketing-seo', 'Python (Pandas/Scripts)'),

  ('branding-design', 'Midjourney'),
  ('branding-design', 'Stable Diffusion'),
  ('branding-design', 'Runway'),
  ('branding-design', 'Recraft'),

  ('quality-assurance', 'Playwright + Local LLMs'),
  ('quality-assurance', 'GitHub Copilot'),

  ('sales-revops', 'Clay'),
  ('sales-revops', 'Apollo + AI'),
  ('sales-revops', 'Zapier'),
  ('sales-revops', 'Make.com'),

  ('customer-support', 'Zendesk AI'),
  ('customer-support', 'Pinecone'),
  ('customer-support', 'Custom Python Flask APIs'),

  ('operations', 'Zapier'),
  ('operations', 'Make.com'),
  ('operations', 'OpenAI Vision API'),

  ('software-engineering', 'Python'),
  ('software-engineering', 'Node.js'),
  ('software-engineering', 'Langchain'),
  ('software-engineering', 'Cursor IDE')
on conflict (career_path_id, name) do nothing;
