/**
 * ragflow_client.ts — RAGFlow API Client , connects this backend to flask
 *
 * Provides type-safe functions for interacting with Flask API endpoints directly.
 * Handles:
 * - Dataset management and resolution
 * - Document upload, parsing, and deletion
 * - Query and retrieval operations
 * - Chat completions with optional streaming
 * - Session management
 * - Resource recommendations
 *
 * All calls go directly to Flask AI proxy
 */

import fetch, { HeadersInit } from 'node-fetch';
import FormData from 'form-data';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '../../..', '.env'),
});

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
const RAGFLOW_API_KEY = process.env.RAGFLOW_API_KEY || '';
const API_BASE = `${AI_SERVICE_URL}/api/ragflow` || 'http://localhost:5001/api/ragflow';

type Json = Record<string, any>;

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface LessonPlan {
  title: string;
  class_name: string;
  subject: string;
  topic: string;
  duration_minutes: number;
  learning_objectives: string[];
  materials_needed: string[];
  sections: {
    name: string;
    duration_minutes: number;
    content: string;
    activities: string[];
  }[];
  differentiation: {
    struggling: string;
    advanced: string;
  };
  zero_resource_tips: string[];
}

export interface RAGResource {
  name: string;
  url: string;
  state?: string;
  language: string[];
  description: string;
  is_exemplary: boolean;
  tags: string[];
}

export interface RAGDataset {
  id: string;
  name: string;
  description?: string;
  chunk_method?: string;
  [key: string]: any;
}

export interface RAGDocument {
  id?: string;
  document_id?: string;
  name?: string;
  filename?: string;
  status?: string;
  [key: string]: any;
}

export interface RAGChunk {
  id?: string;
  content?: string;
  score?: number;
  similarity?: number;
  document_id?: string;
  [key: string]: any;
}

/**
 * DatasetRef provides a stable reference to a dataset.
 * Maintains both the RAGFlow UUID and human-readable name.
 */
export interface DatasetRef {
  appKey: string;
  ragflowId: string;
  ragflowName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get headers for RAGFlow API calls.
 */
function getHeaders(customHeaders: Record<string, string> = {}): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  if (RAGFLOW_API_KEY) {
    headers['Authorization'] = `Bearer ${RAGFLOW_API_KEY}`;
  }
  return headers;
}

/**
 * Parse JSON response, handling both JSON and plain text responses.
 * FIXED: Removed explicit Response type to avoid node-fetch vs undici conflict.
 */
async function parseJson<T = any>(response: any): Promise<T> {
  const text = await response.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || `Request failed with ${response.status}`);
  }

  return data as T;
}

/**
 * Execute GET request and parse JSON response.
 */
async function getJson<T = any>(url: string): Promise<T> {
  const response = await fetch(url, { headers: getHeaders() });
  return parseJson<T>(response);
}

/**
 * Execute POST request with JSON body and parse response.
 */
async function postJson<T = any>(url: string, body?: Json): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body || {}),
  });
  return parseJson<T>(response);
}

/**
 * Execute DELETE request and parse JSON response.
 */
async function deleteJson<T = any>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return parseJson<T>(response);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dataset Operations
// ─────────────────────────────────────────────────────────────────────────────

const _refCache = new Map<string, DatasetRef>();

/**
 * Resolve dataset reference from name, with caching.
 */
export async function resolveDatasetRef(datasetName: string): Promise<DatasetRef> {
  const cached = _refCache.get(datasetName);
  if (cached) return cached;

  const result = await postJson<{
    success: boolean;
    dataset_id: string;
    dataset_name?: string;
  }>(`${API_BASE}/datasets/resolve`, { dataset_name: datasetName });

  if (!result.success || !result.dataset_id) {
    throw new Error(`Failed to resolve dataset "${datasetName}": ${JSON.stringify(result)}`);
  }

  const ref: DatasetRef = {
    appKey: datasetName,
    ragflowId: result.dataset_id,
    ragflowName: result.dataset_name ?? datasetName,
  };

  _refCache.set(datasetName, ref);
  return ref;
}

