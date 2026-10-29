"""Create the printable public workbook; no user data is collected."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'apps/web/public/downloads/career-remapping-workbook.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
NAVY, TEAL, INK, MUTED, LINE, PALE = map(HexColor, ['#132c3a', '#087f78', '#183743', '#47616b', '#cbdcdb', '#eef7f5'])
W, H, M = 612, 792, 46
c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
c.setTitle('Career Remapping Workbook | My AI Skill Tutor')
c.setAuthor('My AI Skill Tutor')
style = ParagraphStyle('body', fontName='Helvetica', fontSize=10.2, leading=15, textColor=INK, spaceAfter=6)
small = ParagraphStyle('small', parent=style, fontSize=9, leading=12.5)
heading = ParagraphStyle('heading', parent=style, fontName='Helvetica-Bold', fontSize=16, leading=21, textColor=NAVY)
page = 0
y = 0

def paragraph(text, font=style, gap=9):
    global y
    p = Paragraph(text, font)
    _, h = p.wrap(W-2*M, 700)
    if y-h < 64:
        raise ValueError(f'Page {page} overflows: {text[:55]}')
    p.drawOn(c, M, y-h)
    y -= h+gap

def start(number, title, subtitle):
    global page, y
    if page:
        c.showPage()
    page = number
    c.setFillColor(NAVY); c.rect(0, H-102, W, 102, fill=1, stroke=0)
    c.setFont('Helvetica-Bold', 9); c.setFillColor(HexColor('#91d6c6')); c.drawString(M,H-32,'MY AI SKILL TUTOR  /  CAREER REMAPPING')
    c.setFillColor(white); c.setFont('Helvetica-Bold',23); c.drawString(M,H-65,title)
    c.setFont('Helvetica',10); c.setFillColor(HexColor('#d4e8e5')); c.drawString(M,H-85,subtitle)
    c.setStrokeColor(LINE); c.line(M,44,W-M,44)
    c.setFont('Helvetica',8); c.setFillColor(MUTED); c.drawString(M,30,'myaiskilltutor.com  |  Printable workbook  |  October 2026, v1')
    c.drawRightString(W-M,30,f'{number} / 7')
    y=H-126

def field(label, lines=1):
    global y
    paragraph(label, small, 2)
    c.setStrokeColor(LINE)
    for _ in range(lines):
        y-=21; c.line(M,y,W-M,y)
    y-=12

def box(text):
    global y
    p=Paragraph(text,small); _,h=p.wrap(W-2*M-24,500)
    c.setFillColor(PALE); c.roundRect(M,y-h-20,W-2*M,h+20,8,fill=1,stroke=0)
    p.drawOn(c,M+12,y-h-10); y-=h+32

def table(headers, rows, widths, row_heights=None):
    global y
    cells=[[Paragraph(escape(str(v)),small) for v in row] for row in [headers]+rows]
    t=Table(cells,colWidths=widths,rowHeights=row_heights,repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),0.5,LINE),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9)]))
    _,h=t.wrap(W-2*M,700)
    if y-h<64: raise ValueError(f'Table overflows page {page}')
    t.drawOn(c,M,y-h); y-=h+16

start(1,'Your next move starts here.','From past work to your next proof project')
paragraph('You already have a work history. Use this workbook to investigate what may transfer, compare two directions, and choose a small project that gives you something concrete to show.')
box('<b>The method</b><br/>Actual tasks - transferable capabilities - two possible directions - one important gap - one proof project - a truthful career story.')
paragraph('Take a first pass in 20-30 minutes, then return with current role descriptions and project evidence. This is a starting session, not a promise of a completed career plan. Print the pages or annotate your own copy. No resume upload is needed.')
paragraph('Choose your starting question',heading)
for text in ['Adapt within my current kind of work.','Investigate adjacent work.','Consider a larger career change.','Find near-term work while exploring a longer-term direction.','Compare options because I am unsure.']:
    c.setStrokeColor(TEAL); c.rect(M,y-11,9,9,fill=0,stroke=1)
    p=Paragraph(escape(text),style); _,h=p.wrap(W-2*M-21,100); p.drawOn(c,M+21,y-h); y-=h+10
field('Work I want to keep doing')
field('Constraints that matter: available time, tools, location, schedule')
field('Date I will review this plan')

start(2,'Start with actual tasks.','01 / Make your experience visible')
paragraph('Use "I did..." statements. Include an output and the judgment involved. Keep your historical title accurate. Mark evidence unavailable when you cannot share it; keep confidential files private.')
box('<b>Fictional example:</b> "I reproduced gameplay defects and documented expected versus actual behavior." Possible capabilities: case design and clear defect reporting. Evidence status: self-reported history; old studio files unavailable. This suggests a connection to investigate, not verified AI experience.')
table(['Actual task','Output / decision','Possible capability','Evidence I may use'],[[f'{i}.','','',''] for i in range(1,6)],[150,120,125,125],[42]+[69]*5)
paragraph('Cross out connections that overstate your work. Add a missing task. A blank or uncertain connection is allowed.',small)

start(3,'Compare two directions.','02 / Check the work behind the title')
paragraph('Use current employer descriptions. Save exact links and check dates. Compare responsibilities, prerequisites, interests, and constraints. Neither direction fitting is a valid result.')
table(['Question','Direction A','Direction B'],[[q,'',''] for q in ['Role or work direction','Exact employer link + check date','Three recurring tasks','My relevant task evidence','Capability still unassessed','Important prerequisites','Interests / constraints','Question to answer next']],[180,170,170],[30]+[44]*8)
box('<b>Fictional example:</b> Rin compares software QA with product operations. QA appears closer to reported test-design work. Scripting remains unassessed. Product operations needs more evidence. No fit percentage or hiring probability is assigned.')
field('My provisional choice and what could change my mind',2)

start(4,'Define one proof project.','03 / Test the connection with a small piece of work')
paragraph('Choose one task from your provisional direction. Keep it small enough to finish, inspect, and explain. Use synthetic or public material when you cannot use real data, and label it.')
for label in ['User, problem, and output','Input and tools I already have','Capability I will practice','What AI may assist with / what I will decide and check','Effort limit and a smaller scope if needed']:
    field(label)
paragraph('Three observable completion checks',heading)
for label in ['1. Normal case','2. Edge or missing-input case','3. Failure or recovery case']:
    field(label)
box('Keep some cases separate from the ones used to improve the work. A local checker using saved synthetic replies demonstrates checker mechanics; it does not measure live-model performance.')

start(5,'Keep evidence with each claim.','04 / Report what actually happened')
paragraph('Save permitted inputs, source files, run/open instructions, actual results, decisions, and limitations. A screenshot or generated case study helps explain the work; it does not replace the underlying evidence.')
table(['Claim','Artifact / source','Check + actual result','Review status / limit'],[['','','',''] for _ in range(3)],[130,130,130,130],[43,72,72,72])
box('<b>Reported:</b> my account of prior work.<br/><b>Inferred:</b> a connection I am investigating.<br/><b>Demonstrated in this project:</b> supported by the example under stated conditions.<br/>Record who reviewed it and what they checked. Self-review is not independent certification. Missing results remain unassessed.')
field('One failure I observed')
field('What I changed or decided because of it')
field('What remains unresolved')

start(6,'Tell a story you can defend.','05 / Connect your background to recent practice')
paragraph('Complete this draft using supported claims. Keep independent projects separate from employment history.')
for label in ['My background is in...','I have experience doing...','I am exploring... because it uses...','My recent independent project demonstrates...','Under these conditions...','I am still learning...']:
    field(label)
box('<b>Project resume bullet:</b> built/did + specific task + output/check + scope. Add a measured outcome only when you have the baseline and result.')
paragraph('<b>Illustrative wording, only after comparable work is complete:</b> "Built a local checker for synthetic support replies, with required-field and escalation checks, reproducible cases, and a documented failure report."')
paragraph('Do not rename a past job, invent AI employment, or imply production deployment from a local demonstration.',small)

start(7,'Make the next step concrete.','06 / A flexible seven-step sequence')
paragraph('This is a suggested sequence, not a promise of getting hired in a week. Keep a near-term job search alongside learning when needed.')
table(['Step','Action','Evidence of progress'],[
['1','Complete the task inventory','Five tasks and corrected connections'],['2','Inspect two directions','Current employer links and requirements'],['3','Choose a question to test','Project brief and completion checks'],['4','Build a small first version','Inspectable files or outputs'],['5','Check it and record a failure','Actual results and a revision decision'],['6','Write a short case study','Problem, contribution, evidence, limits'],['7','Prepare one resume or conversation','Accurate claims and a next question']], [38,210,272])
field('My next action')
field('When I will do it')
paragraph('At your review date: continue, narrow the project, investigate the alternative, or seek help with a specific gap.')
paragraph('Keep learning from the work',heading)
paragraph('<link href="https://www.myaiskilltutor.com/assessment/" color="#087f78"><u>Start an AI learning assessment</u></link> or explore the <link href="https://www.myaiskilltutor.com/learn" color="#087f78"><u>learning library</u></link>. No account is needed to start the assessment.')
paragraph('This workbook supports your planning. It does not verify employment history, certify capability, or promise a hiring outcome. Correct the map as you learn.',small)
c.save()
print(f'Created {OUT} ({OUT.stat().st_size:,} bytes, {page} pages)')
