import PDFDocument from 'pdfkit';
import type { ResumeDetailResponse } from './resume.types.js';
import type { JobMatchAnalysis } from '../../ai/job/job-types.js';
import {
  buildReportData,
  scanForForbiddenValues,
  validateReportScores,
  type ReportData,
} from './resume-report-data.js';

export interface ReportPdfValidation {
  forbiddenTokens: string[];
  scoreErrors: string[];
  valid: boolean;
}

export function validateReportPdfData(report: ReportData, analysis?: JobMatchAnalysis | null): ReportPdfValidation {
  const forbiddenTokens = scanForForbiddenValues(report);
  const scoreErrors = validateReportScores(report, analysis);
  return { forbiddenTokens, scoreErrors, valid: forbiddenTokens.length === 0 && scoreErrors.length === 0 };
}

/**
 * Replacements for glyphs that standard PDF fonts (WinAnsi) cannot render.
 * Unmapped characters (emoji, symbols) are dropped so text never renders as
 * blank boxes or breaks generation. Wording is never altered.
 */
const GLYPH_FIXES: Array<[RegExp, string]> = [
  [/[—–]/g, '-'],
  [/→/g, '>'],
  [/←/g, '<'],
  [/[‘’‚]/g, "'"],
  [/[“”„]/g, '"'],
  [/…/g, '...'],
  [/\u00A0/g, ' '],
  [/[‐‑‒]/g, '-'],
];