/**
 * Check RAGFlow health.
 */
export async function checkRAGFlowHealth(): Promise<{ status: string }> {
  return getJson<{ status: string }>(`${API_BASE}/health`);
}

/**
 * List datasets.
 */
export async function listDatasets(name?: string): Promise<RAGDataset[]> {
  const params = new URLSearchParams();
  if (name) params.set('name', name);
  const result = await getJson<{ datasets?: RAGDataset[] }>(
    `${API_BASE}/datasets?${params}`
  );
  return result.datasets ?? [];
}

/**
 * Create a new dataset.
 */
export async function createDataset(payload: {
  name: string;
  description?: string;
  chunk_method?: string;
}): Promise<RAGDataset> {
  return postJson<RAGDataset>(`${API_BASE}/datasets`, payload);
}

/**
 * Delete a dataset.
 */
export async function deleteDataset(datasetId: string): Promise<{ success: boolean }> {
  return deleteJson<{ success: boolean }>(`${API_BASE}/datasets/${datasetId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Document Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List documents in a dataset with pagination.
 */
export async function listDocuments(
  datasetRef: DatasetRef,
  page = 1,
  pageSize = 30
): Promise<RAGDocument[]> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('page_size', String(pageSize));

  const result = await getJson<{ documents?: RAGDocument[] }>(
    `${API_BASE}/datasets/${datasetRef.ragflowId}/documents?${params}`
  );
  return result.documents ?? [];
}

/**
 * Upload a file to a dataset.
 */
export async function uploadDocument(
  datasetId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string },
  token: string // We need the JWT to get past Flask's @require_jwt
): Promise<any> {
  const form = new FormData();
  form.append('file', file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });

  const url = `${AI_SERVICE_URL}/api/ragflow/datasets/${datasetId}/documents`;
  console.log(`[Node -> Flask] Uploading document to: ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...form.getHeaders(),
      'Authorization': `Bearer ${token}` // Forward the frontend's token to Flask
    },
    body: form,
  });

  return parseJson(response);
}

/**
 * Delete documents from a dataset.
 */
