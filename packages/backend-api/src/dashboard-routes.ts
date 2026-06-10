/**
 * Dashboard Management Routes 
 *
 * Handles:
 * - Issue management (list, update, delete)
 * - Dashboard statistics
 * - Teacher listings
 * - Training modules CRUD (with RAGFlow integration , calls Flask service)
 * - Training feedback endpoints
 *
 * Security:
 * - All routes require JWT authentication
 * - Module write operations require admin+ role
 * - RAGFlow calls go directly via ragflow_client 
 */

import { Router, Request, Response } from 'express';
import { supabase } from './supabaseClient.js';
import multer from 'multer';
import * as ragflow from './ragflow_client.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '../../..', '.env'),
});

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

/**
 * JWT Authentication Middleware
 */
function requireAuth() {
  return async (req: Request, res: Response, next: any) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization token'
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      (req as any).user = payload;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  };
}

/**
 * Admin or Higher Middleware
 */
function requireAdminOrHigher() {
  return (req: Request, res: Response, next: any) => {
    const user = (req as any).user;
    
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    next();
  };
}

// Helper: Convert Supabase row to module object
function rowToModule(m: any) {
  return {
    id: m.id,
    title: m.title,
    description: m.description || '',
    competencyArea: m.competency_area || null,
    moduleType: m.module_type || 'student_textbook',
    moduleSubtype: m.module_subtype || null,
    teacherMaterialType: m.teacher_material_type || null,
    textbookType: m.textbook_type || null,
    intendedUse: m.intended_use || null,
    audience: m.audience || 'student',
    audienceTags: m.audience_tags || [],
    resourceFormat: m.resource_format || 'pdf',
    sourceOrg: m.source_org || 'NCERT',
    sourcePlatform: m.source_platform || null,
    sourceUrl: m.source_url || null,
    educationLevel: m.education_level || null,
    classGrades: m.class_grades || [],
    subjectAreas: m.subject_areas || [],
    stateCodes: m.state_codes || [],
    board: m.board || null,
    programTags: m.program_tags || [],
    mediumTags: m.medium_tags || [],
    language: m.language || 'English',
    tags: m.tags || [],
    fullContent: m.full_content || '',
    moduleSource: m.module_source || m.source_org || 'ADMIN_DASHBOARD',
    targetClusters: m.target_clusters || [],
    contextualMetadata: m.contextual_metadata || {},
    pdfStoragePath: m.pdf_storage_path || null,
    isNcert: m.is_ncert ?? false,
    isStateSpecific: m.is_state_specific ?? false,
    ragDatasetId: m.rag_dataset_id || null,
    ragDocumentIds: m.rag_document_ids || [],
    fileName: m.file_name || null,
    fileSizeBytes: m.file_size_bytes || null,
    editionLabel: m.edition_label || null,
    publicationYear: m.publication_year || null,
    versionLabel: m.version_label || null,
    status: m.status || 'draft',
    uploaderAdminId: m.uploader_admin_id || null,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  };
}

