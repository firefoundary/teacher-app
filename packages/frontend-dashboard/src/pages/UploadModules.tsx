import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  Upload as UploadIcon,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { api } from '@/services/api';  // FIXED: Removed uploadModuleWithFile from import
import type {
  TrainingModule,
  TrainingModuleContextualMetadata,
  ModuleType,
  ModuleAudience,
  ResourceFormat,
  ModuleStatus,
  ModuleUpsertInput,
} from '@/services/api';


type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type UploadStep = 'idle' | 'uploading' | 'done' | 'error';
type SectionKey = 'all' | ModuleType;


interface Section {
  key: SectionKey;
  label: string;
  emptyDescription: string;
}


const SECTIONS: Section[] = [
  { key: 'all', label: 'All Resources', emptyDescription: 'No resources created yet.' },
  { key: 'student_textbook', label: 'Student Textbooks', emptyDescription: 'No student textbooks yet.' },
  { key: 'teacher_training', label: 'Teacher Training', emptyDescription: 'No teacher training resources yet.' },
  { key: 'teacher_resource', label: 'Teacher Resources', emptyDescription: 'No teacher resources yet.' },
  { key: 'assessment_resource', label: 'Assessments', emptyDescription: 'No assessment resources yet.' },
  { key: 'remedial_resource', label: 'Remedial', emptyDescription: 'No remedial resources yet.' },
  { key: 'policy_document', label: 'Policy', emptyDescription: 'No policy documents yet.' },
];


const MODULE_TYPE_OPTIONS: { value: ModuleType; label: string }[] = [
  { value: 'student_textbook', label: 'Student Textbook' },
  { value: 'teacher_training', label: 'Teacher Training' },
  { value: 'teacher_resource', label: 'Teacher Resource' },
  { value: 'assessment_resource', label: 'Assessment Resource' },
  { value: 'remedial_resource', label: 'Remedial Resource' },
  { value: 'policy_document', label: 'Policy Document' },
  { value: 'other', label: 'Other' },
];


