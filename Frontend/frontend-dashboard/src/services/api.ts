/**
 * api.ts — Backend API Client
 *
 * Provides type-safe functions for interacting with backend API endpoints.
 * Handles:
 * - All CRUD operations (teachers, issues, modules, feedback, admins)
 * - Dashboard statistics
 * - RAG upload/processing (via backend, not direct RAGFlow)
 * - AI/FLASK operations (via backend, not direct Flask)
 *
 * Security:
 * - All calls require JWT authentication
 * - NO direct Supabase access
 * - NO direct Flask AI access
 * - All writes go through backend for auth/middleware
 */

import { getRequestHeaders } from '@/utils/auth';


const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';


// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions (kept for frontend use)
// ─────────────────────────────────────────────────────────────────────────────


export interface Teacher {
  id: string;
  name: string;
  email: string;
  cluster: string;
  employeeId: string;
  createdAt: string;
  phone?: string;
  school?: string;
  subject?: string;
  status?: 'active' | 'inactive';
  modulesCompleted?: number;
}


export interface Admin {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'viewer';
  permissions: {
    view_feedback: boolean;
    manage_modules: boolean;
    assign_training: boolean;
    manage_teachers: boolean;
  };
  createdAt?: string;
  lastLogin?: string;
  isActive?: boolean;
}


export type IssueStatus = 'pending' | 'reviewed' | 'resolved' | 'training_assigned';
export type IssueCategory = 'academic' | 'infrastructure' | 'administrative' | 'safety' | 'technology' | 'other';


export interface Issue {
  id: string;
  teacherId: string;
  teacherName?: string;
  teacherEmail?: string;
  teacherEmployeeId?: string;
  cluster: string;
  category: IssueCategory;
  description: string;
  status: IssueStatus;
  adminRemarks?: string;
  createdAt: string;
  updatedAt: string;
  trainingRating?: number;
  trainingComment?: string;
}


export interface TrainingModuleContextualMetadata {
  ragflow?: {
    datasetId?: string;
    datasetName?: string;
    documentIds?: string[];
  };
  [key: string]: any;
}


export type ModuleType =
  | 'student_textbook'
  | 'teacher_training'
  | 'teacher_resource'
  | 'assessment_resource'
  | 'policy_document'
  | 'remedial_resource'
  | 'other';


export type ModuleAudience = 'student' | 'teacher' | 'teacher_educator' | 'admin' | 'mixed';
export type ResourceFormat = 'pdf' | 'epub' | 'video' | 'audio' | 'html' | 'mixed' | 'link';
export type ModuleStatus = 'draft' | 'published' | 'archived';


export interface TrainingModule {
  id: string;
  title: string;
  description?: string | null;
  competencyArea?: string | null;
  moduleType: ModuleType;
  moduleSubtype?: string | null;
  teacherMaterialType?: string | null;
  textbookType?: string | null;
  intendedUse?: string | null;
  audience: ModuleAudience;
  audienceTags: string[];
  resourceFormat: ResourceFormat;
  sourceOrg?: string | null;
  sourcePlatform?: string | null;
  sourceUrl?: string | null;
  educationLevel?: string | null;
  classGrades: string[];
  subjectAreas: string[];
  stateCodes: string[];
  board?: string | null;
  programTags: string[];
  mediumTags: string[];
  language: string;
  tags: string[];
  fullContent?: string | null;
  moduleSource?: string | null;
  targetClusters: string[];
  contextualMetadata?: TrainingModuleContextualMetadata;
  pdfStoragePath?: string | null;
  isNcert: boolean;
  isStateSpecific: boolean;
  ragDatasetId?: string | null;
  ragDocumentIds: string[];
  editionLabel?: string | null;
  publicationYear?: number | null;
  versionLabel?: string | null;
  status: ModuleStatus;
  uploaderAdminId?: string | null;
  createdAt: string;
  updatedAt: string;
}


export interface TrainingFeedback {
  id: string;
  teacherId: string;
  teacherName: string;
  assignmentId: string;
  moduleId: string;
  rating: number;
  wasHelpful: boolean;
  comment: string | null;
  strengths: string[];
  improvements: string[];
  stillHasIssue: boolean;
  needsAdditionalSupport: boolean;
  createdAt: string;
  module?: { id: string; title: string; competencyArea: string };
}


