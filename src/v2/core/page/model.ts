import type {
  HistoryEvent,
  PageStatus,
  PageType,
  RelationType,
  RuleCode,
  SectionName,
} from '../../schema/kf-2.0';

export type ScalarValue = string | number | boolean | null;
export type FrontmatterValue = ScalarValue | ScalarValue[];

export type Frontmatter = {
  type?: PageType;
  title?: string;
  description?: string;
  status?: PageStatus;
  created?: string;
  updated?: string;
  as_of?: string;
  aliases?: string[];
  tags?: string[];
  protected?: boolean | string[];
} & Partial<Record<RelationType, string[]>>;

export type TitleLine = {
  text: string;
  line: number;
};

export type PageSection = {
  name: SectionName;
  heading_line: number;
  first_line: number;
  last_line: number;
};

export type Claim = {
  id: string;
  text: string;
  sources: string[];
  disputed: boolean;
  line: number;
};

export type OpenItem = {
  id: string;
  text: string;
  about: string[];
  sources: string[];
  line: number;
};

export type SourceEntry = {
  key: string;
  path: string;
  sha256: string;
  locator: string;
  quote: string | null;
  line: number;
};

export type HistoryClaim = {
  kind: 'claim';
  outcome: 'superseded' | 'retired';
  id: string;
  text: string;
  sources: string[];
  date: string;
  successor: string | null;
  reason: string | null;
  line: number;
};

export type HistoryEventEntry = {
  kind: 'event';
  date: string;
  event: HistoryEvent;
  actor: string;
  note: string | null;
  line: number;
};

export type HistoryEntry = HistoryClaim | HistoryEventEntry;

export type EvidenceBlock = {
  text: string;
  first_line: number;
  last_line: number;
};

export type PageLink = {
  line: number;
  target: string;
  image: boolean;
  external: boolean;
};

export type NextIds = {
  claim: string;
  open: string;
  source: string;
};

export type PageProblem = {
  code: RuleCode;
  line: number;
  message: string;
};

export type ParsedPage = {
  slug: string;
  frontmatter: Frontmatter;
  extra: Record<string, FrontmatterValue>;
  title_line: TitleLine | null;
  sections: PageSection[];
  claims: Claim[];
  open: OpenItem[];
  sources: SourceEntry[];
  history: HistoryEntry[];
  evidence: EvidenceBlock | null;
  links: PageLink[];
  next: NextIds;
  problems: PageProblem[];
};
