// UPSC syllabus seed · GS1-4 + Essay + CSAT + Optional placeholder.
// Faithful to the official UPSC syllabus but condensed to topic-level.
// Status per topic: not-started | reading | revised | confident

export function defaultSyllabusTree() {
  return {
    GS1: {
      label: 'GS-I · History, Society, Geography',
      topics: [
        { id: 'gs1-art', label: 'Indian Art & Culture' },
        { id: 'gs1-mod', label: 'Modern Indian History (mid-18th c → present)' },
        { id: 'gs1-free', label: 'Freedom Struggle & post-Independence' },
        { id: 'gs1-world', label: 'World History (18th c onwards)' },
        { id: 'gs1-soc', label: 'Indian Society & Diversity' },
        { id: 'gs1-women', label: 'Role of women, population, urbanisation' },
        { id: 'gs1-globalisation', label: 'Globalisation & social effects' },
        { id: 'gs1-secularism', label: 'Communalism, secularism, regionalism' },
        { id: 'gs1-geo-physical', label: 'Physical Geography (world)' },
        { id: 'gs1-geo-resources', label: 'Resources & distribution (world & India)' },
        { id: 'gs1-geo-disasters', label: 'Geophysical phenomena & disasters' },
      ],
    },
    GS2: {
      label: 'GS-II · Polity, Governance, IR',
      topics: [
        { id: 'gs2-const', label: 'Indian Constitution: features, amendments, BR' },
        { id: 'gs2-fed', label: 'Federalism, devolution, local govt' },
        { id: 'gs2-sep', label: 'Separation of powers, judiciary' },
        { id: 'gs2-parl', label: 'Parliament & state legislatures' },
        { id: 'gs2-exec', label: 'Executive: PM, CoM, Cabinet committees' },
        { id: 'gs2-elec', label: 'Elections & RPA' },
        { id: 'gs2-pol', label: 'Pressure groups, parties, salient features' },
        { id: 'gs2-govt', label: 'Governance, transparency, e-governance' },
        { id: 'gs2-welfare', label: 'Welfare schemes & vulnerable sections' },
        { id: 'gs2-health', label: 'Health, education, human resources' },
        { id: 'gs2-ir-neighbours', label: 'India & neighbourhood' },
        { id: 'gs2-ir-bilateral', label: 'Bilateral, regional, global groupings' },
      ],
    },
    GS3: {
      label: 'GS-III · Economy, Sci-Tech, Environment, Security',
      topics: [
        { id: 'gs3-eco-growth', label: 'Indian economy: growth, planning, employment' },
        { id: 'gs3-eco-budget', label: 'Govt budgeting, taxation, FRBM' },
        { id: 'gs3-agri', label: 'Agriculture, MSP, food security' },
        { id: 'gs3-pds', label: 'PDS, food processing, land reforms' },
        { id: 'gs3-infra', label: 'Infrastructure: energy, ports, roads, airports' },
        { id: 'gs3-invest', label: 'Investment models, banking, NPAs' },
        { id: 'gs3-sci', label: 'Science & Tech: developments & applications' },
        { id: 'gs3-it', label: 'IT, space, biotech, nano' },
        { id: 'gs3-env', label: 'Environment, biodiversity, climate change' },
        { id: 'gs3-dm', label: 'Disaster management' },
        { id: 'gs3-sec-extremism', label: 'Internal security: extremism, terrorism' },
        { id: 'gs3-sec-cyber', label: 'Cyber security, money-laundering' },
        { id: 'gs3-sec-border', label: 'Border management, security agencies' },
      ],
    },
    GS4: {
      label: 'GS-IV · Ethics, Integrity, Aptitude',
      topics: [
        { id: 'gs4-ethics', label: 'Ethics & human interface' },
        { id: 'gs4-attitude', label: 'Attitude: content, structure, function' },
        { id: 'gs4-aptitude', label: 'Aptitude & foundational values for civil services' },
        { id: 'gs4-emot', label: 'Emotional intelligence' },
        { id: 'gs4-thinkers', label: 'Moral thinkers (Indian & world)' },
        { id: 'gs4-publicadm', label: 'Public/civil service values & ethics' },
        { id: 'gs4-prob', label: 'Probity in governance' },
        { id: 'gs4-cases', label: 'Case studies' },
      ],
    },
    Essay: {
      label: 'Essay',
      topics: [
        { id: 'essay-philo', label: 'Philosophical & abstract' },
        { id: 'essay-social', label: 'Social issues' },
        { id: 'essay-polity', label: 'Polity & governance' },
        { id: 'essay-eco', label: 'Economy' },
        { id: 'essay-env', label: 'Environment' },
        { id: 'essay-quotes', label: 'Quote-based prompts' },
      ],
    },
    CSAT: {
      label: 'CSAT',
      topics: [
        { id: 'csat-comprehension', label: 'Comprehension' },
        { id: 'csat-logical', label: 'Logical reasoning & analytical ability' },
        { id: 'csat-dm', label: 'Decision-making & problem-solving' },
        { id: 'csat-mental', label: 'General mental ability' },
        { id: 'csat-numeracy', label: 'Basic numeracy (Class X level)' },
        { id: 'csat-data', label: 'Data interpretation' },
      ],
    },
    Optional: {
      label: 'Optional (set later)',
      topics: [{ id: 'opt-tbd', label: 'pick & seed your optional' }],
    },
  };
}

export const STATUS_LABELS = {
  'not-started': { label: 'not started', color: 'var(--ink-mute)' },
  'reading':     { label: 'reading',     color: 'var(--info)' },
  'revised':     { label: 'revised',     color: 'var(--warn)' },
  'confident':   { label: 'confident',   color: 'var(--good)' },
};

export const DEFAULT_SOURCES = [
  { id: 'laxmikanth', label: 'Indian Polity (Laxmikanth)', subject: 'GS2' },
  { id: 'spectrum',   label: 'Modern History (Spectrum)',  subject: 'GS1' },
  { id: 'gcleong',    label: 'Physical Geography (GC Leong)', subject: 'GS1' },
  { id: 'ncert-old',  label: 'Old NCERT History',           subject: 'GS1' },
  { id: 'ncert-eco',  label: 'NCERT Economics (XI-XII)',    subject: 'GS3' },
  { id: 'shankar',    label: 'Shankar IAS Environment',     subject: 'GS3' },
  { id: 'ramesh',     label: 'Indian Economy (Ramesh Singh)', subject: 'GS3' },
  { id: 'lexicon',    label: 'Lexicon (Ethics)',            subject: 'GS4' },
  { id: 'thehindu',   label: 'The Hindu (daily)',           subject: 'CA' },
  { id: 'pib',        label: 'PIB / monthly compilations',  subject: 'CA' },
];