/**
 * Strips lightweight markdown (bold/italic/code/links) that analysis and
 * extraction pipelines leave in text ("**React**" -> "React"). The PDF uses
 * Helvetica with no markdown renderer, so markers would otherwise print
 * literally. Wording is never altered.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '');
}

// WinAnsi printable range plus common typographic extras pdfkit can encode.
const UNSAFE_CHAR_PATTERN = /[^\x20-\x7E\xA0-\xFF‘’‚“”„†‡•…‰‹›€™–—]/g;

// Tech tokens whose all-caps run must never be split ("PostgreSQL" →
// "Postgre SQL" would corrupt a real word). Compared lowercased.
const PROTECTED_TOKENS = new Set(['postgresql', 'mongodb', 'mysql', 'nosql', 'graphql', 'fastapi', 'openai']);

// Common words that, glued as a suffix, almost always indicate a lost space
// ("solutionsusing" → "solutions using"). Short or structural fragments are
// deliberately absent so real compounds never split.
const GLUED_SUFFIXES = new Set(
  (
    'using with from into onto about across after before between beyond during because until ' +
    'again once also just only even ever never always usually really very more most much many ' +
    'such than some that this these those then them there where today time day week month year years ' +
    'team teams data cloud mobile server servers client clients user users code app apps api apis ' +
    'backend backends frontend frontends database databases pipeline pipelines framework frameworks ' +
    'service services platform platforms design secure reliable seamless scalable robust modern ' +
    'responsive dynamic efficient used led testing building monitoring engineering optimized designed ' +
    'developed deployed managed tested improved automated integrated migrated documented built'
  ).split(' '),
);

// Vocabulary guard for glued-word splitting: a split happens only between two
// known words and never inside a known word ("notebook", "interesting" and
// "testing" stay intact while "solutionsusing" is repaired).
const KNOWN_WORDS = new Set(
  (
    'a able about above across act action active after again agile against ago ahead aim air all allow ' +
    'almost along already also always among amount analysis analyst and annual another answer anyone ' +
    'anything apartment appear apply app apps api apis architecture architect area around article aspect ' +
    'asset assign assist assisting associate assume assure attach attempt attend attention august author ' +
    'auto available award aware away awesome backend background backlog balance batch bachelor be become ' +
    'because bedside before begin behind being believe below beside besides best better between beyond ' +
    'billion blank blend board boast boost born both bottom bound box branch brand brave breach break ' +
    'breakdown bridge brief bring broad broken budget build building built bulk business busy buyer cache ' +
    'calendar call called campaign campus cancel candidate cannot capability carbon card career carry case ' +
    'casting cause ceiling center century certain chain chair challenge change channel charge chase check ' +
    'checkout chief choice choose chosen citizen claim clarify class clean clear clerk click client clock ' +
    'clone close cloud cluster coach code codebase coffee collaborate college color column combine come ' +
    'comfort command comment commit common communicate company compare compile complete complex component ' +
    'compose compute computer concept concern conclude concrete conduct confer confusing contain container ' +
    'content contest context continue contract control convert convince cook cool cooperate cope copy cost ' +
    'costing could count country course cover craft crash create credit crisis criteria cross crowd crucial ' +
    'cruise crystal curb current custom customer cycle daily dance data database dataset date day debug ' +
    'december decide declare decline decorate decrease deduct deep default deficient degree delay deliver ' +
    'demand demo deploy dense depth derive design designer detail detect develop device devote diagnose ' +
    'diagram differ digital dine dinner direct dirty discover discuss disease dispatch display distance ' +
    'distinct dive divide dizzy doctor document dollar domain donate done doomsday doubt down downtime draft ' +
    'drain drama drastic draw dream dress drink drive driver drop drove drum dry dual due dump durable during ' +
    'dying eager early earn earth ease east easy eaten edge edit educate effect efficient eight eighty either ' +
    'elbow elder elect eleven eliminate elite else email embrace emerge employ empty enable enabling encounter ' +
    'end endure enemy energy engage engine engineer engineering enjoy enlarge enlighten enough enroll ensure ' +
    'ensuring enter entire entry envelope envy episode equal equip error escape essay essential estate ' +
    'estimate even evening event ever every evidence exact example exceed except excess exchange excite ' +
    'exclude excuse exist existing exit expand expect expense experience expert explain explore export expose ' +
    'express extend extra extreme fabric face fact factor fail faint fair faith fall false familiar family ' +
    'famous farm fast fatal father fault favor february fee feed feel fellow female fence ferry fewer fiber ' +
    'field fifth fifty fight figure file fill film final finance find fine finger finish fire firm first fiscal ' +
    'fitness five fixed flame flash fleet flesh flight flip float floor flour flow fluid focus follow food fool ' +
    'force forecast forget form formal format former fortune forum forward found frame framework frank free ' +
    'fresh friday friend friendly fringe from front frontend frost fruit fuel fulfill full fully fun fund funny ' +
    'further furthermore future gain galaxy game garden gather gauge gaze general generate gentle genuine ' +
    'geography giant gift ginger girl give given giver glad glance glare glass global globe glory glove glow ' +
    'glue goal going golden gone good goods grade grain grand grant graph grasp grass grave great greatest ' +
    'green greet grief grill grind grocery ground group grove grow growth guard guess guest guide guild guilty ' +
    'habit half hall halt halve hand handle handsome happen happy harbor hard harmful harsh harvest hate have ' +
    'having head heal health heard heart heat heavy hedge heel height held hello help helpful hence herb herd ' +
    'here hereby herein hereafter hero hidden high highlight hike hill history hit hobby hold holiday hollow ' +
    'home honest honey honor hood hope horn horror horse hostel hotel hound house however huge human humble ' +
    'humor hundred hungry hunt hurry hurt husband hybrid ideal identify image imagine impact implement improve ' +
    'include income indeed index indicate indoor induce industry infant infect infer inform inherit initial ' +
    'inject injury ink inner innermost input insert inside insight insist inspect inspire install instance ' +
    'instead instruct instrument insure intake integer integrated integrity interest interesting interface ' +
    'interior intern internal interpret interrupt interval interview into invest invite invoice involve iron ' +
    'island issue item ivory january java javascript jersey job join joint joke judge juice july june junior ' +
    'just keen keep kept kernel keyboard key kick kid kidney kind kindly king kiss kitchen kite kitten knee ' +
    'knife knight knit knock knot know known knows label labor large laser last lasting late later laugh ' +
    'launch law lawn lawyer layer lead leader leaf learn least leather leave lecture led left legacy legal ' +
    'legend lemon lend length lens lesson letter level lever liar liberal library license lie light lighten ' +
    'like likely limit linen liner link linux list listen listing literate little live lively liver living ' +
    'load loan local locate lock lodge logic lonely long look loop loose lord lose loss lost loud lounge love ' +
    'lovely lower loyal luck lucky lunar lunch lying machine magic magnet maintain major make maker manage ' +
    'managed mango manner manual many march margin marine mark market marriage marry mask mason match material ' +
    'math matter maximum maybe mayor meal mean meant measure meat medal media median medic medium meet meeting ' +
    'melody melon melt member memory mental mention mentor menu mercy merge merit merry message metal meter ' +
    'method metric micro middle midst might mighty migrate minor minus minute miracle mirror misused mobile ' +
    'mock model modem modern modest modify module moment monday money monitor monkey month mood moon moral more ' +
    'moreover morning most mostly mother motion motor mount mountain mouse mouth move movie much multi mural ' +
    'muscle museum music must mutual narrow nation nationwide native nature near nearby nearly neat necessary ' +
    'neck need needle negative neighbor neither nerve nest never newer newly news next nice niche night ' +
    'nighttime nine noble noise noisy nominal none noon nor normal north notebook notice notify notion novel ' +
    'november now nowhere number nurse obese obey object obtain obvious occur ocean october offer office often ' +
    'older olive omit once onion online only onset open operate opinion oppose optimal option oracle orange ' +
    'orbit order ordinary organ other others ought ounce outer outermost output outside over overall overrun ' +
    'overused own owner pace pack packet palace pale panel panic paper parade pardon parent parish park part ' +
    'partial party pass passage password patch path patient patrol pattern pause pave payment peace peach pearl ' +
    'pedal penalty pencil penny people pepper perceive percent perfect perform perhaps period permit person ' +
    'phase phone photo phrase pick picnic piece pier pilot pinch pine pink pioneer pitch pizza place plain ' +
    'plan plane planet plant plate platform plaza plead pleasant please pledge plenty plot plug plume plunge ' +
    'plural plus pocket poem poet point poison polar police policy polish polite pool poor pope popular porch ' +
    'port pose position possess possible post postal poster potato pound pour powder power practical praise ' +
    'pray preach precede precious prefer premier premise premium prepare present preserve press pressure ' +
    'pretend pretty prevent preview previous price pride priest prime print prior prison private prize probe ' +
    'problem proceed process produce product profile profit program project promise promote prompt proof ' +
    'proper property prose protect protein proud prove provide proxy public publish pudding pull pulse punch ' +
    'pupil purchase purple purpose push puzzle python qualify quality quantity quarter queen query quest queue ' +
    'quick quiet quilt quit quite quiz quota quote rabbit race rack radar radio raise rally ranch random range ' +
    'rapid rare rate rather reach react ready real really realm reap rear reason rebel recall receive recent ' +
    'recipe reckon record recover red redeem reduce refer refine reflect reform refresh regard regime region ' +
    'register regret regular rehearse reign relax relay release relief relieve rely remain remark remedy ' +
    'remember remind remote remove render renew rental repair repeat repel reply report represent require ' +
    'rescue research resemble reserve reside resign resist resolve resort resource respect respond response ' +
    'rest restore result resume retire return reveal review reward rhythm rice rich rider ridge rifle right ' +
    'rigid rinse riot ripen ripple rise risk river road roast robust rock rocket rogue role roll roof room ' +
    'root rope rose rotate rough round route routine royal rude rugby ruin rule ruler rumor rural rush rust ' +
    'safe salad salary sale salon salt salute same sample sand sandwich sane saturday sauce save scale scan ' +
    'scar scarce scatter scene scent school science scope score scorn scout scrap screen screw script scroll ' +
    'scrub season seat second secret section sector secure see seed seek seem seen segment seize seldom ' +
    'select seller sense sensor sent sentence separate september sequence serene series serious serve server ' +
    'service settle setup seven severe shade shadow shake shall shame shape share sharp shave sheep sheer ' +
    'sheet shelf shell shelter shift shine shiny ship shirt shock shoe shook shoot shop shore short should ' +
    'shout show shower shown shred shrink shrub shrug shut shy sick side siege sight sigma sign signal silent ' +
    'silver similar simple since sincere single sister sit site sixth sixty size skate sketch skill skillet ' +
    'skim skin skip skirt sleep slice slide slight slim sling slope slow small smart smell smile smith smoke ' +
    'smooth snack snake sneak sober soccer social sock soda sofa soft software solar soldier solid solve some ' +
    'someday someone something sometime sometimes song soon soothe sorry sort soul sound source south space ' +
    'spare spark speak special specific speech speed spell spend sphere spice spill spin spirit split spoke ' +
    'spoken sponsor spoon sport spot spray spread spring sprint squad square stable staff stage stair stake ' +
    'stale stall stamp stand standard standpoint stare start state static station statue status stay steady ' +
    'steak steal steam steel steep steer stem step stereo stick sticky stiff still sting stock stone stood ' +
    'stool stoop stop store storm story stove strap straw stray stream street strength stress stretch strict ' +
    'stride strike string stripe strive stroke strong stuck study stuff stump style subject submit subtle ' +
    'suburb such sudden suffer sugar suggest suite summer summit sunday sunny sunset super superuser supply ' +
    'support suppose supreme sure surface surge surplus survey survive suspect suspend sustain swallow swear ' +
    'sweat sweep sweet swell swept swift swim swing switch sword symbol system table taken talent talk tall ' +
    'tank taper target task taste taught tax teach team teams tear tease tempo tempt ten tend tender tenor ' +
    'tense tent tenth term terrace test tested text thank that their theirs theme then theory there thereby ' +
    'therefore therein these thick thief thigh thing think third thirst thirty thorn those though thought ' +
    'thousand thread threat three threw throat through throw thumb thunder thursday ticket tide tidy tie ' +
    'tight tile till time timer times timing title toast today token told tooth topic torch total touch ' +
    'tough tour toward tower town trace track trade traffic tragic trail train trait travel tray tread ' +
    'treat treaty tree trend trial tribe trick trigger trim trio trip triumph troop trout truck truly trunk ' +
    'trust truth try tuesday tumor tune tunnel turkey turn tutor twelve twenty twice twin twist type typical ' +
    'ugly ulcer ultra uncle under undergo underlie understand undertake underused unfair unfold unify union ' +
    'unique unit unite unity until upper uppermost upset urban urge urgent usage use used useful user users ' +
    'usual usually utility utter vacant valid validate value valve vanish vapor various vary vast vault ' +
    'vector vendor venue verse version versus vessel vest video view vigor village violate viral virtual ' +
    'virtue virus visa visit visual vital vivid vocal voice void volume voter voyage vulgar waddle wage wagon ' +
    'waist wait waive wake walk wall wallet wander want warm warn warp warrant wash waste watch water wave way ' +
    'weak wealth weapon wear weary weather weave wednesday weed week weekend weigh weight weird welcome weld ' +
    'well went were west whale what whatever wheat wheel when whenever where whereas whereby wherein ' +
    'wherever whether which while whip whirl whisk white whole wholesome wide widow width wife wild will ' +
    'willing win wind window wine wing winner winter wipe wire wisdom wise wish with withdraw within ' +
    'without witness wives wizard wobble woman women wonder wood wooden wool word work workflow world worry ' +
    'worth would wound woven wreck wrestle wright write writer wrong wrote yard yarn year yearly years yeast ' +
    'yellow yield young youth zero zone solutions solution seamless reliable standardize standardized provider ' +
    'optimize optimizing ensures enables pipeline pipelines platform platforms service services system systems ' +
    'software data cloud team teams code app apps api apis user users client clients server servers product ' +
    'products project projects business feature features performance quality experience summary strong robust ' +
    'modern responsive dynamic efficient scalable secure using with from and for full stack real time overused underused ' +
    'overusing underusing overtime springtime summertime wintertime dinnertime suppertime evermore nevermore yesterday undermost ' +
    'microservice microservices preserver preservers conserver conservers disservice misapplication shipbuilding ' +
    'housebuilding boatbuilding coachbuilding descaling'
  ).split(' '),
);

function safe(text: string): string {
  let out = stripMarkdown(text);
  for (const [pattern, replacement] of GLYPH_FIXES) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(UNSAFE_CHAR_PATTERN, '');
}

/**
 * pdfkit only wraps lines on whitespace, so a long run without spaces
 * (comma-joined skill chains, URLs) would overflow the page and get
 * clipped. Insert break opportunities inside runs of 60+ non-space
 * characters. Short tokens (CI/CD, Node.js, emails) are never touched.
 */
