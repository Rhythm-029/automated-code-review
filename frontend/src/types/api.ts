// TypeScript types matching backend Pydantic schemas

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Category =
  | 'correctness'
  | 'bug_risk'
  | 'security'
  | 'performance'
  | 'readability'
  | 'maintainability'
  | 'testing'
  | 'general';
export type EngineMode = 'real_model' | 'demo';

export interface VerificationDetail {
  is_verified: boolean;
  grounding_score: number;
  evidence_found: boolean;
  identifiers_verified: string[];
  unverified_identifiers: string[];
  verification_notes?: string | null;
}

export interface ReviewComment {
  title: string;
  body: string;
  severity: Severity;
  category: Category;
  suggestion?: string | null;
  line?: number | null;
  end_line?: number | null;
  file_path?: string | null;
  code_snippet?: string | null;
  confidence?: number | null;
  evidence_assessment?: string | null;
  verification?: VerificationDetail | null;
}

export interface ReviewRequest {
  patch: string;
  oldf?: string;
  engine?: string;
  max_comments?: number;
  language?: string;
  verify_hallucinations?: boolean;
}

export interface ReviewResponse {
  review_id: string;
  status: string;
  summary?: string | null;
  language?: string | null;
  engine: string;
  mode: EngineMode;
  duration_ms: number;
  patch_chars: number;
  files_analyzed: number;
  files_skipped: number;
  lines_analyzed: number;
  comments: ReviewComment[];
  suppressed_findings: number;
  severity_counts: Record<string, number>;
  coverage?: Record<string, unknown>;
  verification?: Record<string, unknown>;
  limitations?: string[];
  created_at: string;
}

export interface StoredReview {
  review_id: string;
  engine: string;
  mode: EngineMode;
  duration_ms: number;
  patch_chars: number;
  patch_preview: string;
  summary?: string | null;
  comments: ReviewComment[];
  comment_count: number;
  suppressed_count: number;
  severity_counts: Record<string, number>;
  created_at: string;
}

export interface DashboardStats {
  total_reviews: number;
  total_comments: number;
  total_suppressed: number;
  avg_processing_time_ms: number;
  engine_breakdown: Record<string, number>;
  recent_reviews: StoredReview[];
  dataset_files_present?: boolean;
}

export interface GitHubTokenStatus {
  configured: boolean;
  valid: boolean;
  username?: string | null;
  rate_limit_limit?: number | null;
  rate_limit_remaining?: number | null;
  error?: string | null;
}

export interface GitHubPRRequest {
  pr_url?: string;
  repo_url?: string;
  pr_number?: number;
  engine?: string;
  max_comments?: number;
  max_files?: number | null;
  review_all_files?: boolean;
}

export interface GitHubPRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string | null;
}

export interface GitHubSkippedFile {
  filename: string;
  status: string;
  reason: string;
}

export interface GitHubPRInfo {
  title: string;
  number: number;
  state: string;
  author: string;
  base_branch: string;
  head_branch: string;
  base_sha?: string | null;
  head_sha?: string | null;
  description?: string | null;
  files: GitHubPRFile[];
  total_changed_files: number;
  total_fetched_files: number;
  url: string;
}

export interface GitHubReviewResponse {
  pr_info: GitHubPRInfo;
  summary?: string | null;
  total_files_changed: number;
  total_files_fetched: number;
  total_files_reviewed: number;
  skipped_files: GitHubSkippedFile[];
  file_reviews: ReviewResponse[];
  severity_counts: Record<string, number>;
  total_suppressed_findings: number;
  engine_used?: string;
  token_authenticated?: boolean;
}

export interface DatasetSplitStats {
  split: string;
  path: string;
  exists: boolean;
  record_count?: number | null;
  missing_fields?: Record<string, number> | null;
  empty_fields?: Record<string, number> | null;
  duplicate_ids?: number | null;
  exact_duplicate_records?: number | null;
  duplicate_patch_comment_pairs?: number | null;
  missing_oldf_count?: number | null;
  label_distribution?: Record<string, number> | null;
  comment_length_stats?: Record<string, number> | null;
  error?: string | null;
}

export interface DatasetAuditReport {
  audit_timestamp: string;
  splits: DatasetSplitStats[];
  cross_split_patch_comment_overlaps?: Record<string, unknown> | null;
  notes: string[];
}