const AUDIENCE_OPTIONS: ModuleAudience[] = ['student', 'teacher', 'teacher_educator', 'admin', 'mixed'];
const FORMAT_OPTIONS: ResourceFormat[] = ['pdf', 'epub', 'video', 'audio', 'html', 'mixed', 'link'];
const SOURCE_ORGS = ['NCERT', 'DIKSHA', 'SCERT', 'DIET', 'GCERT', 'DSERT', 'UNESCO', 'ADMIN_DASHBOARD'];
const SOURCE_PLATFORMS = ['ePathshala', 'DIKSHA', 'SCERT Portal', 'DIET Portal', 'Manual Upload', 'Other'];
const CLASS_OPTIONS = ['Pre-primary', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SUBJECT_OPTIONS = ['Mathematics', 'Science', 'English', 'Hindi', 'EVS', 'Social Science', 'Language', 'Pedagogy', 'Assessment', 'FLN'];
const STATE_OPTIONS = ['ALL', 'GJ', 'KA', 'KL', 'TS', 'UP', 'RJ', 'MH', 'MP', 'WB', 'OD', 'AP', 'TN', 'BR'];


function splitCsv(value: string): string[] {
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}


function joinCsv(values?: string[]): string {
  return (values ?? []).join(', ');
}


function defaultFormData() {
  return {
    title: '',
    description: '',
    competencyArea: '',
    moduleType: 'student_textbook' as ModuleType,
    audience: 'student' as ModuleAudience,
    resourceFormat: 'pdf' as ResourceFormat,
    sourceOrg: 'NCERT',
    sourcePlatform: 'ePathshala',
    sourceUrl: '',
    educationLevel: 'School',
    classGrades: '1, 2, 3, 4, 5',
    subjectAreas: 'Mathematics',
    stateCodes: 'ALL',
    board: 'CBSE',
    programTags: 'NCERT, textbook',
    mediumTags: '',
    language: 'English',
    tags: 'ncert, textbook',
    targetClusters: 'All Clusters',
    fullContent: '',
    status: 'draft' as ModuleStatus,
    isNcert: true,
    isStateSpecific: false,
  };
}


function getModuleDocumentIds(module: TrainingModule | null | undefined): string[] {
  return module?.ragDocumentIds?.length ? module.ragDocumentIds : module?.contextualMetadata?.ragflow?.documentIds ?? [];
}


function isTeacherFacing(moduleType: ModuleType) {
  return moduleType === 'teacher_training' || moduleType === 'teacher_resource';
}


export default function UploadModules() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<SectionKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingModule, setEditingModule] = useState<TrainingModule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState(defaultFormData());
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle');
  const [uploadStepMsg, setUploadStepMsg] = useState('');


  useEffect(() => {
    api.getTrainingModules()
      .then(setModules)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);


  const currentSection = SECTIONS.find((s) => s.key === selectedSection) ?? SECTIONS[0];


  const filteredModules = useMemo(() => {
    return modules.filter((m) => {
      const matchesSection = selectedSection === 'all' || m.moduleType === selectedSection;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        m.title.toLowerCase().includes(q) ||
        (m.description ?? '').toLowerCase().includes(q) ||
        (m.sourceOrg ?? '').toLowerCase().includes(q) ||
        (m.subjectAreas ?? []).join(' ').toLowerCase().includes(q);
      return matchesSection && matchesSearch;
    });
  }, [modules, selectedSection, searchQuery]);


  function openCreate() {
    setIsCreating(true);
    setEditingModule(null);
    setFormData(defaultFormData());
    setPdfFile(null);
    setSaveStatus('idle');
    setSaveError(null);
    setUploadStep('idle');
    setUploadStepMsg('');
  }


  function openEdit(module: TrainingModule) {
    setEditingModule(module);
    setIsCreating(false);
    setFormData({
      title: module.title,
      description: module.description ?? '',
      competencyArea: module.competencyArea ?? '',
      moduleType: module.moduleType,
      audience: module.audience,
      resourceFormat: module.resourceFormat,
      sourceOrg: module.sourceOrg ?? 'NCERT',
      sourcePlatform: module.sourcePlatform ?? 'ePathshala',
      sourceUrl: module.sourceUrl ?? '',
      educationLevel: module.educationLevel ?? 'School',
      classGrades: joinCsv(module.classGrades),
      subjectAreas: joinCsv(module.subjectAreas),
      stateCodes: joinCsv(module.stateCodes),
      board: module.board ?? '',
      programTags: joinCsv(module.programTags),
      mediumTags: joinCsv(module.mediumTags),
      language: module.language ?? 'English',
      tags: joinCsv(module.tags),
      targetClusters: joinCsv(module.targetClusters),
      fullContent: module.fullContent ?? '',
      status: module.status,
      isNcert: module.isNcert,
      isStateSpecific: module.isStateSpecific,
    });
    setPdfFile(null);
    setSaveStatus('idle');
    setSaveError(null);
    setUploadStep('idle');
    setUploadStepMsg('');
  }


  function closeForm() {
    setEditingModule(null);
    setIsCreating(false);
    setPdfFile(null);
    setSaveStatus('idle');
    setSaveError(null);
    setUploadStep('idle');
    setUploadStepMsg('');
  }


  function buildPayload(existing?: TrainingModule | null): ModuleUpsertInput {
    return {
      title: formData.title.trim(),
      description: formData.description.trim(),
      competencyArea: formData.competencyArea.trim() || undefined,
      moduleType: formData.moduleType,
      audience: formData.audience,
      resourceFormat: formData.resourceFormat,
      sourceOrg: formData.sourceOrg.trim(),
      sourcePlatform: formData.sourcePlatform.trim(),
      sourceUrl: formData.sourceUrl.trim() || undefined,
      educationLevel: formData.educationLevel.trim(),
      classGrades: splitCsv(formData.classGrades),
      subjectAreas: splitCsv(formData.subjectAreas),
      stateCodes: splitCsv(formData.stateCodes),
      board: formData.board.trim(),
      programTags: splitCsv(formData.programTags),
      mediumTags: splitCsv(formData.mediumTags),
      language: formData.language.trim(),
      tags: splitCsv(formData.tags),
      targetClusters: splitCsv(formData.targetClusters),
      fullContent: formData.fullContent,
      contextualMetadata: existing?.contextualMetadata ?? {},
      audienceTags: [],
      isNcert: formData.isNcert,
      isStateSpecific: formData.isStateSpecific,
      status: formData.status,
      uploaderAdminId: existing?.uploaderAdminId,
    };
  }


  async function handleSave() {
    if (!formData.title.trim()) {
      setSaveError('Title is required.');
      return;
    }

    setSaveStatus('saving');
    setSaveError(null);
    setUploadStep('idle');
    setUploadStepMsg('');

    try {
      let savedModule: TrainingModule;
      const payload = buildPayload(editingModule);

      if (isCreating) {
        if (pdfFile) {
          // FIXED: Use api.uploadModuleWithFile (not standalone function)
          setUploadStep('uploading');
          setUploadStepMsg(`Uploading "${pdfFile.name}"...`);

          savedModule = await api.uploadModuleWithFile(payload, pdfFile);
          setModules((prev) => [savedModule, ...prev]);
          setUploadStep('done');
          setUploadStepMsg('Upload completed successfully.');
        } else {
          // No file: just create metadata
          savedModule = await api.createModule(payload);
          setModules((prev) => [savedModule, ...prev]);
        }
      } else if (editingModule) {
        // Update metadata only
        savedModule = await api.updateModule(editingModule.id, payload);
        setModules((prev) => prev.map((m) => (m.id === savedModule.id ? savedModule : m)));

        // Upload file separately (if provided) - Note: This requires a separate file-only endpoint
        // For now, skip file upload on edit (or implement /api/modules/:id/upload-file)
        if (pdfFile) {
          setUploadStep('uploading');
          setUploadStepMsg(`Note: File upload on edit requires a separate endpoint. File "${pdfFile.name}" was not uploaded.`);
          setUploadStep('error');
          // Uncomment below when you add /api/dashboard/modules/:id/upload-file
          // try {
          //   const uploaded = await api.uploadModuleWithFile(payload, pdfFile);
          //   savedModule = uploaded;
          //   setModules((prev) => prev.map((m) => (m.id === savedModule.id ? savedModule : m)));
          //   setUploadStep('done');
          //   setUploadStepMsg('File uploaded successfully.');
          // } catch (uploadErr: any) {
          //   setUploadStep('error');
          //   setUploadStepMsg(uploadErr?.message ?? 'Upload failed.');
          // }
        }
      } else {
        return;
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
      closeForm();
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err?.message ?? 'Failed to save module.');
      console.error('[Frontend] Save error:', err);
    }
  }


  async function handleDelete(id: string) {
    if (!confirm('Delete this resource?')) return;
    try {
      await api.deleteModule(id);
      setModules((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      console.error('[Frontend] Delete error:', err);
      alert(err?.message ?? 'Failed to delete resource.');
    }
  }


  function renderUploadStepBadge() {
    if (uploadStep === 'idle') return null;
    const icon =
      uploadStep === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin" /> :
      uploadStep === 'done' ? <CheckCircle className="w-4 h-4" /> :
      <AlertCircle className="w-4 h-4" />;
    const color =
      uploadStep === 'uploading' ? 'text-blue-600' :
      uploadStep === 'done' ? 'text-green-600' :
      'text-red-600';
    return (
      <div className={`mt-2 flex items-center gap-2 text-sm ${color}`}>
        {icon}
        <span>{uploadStepMsg}</span>
      </div>
    );
  }


  function renderSaveStatus() {
    if (saveStatus === 'saving') return <> <Loader2 className="w-4 h-4 animate-spin" />Saving...</>;
    if (saveStatus === 'saved') return <> <CheckCircle className="w-4 h-4" />Saved!</>;
    if (saveStatus === 'error') return <> <AlertCircle className="w-4 h-4" />Error</>;
    return <> <Save className="w-4 h-4" />{isCreating ? 'Create Resource' : 'Save Changes'}</>;
  }


  const showTeacherFields = isTeacherFacing(formData.moduleType);


  if (loading) return <DashboardLayout title="Learning Resources" onLogout={() => {}}><div className="p-6 text-gray-500">Loading resources...</div></DashboardLayout>;
  if (error) return <DashboardLayout title="Learning Resources" onLogout={() => {}}><div className="p-6 text-red-600">{error}</div></DashboardLayout>;


  return (
    <DashboardLayout title="Learning Resources" onLogout={() => {}}>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Learning Resources</h1>
            <p className="text-sm text-gray-600">Manage NCERT, teacher-training, and education resources</p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New Resource
          </button>
        </div>


        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSelectedSection(s.key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedSection === s.key ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resources..."
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 md:max-w-sm"
          />
        </div>


        {filteredModules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            {currentSection.emptyDescription}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredModules.map((module) => (
              <div key={module.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-gray-900">{module.title}</h3>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                        {(module.moduleType as string).replace(/_/g, ' ')}
                      </span>
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        {module.audience}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(module)}
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-primary/10 hover:text-primary"
                      aria-label="Edit resource"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(module.id)}
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      aria-label="Delete resource"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>


                {module.description && <p className="mt-3 text-sm text-gray-600">{module.description}</p>}


                <div className="mt-4 space-y-1 text-xs text-gray-500">
                  <div><span className="font-medium text-gray-700">Source:</span> {module.sourceOrg || '—'} {module.sourcePlatform ? `• ${module.sourcePlatform}` : ''}</div>
                  <div><span className="font-medium text-gray-700">Classes:</span> {(module.classGrades ?? []).join(', ') || '—'}</div>
                  <div><span className="font-medium text-gray-700">Subjects:</span> {(module.subjectAreas ?? []).join(', ') || '—'}</div>
                </div>


                {getModuleDocumentIds(module).length > 0 && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-emerald-700">
                    <FileText className="w-4 h-4" />
                    Linked to {getModuleDocumentIds(module).length} document(s)
                  </div>
                )}
              </div>
            ))}
          </div>
        )}


        {(isCreating || editingModule) && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">{isCreating ? 'Create Resource' : 'Edit Resource'}</h2>
              <button
                onClick={closeForm}
                className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>


            <div className="grid gap-5 md:grid-cols-2">
              {/* All the form fields remain the same as original */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Title *</label>
                <input
                  value={formData.title}
                  onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Resource title"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Competency Area</label>
                <input
                  value={formData.competencyArea}
                  onChange={(e) => setFormData((f) => ({ ...f, competencyArea: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Optional, mainly for teacher-facing resources"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Module Type</label>
                <select
                  value={formData.moduleType}
                  onChange={(e) => setFormData((f) => ({ ...f, moduleType: e.target.value as ModuleType }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {MODULE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Audience</label>
                <select
                  value={formData.audience}
                  onChange={(e) => setFormData((f) => ({ ...f, audience: e.target.value as ModuleAudience }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {AUDIENCE_OPTIONS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Resource Format</label>
                <select
                  value={formData.resourceFormat}
                  onChange={(e) => setFormData((f) => ({ ...f, resourceFormat: e.target.value as ResourceFormat }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {FORMAT_OPTIONS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Language</label>
                <input
                  value={formData.language}
                  onChange={(e) => setFormData((f) => ({ ...f, language: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="English / Hindi / Gujarati"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Source Organisation</label>
                <input
                  list="source-orgs"
                  value={formData.sourceOrg}
                  onChange={(e) => setFormData((f) => ({ ...f, sourceOrg: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <datalist id="source-orgs">{SOURCE_ORGS.map((v) => <option key={v} value={v} />)}</datalist>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Source Platform</label>
                <input
                  list="source-platforms"
                  value={formData.sourcePlatform}
                  onChange={(e) => setFormData((f) => ({ ...f, sourcePlatform: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <datalist id="source-platforms">{SOURCE_PLATFORMS.map((v) => <option key={v} value={v} />)}</datalist>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Source URL</label>
                <input
                  value={formData.sourceUrl}
                  onChange={(e) => setFormData((f) => ({ ...f, sourceUrl: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Optional source link"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Classes / Grades</label>
                <input
                  value={formData.classGrades}
                  onChange={(e) => setFormData((f) => ({ ...f, classGrades: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={CLASS_OPTIONS.join(', ')}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Subjects</label>
                <input
                  value={formData.subjectAreas}
                  onChange={(e) => setFormData((f) => ({ ...f, subjectAreas: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={SUBJECT_OPTIONS.join(', ')}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">States</label>
                <input
                  value={formData.stateCodes}
                  onChange={(e) => setFormData((f) => ({ ...f, stateCodes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={STATE_OPTIONS.join(', ')}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Board</label>
                <input
                  value={formData.board}
                  onChange={(e) => setFormData((f) => ({ ...f, board: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="NCERT / State Board"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Program Tags</label>
                <input
                  value={formData.programTags}
                  onChange={(e) => setFormData((f) => ({ ...f, programTags: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="NCERT, NISHTHA, FLN"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Medium Tags</label>
                <input
                  value={formData.mediumTags}
                  onChange={(e) => setFormData((f) => ({ ...f, mediumTags: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Hindi, Gujarati"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">General Tags</label>
                <input
                  value={formData.tags}
                  onChange={(e) => setFormData((f) => ({ ...f, tags: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="comma separated tags"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Target Clusters</label>
                <input
                  value={formData.targetClusters}
                  onChange={(e) => setFormData((f) => ({ ...f, targetClusters: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="All Clusters"
                />
              </div>

              <div className="flex items-center gap-6 pt-7">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.isNcert}
                    onChange={(e) => setFormData((f) => ({ ...f, isNcert: e.target.checked }))}
                  />
                  NCERT resource
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.isStateSpecific}
                    onChange={(e) => setFormData((f) => ({ ...f, isStateSpecific: e.target.checked }))}
                  />
                  State-specific
                </label>
              </div>

              {showTeacherFields && (
                <div className="md:col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-700 mb-3">Teacher-facing metadata</div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Competency Area</label>
                      <input
                        value={formData.competencyArea}
                        onChange={(e) => setFormData((f) => ({ ...f, competencyArea: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="Optional for teacher resources"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Teaching Focus</label>
                      <input
                        value={formData.description}
                        onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="Short teacher-facing description"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Short description"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Full Content</label>
                <textarea
                  value={formData.fullContent}
                  onChange={(e) => setFormData((f) => ({ ...f, fullContent: e.target.value }))}
                  rows={5}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Optional text body / extracted content"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">PDF Upload</label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:border-primary hover:bg-primary/5">
                  <UploadIcon className="w-4 h-4" />
                  <span>{pdfFile ? pdfFile.name : 'Click to select a PDF'}</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {editingModule && getModuleDocumentIds(editingModule).length > 0 && (
                  <div className="mt-2 text-xs text-emerald-700">
                    Existing linked docs: {getModuleDocumentIds(editingModule).length}
                  </div>
                )}
                {renderUploadStepBadge()}
              </div>
            </div>


            {saveError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
              </div>
            )}


            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={closeForm}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                {renderSaveStatus()}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}