function breakLongRuns(text: string): string {
  return text.replace(/[^\s]{60,}/g, (run) => run.replace(/([,;/_])(?=\S)/g, '$1 '));
}

/**
 * Splits one glued lowercase token between two known words ("solutionsusing"
 * → "solutions using"). Triple-gated: pure-lowercase tokens of length 8+
 * only, never inside a known word, suffix must be a common word, and the
 * remaining stem must be long enough (or carry a word-like ending) and known.
 * Anything uncertain is left untouched — misses are safe, wrong splits are not.
 */
function splitGluedLower(token: string): string {
  if (!/^[a-z]{8,}$/.test(token)) return token;
  if (KNOWN_WORDS.has(token)) return token;
  for (let i = token.length - 3; i >= 4; i--) {
    const left = token.slice(0, i);
    const right = token.slice(i);
    if (!GLUED_SUFFIXES.has(right)) continue;
    if (left.length < 7 && !/(ing|ed|tion|sion|ers|ors|ess|ly|ive|able|ment|ance|ence|er|or)$/.test(left)) {
      continue;
    }
    if (!KNOWN_WORDS.has(left)) continue;
    return `${left} ${right}`;
  }
  return token;
}

function printable(text: string): string {
  return normalizeSpacing(breakLongRuns(safe(text)));
}

/**
 * Repairs spacing lost in PDF/Word text extraction ("Ltd.Nov" → "Ltd. Nov",
 * "2025Full" → "2025 Full", "a,b" → "a, b", "Intern•Designed" → "Intern •
 * Designed", "CommunicationsDec 2025" → "Communications Dec 2025",
 * "Coimbatore2024" → "Coimbatore 2024", "Supabasebackend" → "Supabase
 * backend"). Only unambiguous punctuation/digit/month/compound boundaries
 * are touched — camelCase tech terms ("JavaScript", "TypeScript") and real
 * words ("rebuilding", "interesting", "2020s", "Market") are left alone since
 * splitting them would corrupt text. Wording never changes.
 */
