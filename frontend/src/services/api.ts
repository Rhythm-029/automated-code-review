// API service layer — all calls to the backend
import axios from 'axios';
import type {
  ReviewRequest,
  ReviewResponse,
  StoredReview,
  ModelStatus,
  DashboardStats,
  GitHubPRRequest,
  GitHubReviewResponse,
  GitHubTokenStatus,
  DatasetAuditReport,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 150_000,
  headers: { 'Content-Type': 'application/json' },
});

export interface OllamaHealth {
  status: string;
  ollama_reachable: boolean;
  base_url: string;
  target_model: string;
  target_model_installed: boolean;
  installed_models?: string[];
  error?: string;
  help?: string;
}

// ── Review ─────────────────────────────────────────────────────────────────

export async function submitReview(req: ReviewRequest): Promise<ReviewResponse> {
  const { data } = await api.post<ReviewResponse>('/api/review', req);
  return data;
}

// ── History ────────────────────────────────────────────────────────────────

export async function fetchReviews(limit = 50): Promise<StoredReview[]> {
  const { data } = await api.get<StoredReview[]>('/api/reviews', { params: { limit } });
  return data;
}

export async function fetchReviewById(id: string): Promise<StoredReview> {
  const { data } = await api.get<StoredReview>(`/api/reviews/${id}`);
  return data;
}

export async function deleteReview(id: string): Promise<void> {
  await api.delete(`/api/reviews/${id}`);
}

// ── Model status ───────────────────────────────────────────────────────────

export async function fetchModelStatus(): Promise<ModelStatus> {
  const { data } = await api.get<ModelStatus>('/api/model/status');
  return data;
}

// ── Dashboard stats ────────────────────────────────────────────────────────

export async function fetchStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/api/stats');
  return data;
}

// ── Health ─────────────────────────────────────────────────────────────────

export async function fetchHealth(): Promise<{ status: string; active_engine?: string; ollama_reachable?: boolean }> {
  const { data } = await api.get('/api/health');
  return data;
}

export async function fetchOllamaHealth(): Promise<OllamaHealth> {
  const { data } = await api.get<OllamaHealth>('/api/health/ollama');
  return data;
}

// ── GitHub ─────────────────────────────────────────────────────────────────

export async function fetchGitHubStatus(): Promise<GitHubTokenStatus> {
  const { data } = await api.get<GitHubTokenStatus>('/api/github/status');
  return data;
}

export async function reviewGitHubPR(req: GitHubPRRequest): Promise<GitHubReviewResponse> {
  const { data } = await api.post<GitHubReviewResponse>('/api/github/pull-request', req);
  return data;
}

// ── Dataset audit ──────────────────────────────────────────────────────────

export async function fetchDatasetAudit(): Promise<DatasetAuditReport> {
  const { data } = await api.get<DatasetAuditReport>('/api/dataset/audit');
  return data;
}
