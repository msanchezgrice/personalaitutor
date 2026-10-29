"""Convert the reviewed career manuscripts to the existing learning content schema."""
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/content/2026-10-29-career-remapping'

def clean(text):
    return text.replace('https://www.myaiskilltutor.com', '').replace('/sign-up?redirect_url=/onboarding/', '/assessment/')

def blocks(text):
    lines = text.strip().splitlines()
    out = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith('|'):
            table = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                table.append([clean(c.strip()) for c in lines[i].strip().strip('|').split('|')])
                i += 1
            out.append({'type': 'table', 'columns': table[0], 'rows': table[2:]})
            continue
        if re.match(r'^(- |\d+\. )', line):
            ordered = bool(re.match(r'^\d+\.', line))
            items = []
            while i < len(lines) and re.match(r'^(- |\d+\. )', lines[i].strip()):
                items.append(clean(re.sub(r'^(- |\d+\. )', '', lines[i].strip())))
                i += 1
            out.append({'type': 'list', 'ordered': ordered, 'items': items})
            continue
        if line.startswith('> '):
            out.append({'type': 'quote', 'text': clean(line[2:])})
            i += 1
            continue
        paragraph = [line]
        i += 1
        while i < len(lines) and lines[i].strip():
            paragraph.append(lines[i].strip())
            i += 1
        out.append({'type': 'paragraph', 'text': clean(' '.join(paragraph))})
    return out

def sections(text):
    chunks = re.split(r'^## (.+)$', text, flags=re.M)
    out = []
    intro = re.sub(r'^# .+\n', '', chunks[0]).strip()
    if intro:
        out.append({'id': 'start-here', 'title': 'Start here', 'paragraphs': [], 'blocks': blocks(intro)})
    faq = []
    for title, body in zip(chunks[1::2], chunks[2::2]):
        if title == 'Frequently asked questions':
            for question, answer in re.findall(r'\*\*(.+?)\*\*\s*\n\n(.*?)(?=\n\n\*\*|\Z)', body.strip(), flags=re.S):
                faq.append({'question': question, 'answer': re.sub(r'\s+', ' ', clean(answer.strip()))})
            continue
        slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
        out.append({'id': slug, 'title': title, 'paragraphs': [], 'blocks': blocks(body)})
    return out, faq

takeaways = [
    ['Choose one target role before rewriting your resume.', 'Translate actual tasks into capabilities without changing historical titles.', 'Keep independent AI projects separate from past employment.', 'Connect each project claim to evidence and limitations.'],
    ['Separate what changed from what you fear may happen.', 'Compare adapting, moving adjacent, and retraining.', 'Choose one gap you can investigate with a small project.', 'Keep a near-term job search alongside learning when needed.'],
    ['Translate studio language into tasks other teams understand.', 'Compare opportunities inside games and in adjacent industries.', 'Use fresh synthetic examples when former work is confidential.', 'Restart a focused search with accurate evidence and current employer links.'],
    ['Define a target role through its actual responsibilities.', 'Build one bounded work sample with observable completion checks.', 'Show how you check AI output and own the final decisions.', 'Bring accurate evidence into applications, conversations, and interviews.'],
    ['Map actual tasks before mapping titles.', 'Compare two directions by responsibilities and constraints.', 'Make missing evidence visible instead of assigning a fit score.', 'Use one project to test the connection and revise your plan.'],
]
related = [
    ['career-mapping-transferable-skills', 'prove-ai-skills-to-employers'],
    ['career-mapping-transferable-skills', 'how-to-get-a-job-in-the-age-of-ai'],
    ['career-mapping-transferable-skills', 'ai-skills-for-resume'],
    ['ai-skills-for-resume', 'career-mapping-transferable-skills'],
    ['ai-skills-for-resume', 'how-to-get-a-job-in-the-age-of-ai'],
]
articles = []
for index, file in enumerate(sorted(SOURCE.glob('0*.md'))):
    _, frontmatter, body = file.read_text().split('---', 2)
    meta = dict(line.split(': ', 1) for line in frontmatter.strip().splitlines())
    article_sections, faq = sections(body.strip())
    article = {
        'slug': meta['proposed_slug'], 'category': 'Career Proof',
        'title': re.search(r'^# (.+)$', body, re.M).group(1),
        'metaTitle': json.loads(meta['meta_title']), 'description': json.loads(meta['meta_description']),
        'heroSummary': json.loads(meta['meta_description']),
        'readingTime': f'{math.ceil(len(body.split()) / 220)} min read',
        'publishedAt': '2026-10-29', 'updatedAt': '2026-10-29',
        'takeaways': takeaways[index],
        'keywords': [meta['primary_keyword']] + [k.strip() for k in meta['secondary_keywords'].strip('[]').split(',')],
        'sections': article_sections, 'faq': faq, 'relatedSlugs': related[index],
        'resource': {'href': '/learn/career-remapping-workbook', 'label': 'Get the Career Remapping Workbook', 'description': 'Map five tasks, compare two directions, and choose one proof project. No resume upload required.'},
    }
    articles.append(article)

workbook = (SOURCE / 'career-remapping-workbook.md').read_text()
workbook = workbook.replace('## From past work to your next proof project', '').replace('My AI Skill Tutor · Version 1 · October 2026', '')
workbook_sections, _ = sections(workbook)
articles.append({
    'slug': 'career-remapping-workbook', 'category': 'Career Proof',
    'title': 'Career Remapping Workbook', 'metaTitle': 'Career Remapping Workbook: Map Skills to Your Next Move',
    'description': 'Map past tasks to transferable skills, compare two career directions, and define one proof project. Read online or download the free printable workbook.',
    'heroSummary': 'Your experience still gives you somewhere to start. Map five actual tasks, compare two directions, and define one small project that makes your next move more credible.',
    'readingTime': '20–30 min exercise', 'publishedAt': '2026-10-29', 'updatedAt': '2026-10-29',
    'takeaways': ['Read the exercise online or download your own printable copy.', 'Keep private details and confidential employer work out of the exercise.', 'Correct the map as you learn; no fit percentage or hiring promise.', 'Turn one important gap into a project you can inspect and explain.'],
    'keywords': ['career mapping worksheet', 'transferable skills worksheet', 'career remapping workbook'],
    'sections': workbook_sections,
    'faq': [{'question': 'Do I need an account or resume upload?', 'answer': 'No. Read the worksheet here or download the PDF. Keep your answers in your own copy.'}, {'question': 'Will this workbook tell me which job I will get?', 'answer': 'No. It helps you investigate directions, compare requirements, and define a small proof project. It does not verify your history or guarantee a hiring outcome.'}],
    'relatedSlugs': ['career-mapping-transferable-skills', 'how-to-get-a-job-in-the-age-of-ai'],
    'resource': {'href': '/downloads/career-remapping-workbook.pdf', 'label': 'Download workbook (PDF)', 'description': 'A free printable workbook. Print it or annotate your own copy; nothing you write is sent to us.', 'download': True},
})
for article in articles[:-1]:
    last = article['sections'][-1]
    last['blocks'].insert(0, {'type': 'paragraph', 'text': '[Get the free Career Remapping Workbook](/learn/career-remapping-workbook) and complete the exercise in your own copy.'})

target = ROOT / 'apps/web/lib/career-learn-content.ts'
target.write_text('// Generated from the reviewed manuscripts by scripts/content/generate_career_guides.py.\nimport type { LearnArticle } from "./learn-content";\n\nexport const careerLearnArticles: LearnArticle[] = '+json.dumps(articles, ensure_ascii=False, indent=2)+';\n')
print(f'Generated {len(articles)} career guides from reviewed source.')