export function normalizeSpacing(text: string): string {
  return (
    text
      // Space after sentence-ending period glued to next sentence/bullet.
      .replace(/\.([A-Z•])/g, '. $1')
      // Space after comma/semicolon/colon glued to a word (never decimals or times/URLs).
      .replace(/,([A-Za-z])/g, ', $1')
      .replace(/;([A-Za-z])/g, '; $1')
      .replace(/:([A-Za-z])/g, ': $1')
      // Space after a bullet glyph glued to its item text ("•Implemented").
      .replace(/•([A-Za-z0-9])/g, '• $1')
      // Space around a month name glued to surrounding text ("CommunicationsDec 2025").
      .replace(/([A-Za-z])(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?=[\s\d])/g, '$1 $2')
      // Space between a letter and a glued 4-digit year ("Coimbatore2024 - 2028").
      .replace(/([A-Za-z])(\d{4})(?=[\s\-–—]|$)/g, '$1 $2')
      // Space between a year and glued lowercase text (never a lone "2020s").
      .replace(/(\d{4,})([a-z]{2,})/g, '$1 $2')
      // Space between a year (4+ digits) and a glued capitalized word.
      .replace(/(\d{4,})([A-Z])/g, '$1 $2')
      // Space before an all-caps acronym glued to a preceding word
      // ("ScienceCGPA: 8.02" → "Science CGPA: 8.02"). The left side must end
      // in a lowercase letter, so Titlecase tails ("JavaScript",
      // "TypeScript", "GitHub") and single capitals ("eBay", "iPhone") never
      // split; the trailing boundary keeps plurals like "APIs" intact; and
      // known tech tokens with all-caps runs are protected verbatim.
      .replace(/([A-Za-z]*?[a-z])([A-Z]{2,})(?![A-Za-z])/g, (m, left: string, right: string) => {
        if (PROTECTED_TOKENS.has(`${left}${right}`.toLowerCase())) return m;
        return `${left} ${right}`;
      })
      // Space before well-known compound tails glued to a preceding word
      // ("Supabasebackend" → "Supabase backend", "pipelines andoptimizing"
      // → "pipelines and optimizing"). The 3-letter guard keeps short stems
      // ("rebuilding", "observer") intact, and known one-word compounds
      // ("microservice", "preserver") are never split.
      .replace(
        /([a-z]{3,})((?:backend|frontend|database|server|pipeline|framework|endpoint|middleware|gateway|cluster|container|service|platform|application|optimizing|deploying|monitoring|automating|refactoring|migrating|orchestrating|containerizing|streamlining|standardizing|documenting|visualizing|scaling|building)s?)(?=[\s.,;:)\]}]|$)/g,
        (m, left: string, tail: string) =>
          KNOWN_WORDS.has(`${left}${tail}`.toLowerCase()) ? m : `${left} ${tail}`,
      )
      // Collapse ellipsis runs left by extraction ("react.... Add" → "react... Add").
      .replace(/\.{4,}/g, '...')
      // Split glued lowercase words between known vocabulary ("solutionsusing"
      // → "solutions using"). Runs last so earlier repairs feed it clean tokens.
      .replace(/\b[a-z]{8,}\b/g, (token) => splitGluedLower(token))
      // Space around a bullet glyph glued to surrounding words.
      .replace(/([A-Za-z0-9])•([A-Za-z])/g, '$1 • $2')
      // Collapse runs left behind by the repairs above.
      .replace(/[ \t]{2,}/g, ' ')
  );
}

// Rework CV palette: ink headings, violet primary, semantic accents.
const INK = '#114B3E';
const PRIMARY = '#7C3AED';
const BODY = '#334155';
const MUTED = '#64748B';
const FAINT = '#94A3B8';
const RULE = '#E2E8F0';
const ROW_TINT = '#F8FAFC';
const GREEN = '#16A36A';
const GREEN_DARK = '#166534';
const GREEN_TINT = '#F0FDF4';
const GREEN_LINE = '#86EFAC';
const RED_DARK = '#B91C1C';
const RED_TINT = '#FEF2F2';
const RED_LINE = '#FECACA';
const AMBER = '#B45309';
const AMBER_TINT = '#FFFBEB';
const AMBER_LINE = '#FDE68A';
const BLUE = '#1D4ED8';
const BLUE_TINT = '#EFF6FF';
const BLUE_LINE = '#BFDBFE';

// ---------------------------------------------------------------------------
// Design system: a single scale for type, spacing, and layout so every
// section shares the same rhythm. Gaps are explicit point values (never
// moveDown fractions, which scale with the active font size and caused the
// inconsistent section spacing). All y-advances go through gap().
// ---------------------------------------------------------------------------
const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';

const SIZE = {
  title: 20,
  scoreNum: 34,
  scoreTitle: 12.5,
  section: 12,
  sub: 10,
  body: 9.5,
  bullet: 9,
  small: 8.5,
  caption: 7.5,
} as const;

const LEAD = { body: 4, bullet: 3, small: 2 } as const;

const SPACE = {
  sectionBefore: 18,
  sectionAfter: 8,
  blockBefore: 8,
  blockAfter: 8,
  para: 6,
  bullet: 5,
  row: 5,
} as const;

// Fixed label columns keep every row family aligned on one x-grid.
const META_LABEL_W = 96;
const META_GAP = 12;
const SCORE_NAME_W = 170;
const SCORE_VALUE_W = 56;
const SCORE_WEIGHT_W = 100;
const SCORE_BAR_W = 120;
const SCORE_ROW_H = 24;
const CHECK_INDENT = 70;
const ACTION_INDENT = 72;

export class ResumeReportExportService {
  buildData(
    resume: ResumeDetailResponse,
    analysis?: JobMatchAnalysis | null,
    jobTitle?: string | null,
  ): ReportData {
    return buildReportData({ resume, analysis, jobTitle });
  }

