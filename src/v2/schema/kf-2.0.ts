export const KF_SCHEMA = {
  kf: '2.0',
  page_types: {
    source: 'A summary of one raw source; optional, written only when the source is long or the user asks.',
    concept: 'An idea, rule or process.',
    entity: 'A named thing: person, organisation, product, system.',
    comparison: 'Two or more subjects side by side.',
    synthesis: 'A topic overview, a synthesis across pages, or an answer the user chose to file.',
  },
  statuses: ['current', 'disputed', 'superseded', 'deprecated'] as const,
  required_fields: ['type', 'title', 'description', 'status', 'created', 'updated'] as const,
  optional_fields: ['as_of', 'aliases', 'tags', 'protected'] as const,
  relations: {
    supersedes: 'Replaces the target page as a whole.',
    derived_from: 'Was reasoned from the target page; not evidence.',
    contradicts: 'Conflicts with the target.',
    part_of: 'A component or member of the target\'s subject.',
    depends_on: 'Holds only while the target holds.',
    related: 'Connected in some other way.',
  },
  sections: ['Current', 'Evidence', 'Open', 'Sources', 'History'] as const,
  special_files: ['CONVENTIONS.md', 'index.md', 'log.md'] as const,
  history_events: [
    'created',
    'verified',
    'protected',
    'unprotected',
    'deprecated',
    'superseded',
    'merged',
  ] as const,
  quote_required_formats: ['pdf', 'docx', 'markdown', 'txt'] as const,
  quote_max_chars: 200,
  rule_codes: [
    'frontmatter_invalid',
    'slug_invalid',
    'section_order',
    'claim_invalid',
    'source_line_invalid',
    'source_path_invalid',
    'locator_not_found',
    'quote_not_found',
    'relation_invalid',
    'supersede_inconsistent',
    'dispute_inconsistent',
    'deprecate_incomplete',
    'protect_invalid',
    'history_invalid',
    'link_broken',
    'wikilink_found',
    'attachment_outside',
    'attachment_orphan',
  ] as const,
} as const;

export type PageType = keyof typeof KF_SCHEMA.page_types;
export type PageStatus = (typeof KF_SCHEMA.statuses)[number];
export type RelationType = keyof typeof KF_SCHEMA.relations;
export type SectionName = (typeof KF_SCHEMA.sections)[number];
export type HistoryEvent = (typeof KF_SCHEMA.history_events)[number];
export type RuleCode = (typeof KF_SCHEMA.rule_codes)[number];
