import { useState, useEffect } from 'react';
import { Plus, Download, X } from 'lucide-react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { TeacherTable } from '@/components/TeacherTable';
import { api, type Teacher } from '@/services/api';
import { toast } from '@/hooks/use-toast';

interface TeachersProps {
  onLogout: () => void;
}

export function Teachers({ onLogout }: TeachersProps) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [clusters, setClusters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingClusters, setLoadingClusters] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cluster: '',
    employeeId: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTeachers();
    fetchClusters();
  }, []);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const data = await api.getTeachers();
      setTeachers(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load teachers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClusters = async () => {
    setLoadingClusters(true);
    try {
      const data = await api.getClusters();
      setClusters(data);
    } catch (error) {
      console.error('Failed to load clusters:', error);
      // Fallback: extract unique clusters from teachers
      const uniqueClusters = [...new Set(teachers.map(t => t.cluster))];
      setClusters(uniqueClusters);
      toast({
        title: 'Warning',
        description: 'Using clusters from existing teachers',
        variant: 'destructive',
      });
    } finally {
      setLoadingClusters(false);
    }
  };

  const handleAdd = () => {
    setFormData({
      name: '',
      email: '',
      cluster: '',
      employeeId: '',
      password: '',
    });
    setShowAddModal(true);
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.name,
      email: teacher.email,
      cluster: teacher.cluster,
      employeeId: teacher.employeeId,
      password: '',
    });
    setShowEditModal(true);
  };

  const handleDelete = async (teacher: Teacher) => {
    if (!window.confirm(`Are you sure you want to delete ${teacher.name}?\n\nThis will only work if the teacher has no feedback or training assignments.`)) {
      return;
    }

    try {
      await api.deleteTeacher(teacher.id);
      setTeachers(prev => prev.filter(t => t.id !== teacher.id));
      toast({
        title: 'Teacher Deleted',
        description: `${teacher.name} has been removed`,
      });
      fetchClusters();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete teacher',
        variant: 'destructive',
      });
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const newTeacher = await api.createTeacher(formData);
      setTeachers(prev => [...prev, newTeacher]);
      setShowAddModal(false);
      toast({
        title: 'Teacher Added',
        description: `${newTeacher.name} has been added successfully`,
      });
      fetchClusters();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create teacher',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;

    setSubmitting(true);
    try {
      const updates: any = {
        name: formData.name,
        email: formData.email,
        cluster: formData.cluster,
        employeeId: formData.employeeId,
      };

      if (formData.password) {
        updates.password = formData.password;
      }

      const updatedTeacher = await api.updateTeacher(editingTeacher.id, updates);
      setTeachers(prev => prev.map(t => t.id === updatedTeacher.id ? updatedTeacher : t));
      setShowEditModal(false);
      setEditingTeacher(null);
      toast({
        title: 'Teacher Updated',
        description: `${updatedTeacher.name} has been updated successfully`,
      });
      fetchClusters();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update teacher',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    const headers = ['Name', 'Email', 'Cluster', 'Employee ID', 'Created At'];
    const rows = teachers.map(t => [
      t.name,
      t.email,
      t.cluster,
      t.employeeId,
      new Date(t.createdAt).toLocaleDateString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teachers-report.csv';
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Complete',
      description: 'Teachers report has been downloaded',
    });
  };

  return (
    <DashboardLayout 
      title="Teachers" 
      subtitle="Manage teacher accounts and access"
      onLogout={onLogout}
    >
      <div className="space-y-6">
        {/* Stats - Only Total Teachers */}
        <div className="grid gap-4 md:grid-cols-1">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Teachers</p>
                <p className="text-3xl font-bold">{teachers.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Total of {teachers.length} registered teachers
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="btn-secondary flex items-center gap-2"
              disabled={teachers.length === 0}
            >
              <Download className="h-4 w-4" />
              Export Report
            </button>
            <button
              onClick={handleAdd}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Teacher
            </button>
          </div>
        </div>

        {/* Teachers Table */}
        <TeacherTable
          teachers={teachers}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        {/* Add Teacher Modal */}
        {showAddModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowAddModal(false)}
          >
            <div
              className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Add New Teacher</h2>
                  <p className="text-sm text-muted-foreground">Create a new teacher account</p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitAdd} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Rajesh Kumar"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                    placeholder="e.g., rajesh@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Cluster *</label>
                  <select
                    required
                    value={formData.cluster}
                    onChange={(e) => setFormData({ ...formData, cluster: e.target.value })}
                    className="input-field"
                    disabled={loadingClusters}
                  >
                    <option value="">
                      {loadingClusters ? 'Loading clusters...' : 'Select Cluster'}
                    </option>
                    {clusters.map(cluster => (
                      <option key={cluster} value={cluster}>
                        {cluster}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Employee ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="input-field"
                    placeholder="e.g., EMP001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Temporary Password *</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input-field"
                    placeholder="Minimum 6 characters"
                    minLength={6}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Teacher should change this on first login
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary flex-1"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1"
                    disabled={submitting}
                  >
                    {submitting ? 'Creating...' : 'Create Teacher'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Teacher Modal */}
        {showEditModal && editingTeacher && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowEditModal(false)}
          >
            <div
              className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Edit Teacher</h2>
                  <p className="text-sm text-muted-foreground">Update teacher information</p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Cluster *</label>
                  <select
                    required
                    value={formData.cluster}
                    onChange={(e) => setFormData({ ...formData, cluster: e.target.value })}
                    className="input-field"
                    disabled={loadingClusters}
                  >
                    {clusters.map(cluster => (
                      <option key={cluster} value={cluster}>
                        {cluster}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Employee ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">New Password (optional)</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input-field"
                    placeholder="Leave blank to keep current password"
                    minLength={6}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Only fill this if you want to reset the password
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="btn-secondary flex-1"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1"
                    disabled={submitting}
                  >
                    {submitting ? 'Updating...' : 'Update Teacher'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default Teachers;