export async function deleteDocuments(
  datasetRef: DatasetRef,
  documentIds: string[],
  token: string
): Promise<{ success: boolean }> {
  
  // Hardcoding the full path structure to guarantee it hits Flask's blueprint perfectly
  const FLASK_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
  const url = `${FLASK_URL}/api/ragflow/datasets/${datasetRef.ragflowId}/documents`;
  
  const response = await fetch(url, {
    method: 'DELETE', // Force explicit DELETE
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ document_ids: documentIds })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Delete request failed with status ${response.status}: ${text}`);
  }

  return JSON.parse(text);
}

/**
 * Trigger chunking/parsing of documents.
 */
export async function parseDocuments(
  datasetId: string,
  documentIds: string[],
  token: string
): Promise<any> {
  const url = `${AI_SERVICE_URL}/api/ragflow/datasets/${datasetId}/chunks`;
  console.log(`[Node -> Flask] Triggering parse at: ${url} for docs:`, documentIds);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ document_ids: documentIds }),
  });

  return parseJson(response);
}
/**
 * Extract document IDs from upload response in various formats.
 */
export function extractDocumentIds(uploadResponse: any): string[] {
  if (Array.isArray(uploadResponse?.document_ids)) {
    const ids = uploadResponse.document_ids.filter(Boolean);
    if (ids.length) return ids;
  }

  if (Array.isArray(uploadResponse?.data)) {
    const ids = uploadResponse.data
      .map((d: any) => d?.id ?? d?.document_id)
      .filter(Boolean);
    if (ids.length) return ids;
  }

  const single = uploadResponse?.document_id ?? uploadResponse?.id;
  if (single) return [single];

  if (Array.isArray(uploadResponse?.documents)) {
    const ids = uploadResponse.documents
      .map((d: any) => d?.id ?? d?.document_id)
      .filter(Boolean);
    if (ids.length) return ids;
  }

  throw new Error('No document IDs found in upload response');
}
// ─────────────────────────────────────────────────────────────────────────────
// Query & Retrieval
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a module/lesson plan.
 */
export async function generateModule(payload: {
  class_name: string;
  subject: string;
  topic: string;
  teacher_id?: string;
  dataset_name?: string;
}): Promise<any> {
  return postJson(`${API_BASE}/module/generate`, payload);
}

/**
 * Ask a question (non-streaming).
 */
export async function askQuestion(payload: {
  question: string;
  teacher_id?: string;
  session_id?: string;
  chat_id?: string;
}): Promise<any> {
  return postJson(`${API_BASE}/query/ask`, { ...payload, stream: false });
}

/**
 * Retrieve chunks for a question (RAG retrieval).
 */
export async function retrieveQuestion(payload: {
  question: string;
  dataset_ids?: string[];
  dataset_name?: string;
  top_k?: number;
  similarity_threshold?: number;
}): Promise<{
  success: boolean;
  dataset_ids: string[];
  chunks: RAGChunk[];
  count: number;
}> {
  return postJson(`${API_BASE}/query/retrieve`, payload);
}

/**
 * Ask a question from a specific dataset.
 */
export async function askFromDataset(payload: {
  question: string;
  teacher_id?: string;
  session_id?: string;
  chat_id?: string;
  dataset_ids?: string[];
  dataset_name?: string;
  top_k?: number;
  similarity_threshold?: number;
}): Promise<any> {
  return postJson(`${API_BASE}/query/ask-from-dataset`, payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// Streaming Query (SSE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stream question response using Server-Sent Events (SSE).
 * Returns a Node.js Readable stream.
 */
export async function streamQuestion(payload: {
  question: string;
  teacher_id?: string;
  session_id?: string;
  chat_id?: string;
}): Promise<Readable> {
  const response = await fetch(`${API_BASE}/query/ask`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...payload, stream: true }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Streaming request failed');
  }

  if (!response.body) {
    throw new Error('No response body for streaming');
  }

  return Readable.fromWeb(response.body as any);
}

// ─────────────────────────────────────────────────────────────────────────────
// Resources
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get resources.
 */
export async function getResources(
  teacherId?: string,
  competencyArea?: string
): Promise<RAGResource[]> {
  const params = new URLSearchParams();
  if (teacherId) params.set('teacher_id', teacherId);
  if (competencyArea) params.set('competency_area', competencyArea);

  const result = await getJson<{ resources?: RAGResource[] }>(
    `${API_BASE}/resources?${params}`
  );
  return result.resources ?? [];
}

/**
 * Get exemplary resources.
 */
export async function getExemplaryResources(): Promise<RAGResource[]> {
  const result = await getJson<{ resources?: RAGResource[] }>(
    `${API_BASE}/resources/exemplary`
  );
  return result.resources ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a chat session.
 */
export async function createSession(
  name?: string,
  chatId?: string
): Promise<any> {
  return postJson(`${API_BASE}/sessions`, {
    name: name ?? 'New Chat',
    chat_id: chatId,
  });
}

/**
 * List sessions.
 */
export async function listSessions(chatId?: string): Promise<any> {
  const params = new URLSearchParams();
  if (chatId) params.set('chat_id', chatId);
  return getJson(`${API_BASE}/sessions?${params}`);
}

/**
 * Delete a session.
 */
export async function deleteSession(
  sessionId: string,
  chatId?: string
): Promise<{ success: boolean }> {
  const params = new URLSearchParams();
  if (chatId) params.set('chat_id', chatId);
  const qs = params.toString();
  return deleteJson(`${API_BASE}/sessions/${sessionId}${qs ? `?${qs}` : ''}`);
}