// Helper: Resolve routing row for RAGFlow dataset
async function resolveRoutingRow({ sourceOrg, sourcePlatform, moduleType, moduleSubtype, audience, stateCode, board }: any) {
  const { data, error } = await supabase
    .from('resource_source_routing')
    .select('*')
    .eq('source_org', sourceOrg)
    .eq('is_active', true)
    .order('priority', { ascending: true });
  
  if (error) throw error;
  
  const rows = data || [];
  return rows.find((r: any) =>
    (r.source_platform == null || r.source_platform === sourcePlatform) &&
    (r.module_type == null || r.module_type === moduleType) &&
    (r.module_subtype == null || r.module_subtype === moduleSubtype) &&
    (r.audience == null || r.audience === audience) &&
    (r.state_code == null || r.state_code === stateCode) &&
    (r.board == null || r.board === board)
  ) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Issues Endpoints (AUTHENTICATED)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/issues/all', requireAuth(), async (req: Request, res: Response) => {
  const { status, cluster, limit = '50', offset = '0' } = req.query;

  try {
    let query = supabase
      .from('issues')
      .select('*, teachers!inner(name, email, employee_id)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const normalizedStatus = status === 'in_review' ? 'reviewed' : (status as string | undefined);

    if (normalizedStatus) {
      query = query.eq('status', normalizedStatus);
    }

    if (cluster) {
      query = query.eq('cluster', cluster);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const issues = (data || []).map((item: any) => ({
      id: item.id,
      teacherId: item.teacher_id,
      teacherName: item.teachers.name,
      teacherEmail: item.teachers.email,
      teacherEmployeeId: item.teachers.employee_id,
      cluster: item.cluster,
      category: item.category,
      description: item.description,
      status: item.status,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      adminRemarks: item.admin_remarks,
    }));

    res.json({
      success: true,
      data: { issues, total: count, limit: Number(limit), offset: Number(offset) }
    });
  } catch (error) {
    console.error('Get all issues error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.patch('/issues/:id/status', requireAuth(), requireAdminOrHigher(), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, adminRemarks } = req.body as { status?: string; adminRemarks?: string };

  const normalizedStatus = status === 'in_review' ? 'reviewed' : status;
  const allowed = ['pending', 'reviewed', 'resolved', 'training_assigned'] as const;

  if (!normalizedStatus || !allowed.includes(normalizedStatus as any)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }

  try {
    const updateData: any = {
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    };

    if (adminRemarks !== undefined) {
      updateData.admin_remarks = adminRemarks;
    }

    const { data, error } = await supabase
      .from('issues')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Issue status updated',
      data: {
        issue: {
          id: data.id,
          teacherId: data.teacher_id,
          cluster: data.cluster,
          category: data.category,
          description: data.description,
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          adminRemarks: data.admin_remarks,
        }
      }
    });
  } catch (error) {
    console.error('Update issue status error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/issues/:id', requireAuth(), requireAdminOrHigher(), async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { data: issue, error: fetchError } = await supabase
      .from('issues')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError || !issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }

    if (issue.status !== 'resolved') {
      return res.status(400).json({ success: false, error: 'Only resolved issues can be deleted' });
    }

    console.log(`[Backend] Deleting issue ${id} and related records...`);

    const { error: aiError } = await supabase
      .from('ai_responses')
      .delete()
      .eq('issue_id', id);

    if (!aiError) console.log('  [Backend] Deleted related ai_responses');

    const { error: trainingUpdateError } = await supabase
      .from('personalized_training')
      .update({ issue_id: null })
      .eq('issue_id', id);

    if (!trainingUpdateError) console.log('  [Backend] Unlinked personalized_training from issue');

    const { error: issueError } = await supabase
      .from('issues')
      .delete()
      .eq('id', id);

    if (issueError) throw issueError;

    console.log('[Backend] Issue deleted successfully (training preserved)');
    res.json({ success: true, message: 'Issue deleted successfully. Related training records have been preserved.', data: null });
  } catch (error) {
    console.error('[Backend] Delete issue error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Statistics (AUTHENTICATED)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/stats', requireAuth(), async (req: Request, res: Response) => {
  try {
    const { data: allIssues, error } = await supabase
      .from('issues')
      .select('status, category, cluster');

    if (error) throw error;

    const stats = {
      total: allIssues.length,
      byStatus: {
        pending: allIssues.filter(i => i.status === 'pending').length,
        inReview: allIssues.filter(i => i.status === 'reviewed').length,
        resolved: allIssues.filter(i => i.status === 'resolved').length,
        rejected: 0,
      },
      byCategory: {
        academic: allIssues.filter(i => i.category === 'academic').length,
        infrastructure: allIssues.filter(i => i.category === 'infrastructure').length,
        administrative: allIssues.filter(i => i.category === 'administrative').length,
        safety: allIssues.filter(i => i.category === 'safety').length,
        technology: allIssues.filter(i => i.category === 'technology').length,
        other: allIssues.filter(i => i.category === 'other').length,
      },
      byClusters: allIssues.reduce((acc, i) => {
        acc[i.cluster] = (acc[i.cluster] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    res.json({ success: true, data: { stats } });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Teachers Endpoints (AUTHENTICATED)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/teachers', requireAuth(), async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('teachers')
      .select('id, name, email, cluster, employee_id, created_at')
      .order('name');

    if (error) throw error;

    const teachers = data.map(t => ({
      id: t.id,
      name: t.name,
      email: t.email,
      cluster: t.cluster,
      employeeId: t.employee_id,
      createdAt: t.created_at,
    }));

    res.json({ success: true, data: { teachers } });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/clusters', requireAuth(), async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('teachers')
      .select('cluster')
      .order('cluster');

    if (error) throw error;

    const uniqueClusters = [...new Set(data.map(t => t.cluster))];

    res.json({ success: true, data: { clusters: uniqueClusters, count: uniqueClusters.length } });
  } catch (error) {
    console.error('Get clusters error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Training Modules Endpoints (AUTHENTICATED, ADMIN+ FOR WRITES)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/modules', requireAuth(), async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('training_modules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const modules = (data || []).map(rowToModule);

    res.json({ success: true, data: { modules } });
  } catch (error) {
    console.error('Get modules error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/modules', requireAuth(), requireAdminOrHigher(), async (req: Request, res: Response) => {
  const {
    title, description, competencyArea, moduleType, audience, resourceFormat,
    sourceOrg, sourcePlatform, educationLevel, classGrades, subjectAreas,
    stateCodes, board, programTags, language, tags, fullContent, targetClusters,
    contextualMetadata, isNcert, isStateSpecific, ragDatasetKey, ragDatasetId,
    ragDocumentIds, fileName, fileSizeBytes, status
  } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, error: 'Title is required' });
  }

  try {
    const { data, error } = await supabase
      .from('training_modules')
      .insert({
        title,
        description,
        competency_area: competencyArea || null,
        module_type: moduleType || 'student_textbook',
        audience: audience || 'student',
        resource_format: resourceFormat || 'pdf',
        source_org: sourceOrg || 'NCERT',
        source_platform: sourcePlatform || 'ePathshala',
        education_level: educationLevel || null,
        class_grades: classGrades || [],
        subject_areas: subjectAreas || [],
        state_codes: stateCodes || [],
        board: board || null,
        program_tags: programTags || [],
        language: language || 'English',
        tags: tags || [],
        full_content: fullContent || '',
        target_clusters: targetClusters || [],
        contextual_metadata: contextualMetadata || {},
        is_ncert: isNcert ?? false,
        is_state_specific: isStateSpecific ?? false,
        rag_dataset_key: ragDatasetKey || 'student_textbooks',
        rag_dataset_id: ragDatasetId || null,
        rag_document_ids: ragDocumentIds || [],
        file_name: fileName || null,
        file_size_bytes: fileSizeBytes || null,
        status: status || 'draft',
        module_source: sourceOrg || 'ADMIN_DASHBOARD',
      })
      .select('*')
      .single();

    if (error) throw error;

    const module = rowToModule(data);
    console.log('Module created:', module.title);
    res.status(201).json({ success: true, message: 'Module created', data: { module } });
  } catch (error) {
    console.error('Create module error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.put('/modules/:id', requireAuth(), requireAdminOrHigher(), async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    title, description, competencyArea, moduleType, audience, resourceFormat,
    sourceOrg, sourcePlatform, educationLevel, classGrades, subjectAreas,
    stateCodes, board, programTags, language, tags, fullContent, targetClusters,
    contextualMetadata, isNcert, isStateSpecific, ragDatasetKey, ragDatasetId,
    ragDocumentIds, fileName, fileSizeBytes, status
  } = req.body;

  try {
    const updateData: any = {
      title,
      description,
      competency_area: competencyArea || null,
      module_type: moduleType || 'student_textbook',
      audience: audience || 'student',
      resource_format: resourceFormat || 'pdf',
      source_org: sourceOrg || 'NCERT',
      source_platform: sourcePlatform || 'ePathshala',
      education_level: educationLevel || null,
      class_grades: classGrades || [],
      subject_areas: subjectAreas || [],
      state_codes: stateCodes || [],
      board: board || null,
      program_tags: programTags || [],
      language: language || 'English',
      tags: tags || [],
      full_content: fullContent || '',
      target_clusters: targetClusters || [],
      contextual_metadata: contextualMetadata || {},
      is_ncert: isNcert ?? false,
      is_state_specific: isStateSpecific ?? false,
      rag_dataset_key: ragDatasetKey || 'student_textbooks',
      rag_dataset_id: ragDatasetId || null,
      rag_document_ids: ragDocumentIds || [],
      file_name: fileName || null,
      file_size_bytes: fileSizeBytes || null,
      status: status || 'draft',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('training_modules')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    const module = rowToModule(data);
    console.log('[Backend] Module updated:', module.title);
    res.json({ success: true, message: 'Module updated', data: { module } });
  } catch (error) {
    console.error('Update module error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/modules/:id', requireAuth(), requireAdminOrHigher(), async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Extract the Bearer token to forward to Flask
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(' ')[1] : ''; 

    const { data: module, error: fetchError } = await supabase
      .from('training_modules')
      .select('rag_dataset_id, rag_document_ids')
      .eq('id', id)
      .single();

    if (fetchError || !module) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    // Delete from RAGFlow
    if (module.rag_dataset_id && module.rag_document_ids?.length > 0) {
      try {
        const datasetRef: ragflow.DatasetRef = {
          appKey: 'deleted',
          ragflowId: module.rag_dataset_id,
          ragflowName: 'deleted'
        };
        
        await ragflow.deleteDocuments(datasetRef, module.rag_document_ids, token);
        console.log('[Backend] Successfully cleared out documents from RAGFlow via Flask');
      } catch (ragError) {
        console.warn('[Backend] Warning: Failed to clear tracking inside RAGFlow:', ragError);
      }
    }

    const { error } = await supabase
      .from('training_modules')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log('[Backend] Module deleted safely from DB:', id);
    res.json({ success: true, message: 'Module deleted successfully', data: null });
  } catch (error) {
    console.error('Delete module operation breakdown:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Upload module with file (create + upload + parse)
router.post('/modules/upload', requireAuth(), requireAdminOrHigher(), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const payload = JSON.parse(req.body.metadata || '{}');
    const file = req.file;
    
    // Extract the Bearer token to forward to Flask so it passes the @require_jwt check
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(' ')[1] : ''; 

    if (!payload.title) return res.status(400).json({ success: false, error: 'title is required' });
    if (!file) return res.status(400).json({ success: false, error: 'file is required' });

    // Resolve routing to get RAGFlow dataset ID
    const primaryStateCode = Array.isArray(payload.stateCodes) && payload.stateCodes.length ? payload.stateCodes[0] : null;
    const routing = await resolveRoutingRow({
      sourceOrg: payload.sourceOrg || 'NCERT',
      sourcePlatform: payload.sourcePlatform || null,
      moduleType: payload.moduleType || 'student_textbook',
      moduleSubtype: payload.moduleSubtype || null,
      audience: payload.audience || 'student',
      stateCode: primaryStateCode,
      board: payload.board || null,
    });

    if (!routing?.ragflow_dataset_id) {
      return res.status(400).json({ success: false, error: 'No dataset routing configured for this resource source. Only for CBSE Board its configuered. (Will only work if the dataset id is set in supabase , which is currently set to my own local dataset)' });
    }

    const datasetId = routing.ragflow_dataset_id;

    // Create module in Supabase first (with empty rag_document_ids)
    const { data: moduleRow, error: createError } = await supabase.from('training_modules').insert({
      title: payload.title,
      description: payload.description || null,
      competency_area: payload.competencyArea || null,
      module_type: payload.moduleType || 'student_textbook',
      module_subtype: payload.moduleSubtype || null,
      teacher_material_type: payload.teacherMaterialType || null,
      textbook_type: payload.textbookType || null,
      intended_use: payload.intendedUse || null,
      audience: payload.audience || 'student',
      audience_tags: payload.audienceTags || [],
      resource_format: payload.resourceFormat || 'pdf',
      source_org: payload.sourceOrg || 'NCERT',
      source_platform: payload.sourcePlatform || null,
      source_url: payload.sourceUrl || null,
      education_level: payload.educationLevel || null,
      class_grades: payload.classGrades || [],
      subject_areas: payload.subjectAreas || [],
      state_codes: payload.stateCodes || [],
      board: payload.board || null,
      program_tags: payload.programTags || [],
      medium_tags: payload.mediumTags || [],
      language: payload.language || 'English',
      tags: payload.tags || [],
      full_content: payload.fullContent || '',
      target_clusters: payload.targetClusters || [],
      contextual_metadata: payload.contextualMetadata || {},
      is_ncert: payload.isNcert ?? false,
      is_state_specific: payload.isStateSpecific ?? false,
      rag_dataset_id: datasetId,
      rag_document_ids: [], // Start empty, filled after upload completes
      file_name: file.originalname,
      file_size_bytes: file.size,
      edition_label: payload.editionLabel || null,
      publication_year: payload.publicationYear || null,
      version_label: payload.versionLabel || null,
      status: payload.status || 'draft',
      uploader_admin_id: payload.uploaderAdminId || null,
      module_source: payload.sourceOrg || 'ADMIN_DASHBOARD',
    }).select('*').single();

    if (createError) throw createError;

    // Preparation for Flask communication
    const ragflowFile = {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype
    };

    let docIds: string[] = [];

    // Step One: Upload file to the Flask Gateway
    console.log(`[Backend] Step 1/2: Forwarding file upload to Flask for dataset: ${datasetId}`);
    const uploadResponse = await ragflow.uploadDocument(datasetId, ragflowFile, token);
    if (uploadResponse.success && (uploadResponse.document_ids || uploadResponse.data)) {
      // Accommodate standard response arrays:
      docIds = uploadResponse.document_ids || uploadResponse.data;
      console.log(`[Backend] Document accepted by Flask. Extracted Document IDs:`, docIds);
    } else {
      throw new Error(uploadResponse.error || 'Flask upload succeeded but returned no document identifiers.');
    }

    // Step Two: Trigger the Parsing process via Flask
    if (docIds && docIds.length > 0) {
      console.log(`[Backend] Step 2/2: Requesting parsing run from Flask for document IDs:`, docIds);
      const parseResponse = await ragflow.parseDocuments(datasetId, docIds, token);
      
      if (!parseResponse.success) {
        console.warn(`[Backend] Warning: Parse execution trigger failed or returned notice:`, parseResponse.error);
      } else {
        console.log(`[Backend] Parse run successfully dispatched to chunking engines.`);
      }
    }

    // Final Step: Sync the generated document IDs back down to our core database row
    const { data: updatedRow, error: updateError } = await supabase
      .from('training_modules')
      .update({ rag_document_ids: docIds })
      .eq('id', moduleRow.id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    console.log('[Backend] Module lifecycle complete. Saved in DB id:', moduleRow.id, 'Associated RAG ids:', docIds);
    res.status(201).json({ 
      success: true, 
      message: 'Module uploaded and scheduled for parsing successfully', 
      data: { module: rowToModule(updatedRow) } 
    });

  } catch (error: any) {
    console.error('Module upload orchestration failure:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error processing asset.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Training Feedback Endpoints (AUTHENTICATED)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/training-feedback', requireAuth(), async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('training_feedback')
      .select(`
        *,
        training_modules (
          id, title, competency_area, module_type, audience
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const feedbacks = (data || []).map((item: any) => ({
      id: item.id,
      teacherId: item.teacher_id,
      teacherName: item.teacher_name,
      assignmentId: item.assignment_id,
      moduleId: item.module_id,
      rating: item.rating,
      wasHelpful: item.was_helpful,
      comment: item.comment,
      strengths: item.strengths || [],
      improvements: item.improvements || [],
      stillHasIssue: item.still_has_issue,
      needsAdditionalSupport: item.needs_additional_support,
      createdAt: item.created_at,
      module: item.training_modules ? {
        id: item.training_modules.id,
        title: item.training_modules.title,
        competencyArea: item.training_modules.competency_area,
        moduleType: item.training_modules.module_type,
        audience: item.training_modules.audience
      } : null
    }));

    res.json({ success: true, data: { feedbacks } });
  } catch (error) {
    console.error('Get training feedback error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/training-feedback/module/:moduleId', requireAuth(), async (req: Request, res: Response) => {
  const { moduleId } = req.params;

  try {
    const { data, error } = await supabase
      .from('training_feedback')
      .select('*')
      .eq('module_id', moduleId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const feedbacks = (data || []).map((item: any) => ({
      id: item.id,
      teacherId: item.teacher_id,
      teacherName: item.teacher_name,
      assignmentId: item.assignment_id,
      moduleId: item.module_id,
      rating: item.rating,
      wasHelpful: item.was_helpful,
      comment: item.comment,
      strengths: item.strengths || [],
      improvements: item.improvements || [],
      stillHasIssue: item.still_has_issue,
      needsAdditionalSupport: item.needs_additional_support,
      createdAt: item.created_at
    }));

    res.json({ success: true, data: { feedbacks } });
  } catch (error) {
    console.error('Get module feedback error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/training-feedback/teacher/:teacherId', requireAuth(), async (req: Request, res: Response) => {
  const { teacherId } = req.params;

  try {
    const { data, error } = await supabase
      .from('training_feedback')
      .select(`
        *,
        training_modules (
          id, title, competency_area, module_type, audience
        )
      `)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const feedbacks = (data || []).map((item: any) => ({
      id: item.id,
      teacherId: item.teacher_id,
      teacherName: item.teacher_name,
      assignmentId: item.assignment_id,
      moduleId: item.module_id,
      rating: item.rating,
      wasHelpful: item.was_helpful,
      comment: item.comment,
      strengths: item.strengths || [],
      improvements: item.improvements || [],
      stillHasIssue: item.still_has_issue,
      needsAdditionalSupport: item.needs_additional_support,
      createdAt: item.created_at,
      module: item.training_modules ? {
        id: item.training_modules.id,
        title: item.training_modules.title,
        competencyArea: item.training_modules.competency_area,
        moduleType: item.training_modules.module_type,
        audience: item.training_modules.audience
      } : null
    }));

    res.json({ success: true, data: { feedbacks } });
  } catch (error) {
    console.error('Get teacher training feedback error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Lesson Planner CRUD Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Explicitly save or persist a lesson plan to the database
 * POST /api/dashboard/lessons/plans
 */
router.post('/lessons/plans', requireAuth(), async (req: Request, res: Response) => {
  try {
    const { 
      teacher_id, class_name, subject, topic, lesson_json, 
      assignment_json, board, language, duration_minutes, 
      dataset_id, rag_chunks_used, notes, status 
    } = req.body;

    // Strict validation matching the Python script
    if (!teacher_id || !class_name || !subject || !topic || !lesson_json) {
      return res.status(400).json({ 
        success: false, 
        error: 'teacher_id, class_name, subject, topic, and lesson_json are required' 
      });
    }

    const { data: record, error } = await supabase
      .from('lesson_plans')
      .insert({
        teacher_id,
        class_name,
        subject,
        topic,
        board: board || 'CBSE',
        language: language || 'English',
        duration_minutes: parseInt(duration_minutes || '45', 10),
        // Supabase handles jsonb natively if passed as objects, or stringified text matching schema
        lesson_json: typeof lesson_json === 'object' ? JSON.stringify(lesson_json) : lesson_json,
        assignment_json: assignment_json ? (typeof assignment_json === 'object' ? JSON.stringify(assignment_json) : assignment_json) : null,
        dataset_id: dataset_id || null,
        rag_chunks_used: parseInt(rag_chunks_used || '0', 10),
        notes: notes || null,
        status: status || 'saved'
      })
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, plan_id: record.id, plan: record });
  } catch (error: any) {
    console.error('[Dashboard] Save lesson plan error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

/**
 * List lesson plans with pagination and metadata filters
 * GET /api/dashboard/lessons/plans
 */
router.get('/lessons/plans', requireAuth(), async (req: Request, res: Response) => {
  try {
    const teacherId = req.query.teacher_id as string;
    const subject = req.query.subject as string;
    const className = req.query.class_name as string;
    const limit = parseInt(req.query.limit as string || '20', 10);
    const offset = parseInt(req.query.offset as string || '0', 10);

    let query = supabase
      .from('lesson_plans')
      .select('id, teacher_id, class_name, subject, topic, board, language, duration_minutes, status, notes, rag_chunks_used, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (teacherId) query = query.eq('teacher_id', teacherId);
    if (subject) query = query.eq('subject', subject);
    if (className) query = query.eq('class_name', className);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      success: true,
      plans: data || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (error: any) {
    console.error('[Dashboard] List lesson plans error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

/**
 * Retrieve a complete single lesson plan containing full json objects
 * GET /api/dashboard/lessons/plans/:planId
 */
router.get('/lessons/plans/:planId', requireAuth(), async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;

    const { data: plan, error } = await supabase
      .from('lesson_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error) throw error;
    if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });

    // Safeguard parsing stringified JSON text columns back into clean JavaScript objects
    if (typeof plan.lesson_json === 'string') {
      try { plan.lesson_json = JSON.parse(plan.lesson_json); } catch (e) {}
    }
    if (typeof plan.assignment_json === 'string') {
      try { plan.assignment_json = JSON.parse(plan.assignment_json); } catch (e) {}
    }

    res.json({ success: true, plan });
  } catch (error: any) {
    console.error('[Dashboard] Get lesson plan error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

/**
 * Update lightweight statuses or personal text notes on a lesson plan
 * PATCH /api/dashboard/lessons/plans/:planId
 */
router.patch('/lessons/plans/:planId', requireAuth(), async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { notes, status } = req.body;

    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (notes !== undefined) updatePayload.notes = notes;
    if (status !== undefined) updatePayload.status = status;

    if (Object.keys(updatePayload).length === 1) {
      return res.status(400).json({ success: false, error: "Nothing to update — pass 'notes' or 'status'" });
    }

    const { data: updatedPlan, error } = await supabase
      .from('lesson_plans')
      .update(updatePayload)
      .eq('id', planId)
      .select('*')
      .single();

    if (error) throw error;
    if (!updatedPlan) return res.status(404).json({ success: false, error: 'Plan not found' });

    res.json({ success: true, plan: updatedPlan });
  } catch (error: any) {
    console.error('[Dashboard] Update lesson plan error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

/**
 * Hard delete a lesson plan from storage
 * DELETE /api/dashboard/lessons/plans/:planId
 */
router.delete('/lessons/plans/:planId', requireAuth(), async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;

    const { error } = await supabase
      .from('lesson_plans')
      .delete()
      .eq('id', planId);

    if (error) throw error;

    res.json({ success: true, deleted_id: planId });
  } catch (error: any) {
    console.error('[Dashboard] Delete lesson plan error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

/**
 * Lightweight query optimized for historical views on teacher mobile/web dashboards
 * GET /api/dashboard/lessons/history/:teacherId
 */
router.get('/lessons/history/:teacherId', requireAuth(), async (req: Request, res: Response) => {
  try {
    const { teacherId } = req.params;
    const limit = parseInt(req.query.limit as string || '10', 10);
    const offset = parseInt(req.query.offset as string || '0', 10);

    const { data, error, count } = await supabase
      .from('lesson_plans')
      .select('id, class_name, subject, topic, board, language, duration_minutes, status, created_at', { count: 'exact' })
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      success: true,
      teacher_id: teacherId,
      plans: data || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (error: any) {
    console.error('[Dashboard] Get teacher history error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

export default router;