  async generateReportPdf(
    resume: ResumeDetailResponse,
    analysis?: JobMatchAnalysis | null,
    jobTitle?: string | null,
  ): Promise<Buffer> {
    const report = buildReportData({ resume, analysis, jobTitle });

    const validation = validateReportPdfData(report, analysis);
    if (!validation.valid) {
      throw new Error(
        `Report data validation failed: ${[...validation.forbiddenTokens, ...validation.scoreErrors].join('; ')}`,
      );
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 50, left: 45, right: 45 },
        bufferPages: true,
        info: {
          Title: `Resume Analysis Report - ${report.candidate.filename}`,
          Author: 'Rework CV',
          Subject: 'ATS Resume Analysis Report',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const left = doc.page.margins.left;
      // Content must stop above the footer zone; the footer itself stays
      // inside pdfkit's page bottom so drawing it never triggers auto-pagination.
      const FOOTER_RESERVE = 26;
      const bottomLimit = () => doc.page.height - doc.page.margins.bottom - FOOTER_RESERVE;
      const footerRuleY = () => bottomLimit() + 10;

      /** Keep blocks together: start a fresh page when fewer than `needed` points remain. */
      const ensureSpace = (needed: number): void => {
        if (doc.y + needed > bottomLimit()) {
          doc.addPage();
        }
      };

      /** Advance by an exact point value on the shared x-grid. */
      const gap = (pts: number): void => {
        doc.y += pts;
        doc.x = left;
      };

      /** Full-width hairline divider at the current position. */
      const rule = (): void => {
        doc.strokeColor(RULE).lineWidth(1).moveTo(left, doc.y).lineTo(left + pageWidth, doc.y).stroke();
        doc.x = left;
      };

      /** Numbered section heading with accent badge and rule; never orphaned at a page bottom. */
      const sectionTitle = (title: string, accent = PRIMARY) => {
        ensureSpace(SPACE.sectionBefore + 80);
        gap(SPACE.sectionBefore);
        const raw = safe(title);
        const match = raw.match(/^(\d+)\.\s+(.*)$/);
        if (match) {
          const badgeR = 9;
          const top = doc.y;
          // Measure first so multi-line titles grow the badge row instead of overlapping it.
          doc.font(FONT_BOLD).fontSize(SIZE.section);
          const textH = doc.heightOfString(match[2], { width: pageWidth - 30, lineGap: 2 });
          const boxH = Math.max(badgeR * 2, textH);
          const cy = top + boxH / 2;
          doc.circle(left + badgeR, cy, badgeR).fill(accent);
          doc.font(FONT_BOLD).fontSize(10).fillColor('#FFFFFF');
          const numeralWidth = doc.widthOfString(match[1]);
          doc.text(match[1], left + badgeR - numeralWidth / 2, cy - 5);
          doc.font(FONT_BOLD).fontSize(SIZE.section).fillColor(INK)
            .text(match[2], left + badgeR * 2 + 8, top, {
              width: pageWidth - badgeR * 2 - 8,
              lineGap: 2,
            });
          doc.y = top + boxH;
        } else {
          doc.font(FONT_BOLD).fontSize(SIZE.section).fillColor(INK).text(raw, { width: pageWidth });
        }
        gap(6);
        rule();
        gap(SPACE.sectionAfter);
      };

      /** Subsection heading with consistent rhythm. `keepNext` reserves room
       * for the content that must follow the heading on the same page. */
      const subhead = (text: string, color: string = INK, keepNext = 0) => {
        ensureSpace(40 + keepNext);
        gap(SPACE.blockBefore);
        doc.font(FONT_BOLD).fontSize(SIZE.sub).fillColor(color).text(safe(text), { width: pageWidth });
        gap(5);
      };

      const body = (text: string) => {
        doc.font(FONT).fontSize(SIZE.body).fillColor(BODY)
          .text(printable(text), { width: pageWidth, lineGap: LEAD.body, align: 'left' });
        doc.x = left;
      };

      /** Bulleted paragraph with a colored dot and hanging indent; never split from its first line. */
      const bullet = (text: string, dot: string = MUTED) => {
        const clean = printable(text);
        const indent = 14;
        doc.font(FONT).fontSize(SIZE.bullet).fillColor(BODY);
        const height = doc.heightOfString(clean, { width: pageWidth - indent, lineGap: LEAD.bullet });
        ensureSpace(height + 8);
        const y = doc.y;
        doc.circle(left + 4, y + 5, 2.6).fill(dot);
        doc.fillColor(BODY).text(clean, left + indent, y, {
          width: pageWidth - indent,
          lineGap: LEAD.bullet,
        });
        gap(SPACE.bullet);
      };

      /** Aligned label/value row for the candidate information block. */
      const infoRow = (label: string, value: string) => {
        const clean = printable(value);
        doc.font(FONT).fontSize(9);
        const height = doc.heightOfString(clean, {
          width: pageWidth - META_LABEL_W - META_GAP,
          lineGap: 2,
        });
        ensureSpace(height + 6);
        const y = doc.y;
        doc.fillColor(MUTED).text(safe(label), left, y, { width: META_LABEL_W });
        doc.fillColor(BODY).text(clean, left + META_LABEL_W + META_GAP, y, {
          width: pageWidth - META_LABEL_W - META_GAP,
          lineGap: 2,
        });
        doc.y = y + height;
        gap(SPACE.row);
      };

      /** Small pill badge; returns its width for layout. */
      const pill = (text: string, x: number, y: number, fill: string, color: string, fontSize = 8.5): number => {
        const clean = safe(text);
        doc.font(FONT_BOLD).fontSize(fontSize);
        const width = doc.widthOfString(clean) + 16;
        const height = fontSize + 9;
        doc.roundedRect(x, y, width, height, height / 2).fill(fill);
        doc.fillColor(color).text(clean, x, y + 4.5, { width, align: 'center' });
        return width;
      };

      const priorityStyle = (priority: string): { fill: string; color: string; label: string } => {
        const label = priority.toUpperCase();
        if (priority.toLowerCase() === 'high') return { fill: RED_TINT, color: RED_DARK, label };
        if (priority.toLowerCase() === 'medium') return { fill: AMBER_TINT, color: AMBER, label };
        return { fill: BLUE_TINT, color: BLUE, label };
      };

      /** Recommendation row: priority pill plus wrapped text on a fixed indent grid. */
      const actionRow = (priority: string, text: string) => {
        const style = priorityStyle(priority);
        const clean = printable(text);
        doc.font(FONT).fontSize(9);
        const textHeight = doc.heightOfString(clean, {
          width: pageWidth - ACTION_INDENT,
          lineGap: 2,
        });
        ensureSpace(textHeight + 14);
        const rowY = doc.y;
        pill(style.label, left, rowY + 1, style.fill, style.color, 8);
        doc.fillColor(BODY).text(clean, left + ACTION_INDENT, rowY + 1, {
          width: pageWidth - ACTION_INDENT,
          lineGap: 2,
        });
        gap(SPACE.bullet + 1);
      };

      /** Thin progress bar (purely visual; scores stay in text). */
      const bar = (x: number, y: number, width: number, percent: number, color: string) => {
        const clamped = Math.min(100, Math.max(0, percent));
        doc.roundedRect(x, y, width, 6, 3).fill('#E2E8F0');
        if (clamped > 0) {
          doc.roundedRect(x, y, Math.max(8, (width * clamped) / 100), 6, 3).fill(color);
        }
      };

      /** Keyword/skill chips inside a measured panel. Words are never altered
       * (whitespace is only collapsed so tabs/newlines cannot inflate chip
       * geometry); rows are precomputed from measured widths, so headings can
       * never land on a chip row and rows never stretch past the margins. */
      const chips = (
        items: string[],
        fill: string,
        stroke: string,
        color: string,
        dot: string = MUTED,
        panelFill = '#FFFFFF',
        panelStroke = RULE,
      ) => {
        const clean = items.map((item) => printable(item).replace(/\s+/g, ' ').trim()).filter(Boolean);
        if (clean.length === 0) return;
        doc.font(FONT_BOLD).fontSize(SIZE.small);
        const chipH = 20;
        const gapX = 6;
        const gapY = 6;
        const pad = 10;
        // Greedy row layout from measured widths (single source of truth).
        const rows: Array<Array<{ text: string; width: number }>> = [[]];
        const wide: string[] = [];
        for (const item of clean) {
          const w = doc.widthOfString(item) + 18;
          if (w > pageWidth) {
            wide.push(item);
            continue;
          }
          const current = rows[rows.length - 1];
          const used = current.reduce((sum, chip) => sum + chip.width + gapX, 0);
          if (current.length > 0 && used + w > pageWidth) {
            rows.push([{ text: item, width: w }]);
          } else {
            current.push({ text: item, width: w });
          }
        }
        if (rows.length === 1 && rows[0].length === 0) rows.pop();
        const gridHeight = rows.length > 0 ? rows.length * chipH + (rows.length - 1) * gapY : 0;
        const panelHeight = gridHeight + pad * 2;

        if (rows.length > 0 && panelHeight <= 600) {
          ensureSpace(panelHeight + 10);
          const panelY = doc.y;
          doc.roundedRect(left, panelY, pageWidth, panelHeight, 8).fillAndStroke(panelFill, panelStroke);
          rows.forEach((row, rowIndex) => {
            let x = left + pad;
            const y = panelY + pad + rowIndex * (chipH + gapY);
            for (const chip of row) {
              doc.roundedRect(x, y, chip.width, chipH, chipH / 2).fillAndStroke(fill, stroke);
              doc.fillColor(color).text(chip.text, x, y + 6, { width: chip.width, align: 'center' });
              x += chip.width + gapX;
            }
          });
          doc.y = panelY + panelHeight + 10;
          doc.x = left;
        } else if (rows.length > 0) {
          // Exceptionally long lists: plain flow without a panel.
          ensureSpace(chipH + 4);
          let x = left;
          let y = doc.y;
          for (const row of rows) {
            for (const chip of row) {
              if (x + chip.width > left + pageWidth) {
                x = left;
                y += chipH + gapY;
                doc.y = y;
                ensureSpace(chipH + 4);
                y = doc.y;
              }
              doc.roundedRect(x, y, chip.width, chipH, chipH / 2).fillAndStroke(fill, stroke);
              doc.fillColor(color).text(chip.text, x, y + 6, { width: chip.width, align: 'center' });
              x += chip.width + gapX;
            }
            x = left;
            y += chipH + gapY;
            doc.y = y;
            ensureSpace(chipH + 4);
            y = doc.y;
          }
          doc.y = y + 8;
          doc.x = left;
        }

        // Single tokens wider than the page (pasted URLs): wrapped bullets, never clipped.
        for (const item of wide) {
          doc.font(FONT).fontSize(9);
          bullet(item, dot);
          doc.font(FONT_BOLD).fontSize(SIZE.small);
        }
        if (wide.length > 0) gap(4);
        doc.x = left;
      };

      // ---- Header ----
      doc.font(FONT_BOLD).fontSize(SIZE.title).fillColor(INK).text('Rework CV - Resume Intelligence Report');
      gap(6);
      rule();
      gap(8);
      if (report.candidate.name) infoRow('Candidate', report.candidate.name);
      if (report.overview.targetRole) infoRow('Target role', report.overview.targetRole);
      if (report.candidate.emailMasked) infoRow('Email', report.candidate.emailMasked);
      if (report.candidate.phoneMasked) infoRow('Phone', report.candidate.phoneMasked);
      infoRow('File', report.candidate.filename);
      infoRow('Date', report.overview.reportDate);
      gap(4);

      // ---- Score hero (borderless band: numeral, title + category pill, bar) ----
      const score = report.scores.overall;
      const suggestionCount = report.overview.suggestionCount;
      const bannerDesc =
        `${suggestionCount} improvement${suggestionCount === 1 ? '' : 's'}` +
        ' identified across 6 scored dimensions.';
      ensureSpace(118);
      const numY = doc.y;
      doc.font(FONT_BOLD).fontSize(SIZE.scoreNum).fillColor(GREEN).text(`${score}/100`, left, numY);
      const scoreTextX = left + 132;
      const scoreTitleY = numY + 4;
      doc.font(FONT_BOLD).fontSize(SIZE.scoreTitle).fillColor(INK)
        .text('Overall Match Score', scoreTextX, scoreTitleY);
      if (report.overview.category) {
        // widthOfString reflects the title font still in effect.
        const titleW = doc.widthOfString('Overall Match Score');
        const pillW = doc.font(FONT_BOLD).fontSize(SIZE.small).widthOfString(report.overview.category) + 18;
        const pillH = SIZE.small + 9;
        const pillX = scoreTextX + titleW + 10;
        const pillY = scoreTitleY - 1;
        doc.roundedRect(pillX, pillY, pillW, pillH, pillH / 2).fill(PRIMARY);
        doc.fillColor('#FFFFFF').text(report.overview.category, pillX, pillY + 4.5, {
          width: pillW,
          align: 'center',
        });
      }
      doc.font(FONT).fontSize(9).fillColor('#475569')
        .text(printable(bannerDesc), scoreTextX, scoreTitleY + 22, { width: pageWidth - 132 });
      doc.y = Math.max(doc.y, numY + 52);
      gap(6);
      bar(left, doc.y, pageWidth, score, GREEN);
      doc.y += 6;
      gap(10);
      rule();
      gap(SPACE.blockAfter);

      // ---- Overview ----
      sectionTitle('1. Overview', PRIMARY);
      if (report.overview.summary) {
        body(report.overview.summary);
        gap(SPACE.para);
      }
      if (report.overview.strengths?.length) {
        ensureSpace(52);
        doc.font(FONT_BOLD).fontSize(SIZE.sub).fillColor(GREEN_DARK).text('Key Strengths');
        const countLabel = `${report.overview.strengths.length}`;
        pill(countLabel, left + doc.widthOfString('Key Strengths') + 24, doc.y - 15, GREEN_TINT, GREEN_DARK);
        gap(SPACE.bullet);
        for (const s of report.overview.strengths) bullet(s, GREEN);
        gap(SPACE.blockAfter - SPACE.bullet);
      }
      if (report.overview.improvements?.length) {
        ensureSpace(52);
        doc.font(FONT_BOLD).fontSize(SIZE.sub).fillColor(AMBER).text('Key Improvements');
        const total = report.overview.improvements.length;
        pill(`${total}`, left + doc.widthOfString('Key Improvements') + 24, doc.y - 15, AMBER_TINT, AMBER);
        gap(SPACE.bullet);
        for (const s of report.overview.improvements.slice(0, 8)) bullet(s, AMBER);
        gap(SPACE.blockAfter - SPACE.bullet);
      }

      // ---- Score breakdown (aligned columns + visual bars) ----
      if (report.scores.breakdown) {
        sectionTitle('2. Score Breakdown (deterministic)', PRIMARY);
        const b = report.scores.breakdown;
        const rows: Array<[string, number, string, string]> = [
          ['Skills', b.skills, '40% weight', GREEN],
          ['Experience', b.experience, '20% weight', PRIMARY],
          ['Responsibilities', b.responsibilities, '15% weight', '#F59E0B'],
          ['Keywords', b.keywords, '10% weight', '#6366F1'],
          ['Education', b.education, '5% weight', '#EC4899'],
          ['Projects', b.projects, '10% weight', '#0891B2'],
        ];
        ensureSpace(rows.length * SCORE_ROW_H + 8);
        rows.forEach(([label, value, weight, color], index) => {
          const rowY = doc.y;
          if (index > 0) {
            doc.strokeColor('#EDF2F7').lineWidth(1)
              .moveTo(left, rowY).lineTo(left + pageWidth, rowY).stroke();
          }
          const midY = rowY + SCORE_ROW_H / 2;
          doc.font(FONT).fontSize(9.5).fillColor('#1E293B')
            .text(label, left, midY - 6, { width: SCORE_NAME_W });
          // Score, weight, and bar each sit in a fixed column, so every row
          // lines up and the exact score text stays selectable per segment.
          doc.font(FONT_BOLD).fontSize(9.5).fillColor(INK)
            .text(`${value}/100`, left + SCORE_NAME_W, midY - 6, {
              width: SCORE_VALUE_W,
              align: 'right',
            });
          doc.font(FONT).fontSize(SIZE.small).fillColor(MUTED)
            .text(`(${weight})`, left + SCORE_NAME_W + SCORE_VALUE_W + 8, midY - 5.5, {
              width: SCORE_WEIGHT_W,
            });
          bar(left + pageWidth - SCORE_BAR_W, midY - 3, SCORE_BAR_W, value, color);
          doc.y = rowY + SCORE_ROW_H;
        });
        doc.x = left;
        gap(SPACE.blockAfter);
      }

      // ---- Content ----
      if (report.content) {
        sectionTitle('3. Content Analysis', PRIMARY);
        if (report.content.score !== undefined) {
          ensureSpace(28);
          doc.font(FONT).fontSize(9).fillColor('#1E293B')
            .text(`Content score: ${report.content.score}/100`);
          gap(SPACE.row);
        }
        if (report.content.summaryText) {
          subhead('Summary');
          body(report.content.summaryText);
          gap(SPACE.para);
        }
        if (report.content.experienceText) {
          subhead('Experience (extracted)');
          body(report.content.experienceText.slice(0, 2000));
          gap(SPACE.para);
        }
        if (report.content.keywordsFound?.length || report.content.keywordsMissing?.length) {
          if (report.content.keywordsFound?.length) {
            subhead('Keywords found', GREEN_DARK, 40);
            chips(report.content.keywordsFound, GREEN_TINT, GREEN_LINE, GREEN_DARK, MUTED, ROW_TINT, RULE);
            gap(SPACE.blockAfter);
          }
          if (report.content.keywordsMissing?.length) {
            subhead('Keywords missing', RED_DARK, 40);
            chips(report.content.keywordsMissing, RED_TINT, RED_LINE, RED_DARK, MUTED, ROW_TINT, RULE);
            gap(SPACE.blockAfter);
          }
        }
        if (report.content.bulletImprovements?.length) {
          subhead('Rewrite suggestions');
          for (const item of report.content.bulletImprovements.slice(0, 6)) {
            if (item.issue) bullet(`Issue: ${item.issue}`, AMBER);
            if (item.suggestion) {
              doc.font(FONT_ITALIC).fontSize(SIZE.small).fillColor('#475569')
                .text(printable(`Suggestion: ${item.suggestion}`), { width: pageWidth, lineGap: 2 });
              doc.font(FONT).fillColor('#1E293B');
              gap(SPACE.row);
            }
          }
          gap(SPACE.blockAfter - SPACE.row);
        }
      }

      // ---- Skills ----
      if (report.skills) {
        sectionTitle('4. Skills Analysis', GREEN);
        if (report.skills.matchedRequired?.length) {
          subhead('Matched required skills', GREEN_DARK, 40);
          chips(report.skills.matchedRequired, GREEN_TINT, GREEN_LINE, GREEN_DARK, MUTED, ROW_TINT, RULE);
          gap(SPACE.blockAfter);
        }
        if (report.skills.missingRequired?.length) {
          subhead('Missing required skills', RED_DARK, 40);
          chips(report.skills.missingRequired, RED_TINT, RED_LINE, RED_DARK, MUTED, ROW_TINT, RULE);
          gap(SPACE.blockAfter);
        }
        if (report.skills.matchedPreferred?.length) {
          subhead('Matched preferred skills', BLUE, 40);
          chips(report.skills.matchedPreferred, BLUE_TINT, BLUE_LINE, BLUE, MUTED, ROW_TINT, RULE);
          gap(SPACE.blockAfter);
        }
        if (report.skills.missingPreferred?.length) {
          subhead('Missing preferred skills', AMBER, 40);
          chips(report.skills.missingPreferred, AMBER_TINT, AMBER_LINE, AMBER, MUTED, ROW_TINT, RULE);
          gap(SPACE.blockAfter);
        }
      }

      // ---- Format (only existing checks) ----
      if (report.format) {
        sectionTitle('5. Format Analysis', '#F59E0B');
        const checks: Array<{ label: string; pass: boolean; text: string }> = [];
        if (report.format.experience) {
          const e = report.format.experience;
          checks.push({
            label: 'Experience',
            pass: e.scorePercent >= 60,
            text:
              `Required ${e.requiredYears !== null && e.requiredYears !== undefined ? `${e.requiredYears} yr(s)` : 'not specified'}; ` +
              `detected ${e.detectedProfessionalYears} yr(s); level ${e.matchLevel}; score ${e.scorePercent}/100.` +
              (e.note ? ` ${e.note}` : ''),
          });
        }
        if (report.format.education) {
          const e = report.format.education;
          checks.push({
            label: 'Education',
            pass: e.scorePercent >= 60,
            text:
              `Match: ${e.matchLevel}; score ${e.scorePercent}/100.` +
              (e.detected.length > 0 ? ` Detected: ${e.detected.join('; ')}` : ''),
          });
        }
        for (const check of checks) {
          const clean = printable(check.text);
          doc.font(FONT).fontSize(9);
          const textHeight = doc.heightOfString(clean, {
            width: pageWidth - CHECK_INDENT,
            lineGap: 2,
          });
          ensureSpace(textHeight + 36);
          const rowY = doc.y;
          pill(check.pass ? 'PASS' : 'REVIEW', left, rowY, check.pass ? GREEN_TINT : AMBER_TINT, check.pass ? GREEN_DARK : AMBER);
          doc.font(FONT_BOLD).fontSize(9).fillColor(INK)
            .text(safe(check.label), left + CHECK_INDENT, rowY + 3);
          doc.font(FONT).fontSize(9).fillColor(BODY)
            .text(clean, left + CHECK_INDENT, rowY + 20, {
              width: pageWidth - CHECK_INDENT,
              lineGap: 2,
            });
          gap(SPACE.blockAfter);
        }
      }

      // ---- Sections ----
      if (report.sections) {
        sectionTitle('6. Sections Analysis', '#EC4899');
        if (report.sections.present.length > 0) {
          ensureSpace(report.sections.present.length * 20 + 24);
          for (const s of report.sections.present) {
            bullet(`${s.title}: present`, GREEN);
          }
          gap(SPACE.blockAfter - SPACE.bullet);
        }
        if (report.sections.educationMatch) {
          body(`Education match level: ${report.sections.educationMatch}`);
          gap(SPACE.para);
        }
      }

      // ---- Style (only existing findings) ----
      if (report.style) {
        sectionTitle('7. Style Analysis', '#6366F1');
        if (report.style.responsibilitiesMatched?.length) {
          subhead('Responsibilities aligned', GREEN_DARK);
          for (const r of report.style.responsibilitiesMatched.slice(0, 6)) bullet(r, GREEN);
          gap(SPACE.blockAfter - SPACE.bullet);
        }
        if (report.style.responsibilitiesUnmatched?.length) {
          subhead('Responsibilities to evidence', AMBER);
          for (const r of report.style.responsibilitiesUnmatched.slice(0, 6)) bullet(r, AMBER);
          gap(SPACE.blockAfter - SPACE.bullet);
        }
        if (report.style.relevantProjects?.length) {
          subhead('Relevant projects', INK);
          const projects = report.style.relevantProjects.slice(0, 5);
          projects.forEach((p, index) => {
            // The matcher emits "Unnamed Project" when the resume lists no
            // project title — show a clean numbered label instead.
            const displayName = p.name === 'Unnamed Project' ? `Project ${index + 1}` : p.name;
            bullet(`${displayName} (${p.relevancePercent}% match${p.relevantTech.length > 0 ? `: ${p.relevantTech.join(', ')}` : ''})`, PRIMARY);
          });
          gap(SPACE.blockAfter - SPACE.bullet);
        }
      }

      // ---- Action plan (existing recommendations only) ----
      if (report.action_plan) {
        sectionTitle('8. Action Plan', RED_DARK);
        if (report.action_plan.quickWins?.length) {
          subhead('Quick wins', RED_DARK);
          for (const r of report.action_plan.quickWins) {
            actionRow(r.priority, r.text);
            if (r.impact) {
              doc.font(FONT_ITALIC).fontSize(SIZE.small).fillColor(MUTED)
                .text(printable(`Impact: ${r.impact}`), left + ACTION_INDENT, doc.y, {
                  width: pageWidth - ACTION_INDENT,
                  lineGap: 2,
                });
              gap(SPACE.bullet);
            }
          }
          gap(SPACE.blockAfter - SPACE.bullet);
        }
        const remaining = report.action_plan.prioritized.filter((r) => r.priority !== 'high').slice(0, 8);
        if (remaining.length > 0) {
          subhead('Prioritized improvements');
          for (const r of remaining) {
            actionRow(r.priority, r.text);
          }
          gap(SPACE.blockAfter - SPACE.bullet);
        }
        if (report.action_plan.keywordsToConsider?.length) {
          subhead('Keywords to consider (only where truthful)', INK, 40);
          chips(report.action_plan.keywordsToConsider, BLUE_TINT, BLUE_LINE, BLUE, MUTED, ROW_TINT, RULE);
          gap(SPACE.blockAfter);
        }
      }

      // ---- AI insights (additional only; never overrides scores) ----
      if (report.aiSummary) {
        sectionTitle('Appendix: AI Insights (contextual guidance)', MUTED);
        body(report.aiSummary);
        gap(SPACE.para);
        if (report.action_plan?.aiActions?.length) {
          for (const a of report.action_plan.aiActions) {
            bullet(`[${a.priority.toUpperCase()}] ${a.recommendation}`, PRIMARY);
          }
          gap(SPACE.blockAfter - SPACE.bullet);
        }
      }

      // ---- Closing note ----
      gap(SPACE.blockBefore + 4);
      ensureSpace(30);
      doc.font(FONT).fontSize(SIZE.small).fillColor(FAINT).text(
        'Generated by Rework CV - Confidential Career Report. Scores are deterministic and derived from the existing analysis engine.',
        { align: 'center', width: pageWidth },
      );

      // ---- Per-page footer with page numbers (clean, consistent) ----
      // Footer geometry stays above the margin edge so it never triggers
      // pdfkit's automatic pagination (which would append blank pages).
      const pageRange = doc.bufferedPageRange();
      for (let i = 0; i < pageRange.count; i++) {
        doc.switchToPage(i);
        const ruleY = footerRuleY();
        doc.strokeColor(RULE).lineWidth(0.5).moveTo(left, ruleY).lineTo(left + pageWidth, ruleY).stroke();
        doc
          .font(FONT)
          .fontSize(SIZE.caption)
          .fillColor(FAINT)
          .text(`Page ${i + 1} of ${pageRange.count}`, left, ruleY + 5, { width: pageWidth, align: 'center' });
      }

      doc.end();
    });
  }
}

export const resumeReportExportService = new ResumeReportExportService();