export interface TeacherTrainingAssignment {
  id: string;
  teacherId: string;
  moduleId: string;
  assignedBy: string;
  assignedReason?: string;
  sourceIssueId?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  progressPercentage: number;
  assignedDate: string;
  startedAt?: string;
  completedAt?: string;
  dueDate: string;
  videoWatchTimeSeconds: number;
  videoCompleted: boolean;
  module?: TrainingModule;
  personalizedContent?: string;
}


export interface DashboardStats {
  total: number;
  byStatus: {
    pending: number;
    inReview: number;
    resolved: number;
    rejected: number;
  };
  byCategory: {
    academic: number;
    infrastructure: number;
    administrative: number;
    safety: number;
    technology: number;
    other: number;
  };
  byClusters: Record<string, number>;
}


export interface AIResponse {
  suggestion: string;
  inferredGaps?: string[];
  priority?: string;
}


export interface FeedbackIssue extends Issue {
  teacherName: string;
  moduleId?: string;
  moduleName?: string;
  issueType?: string;
  priority?: 'low' | 'medium' | 'high';
}


export interface ModuleUpsertInput {
  title: string;
  description?: string;
  competencyArea?: string;
  moduleType: ModuleType;
  moduleSubtype?: string;
  teacherMaterialType?: string;
  textbookType?: string;
  intendedUse?: string;
  audience: ModuleAudience;
  audienceTags: string[];
  resourceFormat: ResourceFormat;
  sourceOrg?: string;
  sourcePlatform?: string;
  sourceUrl?: string;
  educationLevel?: string;
  classGrades: string[];
  subjectAreas: string[];
  stateCodes: string[];
  board?: string;
  programTags: string[];
  mediumTags: string[];
  language: string;
  tags: string[];
  fullContent?: string;
  targetClusters: string[];
  contextualMetadata?: TrainingModuleContextualMetadata;
  isNcert?: boolean;
  isStateSpecific?: boolean;
  editionLabel?: string;
  publicationYear?: number;
  versionLabel?: string;
  status?: ModuleStatus;
  uploaderAdminId?: string;
}


// ─────────────────────────────────────────────────────────────────────────────
// Row Mapper Functions (utilities - kept for consistency)
// ─────────────────────────────────────────────────────────────────────────────


/**
 * These mappers are kept for potential frontend data transformation,
 * but Supabase rows should no longer reach frontend (backend returns clean objects).
 */

function rowToTeacher(r: any): Teacher {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    cluster: r.cluster,
    employeeId: r.employee_id,
    createdAt: r.created_at,
    status: r.is_active === false ? 'inactive' : 'active',
  };
}

function rowToIssue(r: any): Issue {
  return {
    id: r.id,
    teacherId: r.teacher_id ?? '',
    teacherName: r.teachers?.name ?? r.teacher_name ?? 'Unknown',
    teacherEmail: r.teachers?.email ?? undefined,
    teacherEmployeeId: r.teachers?.employee_id ?? undefined,
    cluster: r.cluster,
    category: r.category,
    description: r.description,
    status: r.status,
    adminRemarks: r.admin_remarks ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    trainingRating: r.training_rating ?? undefined,
    trainingComment: r.training_comment ?? undefined,
  };
}

export function rowToModule(r: any): TrainingModule {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    competencyArea: r.competency_area ?? null,
    moduleType: r.module_type ?? 'student_textbook',
    moduleSubtype: r.module_subtype ?? null,
    teacherMaterialType: r.teacher_material_type ?? null,
    textbookType: r.textbook_type ?? null,
    intendedUse: r.intended_use ?? null,
    audience: r.audience ?? 'student',
    audienceTags: r.audience_tags ?? [],
    resourceFormat: r.resource_format ?? 'pdf',
    sourceOrg: r.source_org ?? r.module_source ?? null,
    sourcePlatform: r.source_platform ?? null,
    sourceUrl: r.source_url ?? null,
    educationLevel: r.education_level ?? null,
    classGrades: r.class_grades ?? [],
    subjectAreas: r.subject_areas ?? [],
    stateCodes: r.state_codes ?? [],
    board: r.board ?? null,
    programTags: r.program_tags ?? [],
    mediumTags: r.medium_tags ?? [],
    language: r.language ?? 'English',
    tags: r.tags ?? [],
    fullContent: r.full_content ?? '',
    moduleSource: r.module_source ?? null,
    targetClusters: r.target_clusters ?? [],
    contextualMetadata: r.contextual_metadata ?? {},
    pdfStoragePath: r.pdf_storage_path ?? null,
    isNcert: r.is_ncert ?? false,
    isStateSpecific: r.is_state_specific ?? false,
    ragDatasetId: r.rag_dataset_id ?? null,
    ragDocumentIds: r.rag_document_ids ?? r.contextual_metadata?.ragflow?.documentIds ?? [],
    editionLabel: r.edition_label ?? null,
    publicationYear: r.publication_year ?? null,
    versionLabel: r.version_label ?? null,
    status: r.status ?? 'draft',
    uploaderAdminId: r.uploader_admin_id ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToFeedback(r: any): TrainingFeedback {
  return {
    id: r.id,
    teacherId: r.teacher_id,
    teacherName: r.teacher_name,
    assignmentId: r.assignment_id,
    moduleId: r.module_id,
    rating: r.rating,
    wasHelpful: r.was_helpful,
    comment: r.comment ?? null,
    strengths: r.strengths ?? [],
    improvements: r.improvements ?? [],
    stillHasIssue: r.still_has_issue,
    needsAdditionalSupport: r.needs_additional_support,
    createdAt: r.created_at,
    module: r.training_modules
      ? {
          id: r.training_modules.id,
          title: r.training_modules.title,
          competencyArea: r.training_modules.competency_area,
        }
      : undefined,
  };
}

function rowToAdmin(r: any): Admin {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    permissions:
      r.permissions ?? {
        view_feedback: true,
        manage_modules: true,
        assign_training: true,
        manage_teachers: true,
      },
    createdAt: r.created_at,
    lastLogin: r.last_login ?? undefined,
    isActive: r.is_active ?? true,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// API Object (all calls now go through backend)
// ─────────────────────────────────────────────────────────────────────────────


export const api = {
  // ─── RAG Stats & Processing (via backend) ─────────────────────────────────
  
  async getRagStats(): Promise<{ total_modules: number; total_chunks: number; vectorized: boolean }> {
    const res = await fetch(`${API_BASE_URL}/api/admin/rag/stats`, { 
      headers: getRequestHeaders() 
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to fetch RAG stats');
    }
    return res.json();
  },


  async uploadPdfForModule(
    file: File,
    moduleId: string,
    moduleName: string,
    competencyArea: string,
  ): Promise<{ success: boolean; message: string; chunks: number }> {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('module_id', moduleId);
    formData.append('module_name', moduleName);
    formData.append('competency_area', competencyArea);

    const headers = getRequestHeaders();
    delete headers['Content-Type']; // <-- Fix here too

    const res = await fetch(`${API_BASE_URL}/api/admin/rag/upload-pdf`, {
      method: 'POST',
      headers: headers,
      body: formData,
    });

    if (!res.ok) {
      const errorJson = await res.json();
      throw new Error(errorJson.error || 'Failed to upload PDF');
    }

    return res.json();
  },


  async processAllPdfs(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/admin/rag/process-all-pdfs`, {
      method: 'POST',
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to process PDFs');
    }
    return res.json();
  },


  async getModulesRagStatus(): Promise<{
    success: boolean;
    modules: Array<{
      id: string;
      title: string;
      competency: string;
      chunkCount: number;
      hasRAG: boolean;
      lastUpload: string | null;
      pdfPath: string | null;
    }>;
  }> {
    const res = await fetch(`${API_BASE_URL}/api/admin/modules/rag-status`, {
      method: 'GET',
      headers: getRequestHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Failed to fetch RAG status: ${res.status}`);
    }
    return res.json();
  },


  // ─── Dashboard Stats (via backend) ────────────────────────────────────────
  
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/stats`, {
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to fetch dashboard stats');
    }
    const json = await res.json();
    return json.data?.stats;
  },


  // ─── Teachers (via backend) ───────────────────────────────────────────────
  
  async getTeachers(): Promise<Teacher[]> {
    const res = await fetch(`${API_BASE_URL}/api/admin/teachers`, {
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to fetch teachers');
    }
    const json = await res.json();
    return json.data?.teachers || [];
  },


  async getTeacher(id: string): Promise<Teacher | null> {
    const res = await fetch(`${API_BASE_URL}/api/admin/teachers/${id}`, {
      headers: getRequestHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.teacher || null;
  },


  async getClusters(): Promise<string[]> {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/clusters`, {
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to fetch clusters');
    }
    const json = await res.json();
    return json.data?.clusters || [];
  },


  async createTeacher(teacher: { name: string; email: string; cluster: string; employeeId: string; password: string }): Promise<Teacher> {
    const res = await fetch(`${API_BASE_URL}/api/admin/teachers`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(teacher),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || 'Failed to create teacher');
    }
    const json = await res.json();
    return json.data?.teacher;
  },


  async updateTeacher(
    id: string,
    updates: { name?: string; email?: string; cluster?: string; employeeId?: string; password?: string },
  ): Promise<Teacher> {
    const res = await fetch(`${API_BASE_URL}/api/admin/teachers/${id}`, {
      method: 'PUT',
      headers: getRequestHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || 'Failed to update teacher');
    }
    const json = await res.json();
    return json.data?.teacher;
  },


  async deleteTeacher(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/admin/teachers/${id}`, {
      method: 'DELETE',
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to delete teacher');
    }
  },


  // ─── Issues (via backend) ─────────────────────────────────────────────────
  
  async getIssues(
    status?: string,
    cluster?: string,
    limit = 50,
    offset = 0,
  ): Promise<{ issues: Issue[]; total: number }> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (cluster) params.set('cluster', cluster);
    params.set('limit', String(limit));
    params.set('offset', String(offset));

    const res = await fetch(`${API_BASE_URL}/api/dashboard/issues/all?${params}`, {
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to fetch issues');
    }
    const json = await res.json();
    return { issues: json.data?.issues || [], total: json.data?.total || 0 };
  },


  async getAllIssues(): Promise<Issue[]> {
    const { issues } = await api.getIssues();
    return issues;
  },


  async getIssuesByTeacher(teacherId: string): Promise<Issue[]> {
    const res = await fetch(`${API_BASE_URL}/api/admin/teachers/${teacherId}/issues`, {
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to fetch teacher issues');
    }
    const json = await res.json();
    return json.data?.issues || [];
  },


  async getIssueById(id: string): Promise<Issue | null> {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/issues/${id}`, {
      headers: getRequestHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.issue || null;
  },


  async updateIssueStatus(id: string, status: IssueStatus, adminRemarks?: string): Promise<Issue> {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/issues/${id}/status`, {
      method: 'PATCH',
      headers: getRequestHeaders(),
      body: JSON.stringify({ status, admin_remarks: adminRemarks }),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.data?.error || 'Failed to update issue status');
    }
    const json = await res.json();
    return json.data?.issue;
  },


  async submitIssue(
    teacherId: string,
    cluster: string,
    category: IssueCategory,
    description: string,
  ): Promise<{ issue: Issue; aiResponse?: AIResponse }> {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/issues`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({ teacher_id: teacherId, cluster, category, description }),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.data?.error || 'Failed to submit issue');
    }
    const json = await res.json();
    return json.data?.issue ? { issue: json.data?.issue } : { issue: json.data };
  },


  async deleteIssue(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/issues/${id}`, {
      method: 'DELETE',
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to delete issue');
    }
  },


  // ─── Training Modules (via backend) ───────────────────────────────────────
  
  async getTrainingModules(): Promise<TrainingModule[]> {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/modules`, {
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to fetch modules');
    }
    const json = await res.json();
    return json.data?.modules || [];
  },


  async createModule(moduleData: ModuleUpsertInput): Promise<TrainingModule> {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/modules`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(moduleData),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.data?.error || 'Failed to create module');
    }
    const json = await res.json();
    return json.data?.module;
  },


  async updateModule(id: string, moduleData: ModuleUpsertInput): Promise<TrainingModule> {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/modules/${id}`, {
      method: 'PUT',
      headers: getRequestHeaders(),
      body: JSON.stringify(moduleData),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.data?.error || 'Failed to update module');
    }
    const json = await res.json();
    return json.data?.module;
  },


  async deleteModule(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/modules/${id}`, {
      method: 'DELETE',
      headers: getRequestHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Failed to delete module: ${res.status}`);
    }
  },


  async uploadModuleWithFile(moduleData: ModuleUpsertInput, file: File): Promise<TrainingModule> {
    const formData = new FormData();
    formData.append('metadata', JSON.stringify(moduleData));
    formData.append('file', file);

    const headers = getRequestHeaders();
    delete headers['Content-Type']; // <-- Let the browser set the multipart boundary!

    const res = await fetch(`${API_BASE_URL}/api/dashboard/modules/upload`, {
      method: 'POST',
      headers: headers,
      body: formData,
    });

    if (!res.ok) {
      const errorJson = await res.json();
      throw new Error(errorJson.error || 'Upload failed');
    }
    
    const json = await res.json();
    return json.data?.module || json.module; // Unwrap safely
  },


  // ─── Training Feedback (via backend) ──────────────────────────────────────
  
  async getAllTrainingFeedback(): Promise<TrainingFeedback[]> {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/training-feedback`, {
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to fetch feedback');
    }
    const json = await res.json();
    return json.data?.feedbacks || [];
  },


  async getTrainingFeedbackByModule(moduleId: string): Promise<TrainingFeedback[]> {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/training-feedback/module/${moduleId}`, {
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to fetch module feedback');
    }
    const json = await res.json();
    return json.data?.feedbacks || [];
  },


  async getTrainingFeedbackByTeacher(teacherId: string): Promise<TrainingFeedback[]> {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/training-feedback/teacher/${teacherId}`, {
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to fetch teacher feedback');
    }
    const json = await res.json();
    return json.data?.feedbacks || [];
  },


  // ─── Admins (via backend) ─────────────────────────────────────────────────
  
  async getAdmins(): Promise<Admin[]> {
    const res = await fetch(`${API_BASE_URL}/api/admin`, {
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to fetch admins');
    }
    const json = await res.json();
    return json.data?.admins || [];
  },


  async createAdmin(admin: { name: string; email: string; password: string; role?: string }): Promise<Admin> {
    const res = await fetch(`${API_BASE_URL}/api/admin`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(admin),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.data?.error || 'Failed to create admin');
    }
    const json = await res.json();
    return json.data?.admin;
  },


  async updateAdmin(id: string, updates: Partial<Admin>): Promise<Admin> {
    const res = await fetch(`${API_BASE_URL}/api/admin/${id}`, {
      method: 'PUT',
      headers: getRequestHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.data?.error || 'Failed to update admin');
    }
    const json = await res.json();
    return json.data?.admin;
  },


  async deleteAdmin(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/admin/${id}`, {
      method: 'DELETE',
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to delete admin');
    }
  },


  async changeAdminPassword(id: string, _currentPassword: string, newPassword: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/admin/${id}/change-password`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({ currentPassword: _currentPassword, newPassword }),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.data?.error || 'Failed to change password');
    }
  },


  // ─── AI/Flask Operations (via backend, NOT direct) ────────────────────────
  
  async analyzeFeedback(teacherId: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/analyze-feedback/${teacherId}`, {
      method: 'POST',
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Analysis failed');
    }
    return res.json();
  },


  async assignTraining(teacherId: string, feedbackId: string, adminId = 'admin-001'): Promise<any> {
    // CHANGED: Now calls backend instead of direct Flask
    const res = await fetch(`${API_BASE_URL}/api/assign-training`, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({ teacher_id: teacherId, feedback_id: feedbackId, admin_id: adminId }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to assign training');
    }
    return res.json();
  },


  // ─── Health Check ─────────────────────────────────────────────────────────
  
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const res = await fetch(`${API_BASE_URL}/health`, { 
      headers: getRequestHeaders() 
    });
    if (!res.ok) {
      throw new Error('Backend unavailable');
    }
    return res.json();
  },
};


export default api;