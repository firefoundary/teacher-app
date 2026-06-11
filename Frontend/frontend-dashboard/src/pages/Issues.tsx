import { useState, useEffect } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { IssueTable } from '@/components/IssueTable';
import { api, type Issue } from '@/services/api';
import { toast } from '@/hooks/use-toast';

interface FeedbackProps {
  onLogout: () => void;
}

export function FeedbackPage({ onLogout }: FeedbackProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const result = await api.getIssues();
      setIssues(result.issues);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load feedback issues',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const handleStatusChange = async (id: string, status: Issue['status']) => {
    try {
      await api.updateIssueStatus(id, status);
      setIssues(prev => 
        prev.map(issue => 
          issue.id === id ? { ...issue, status, updatedAt: new Date().toISOString() } : issue
        )
      );
      toast({
        title: 'Status Updated',
        description: 'Issue status has been updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update issue status',
        variant: 'destructive',
      });
    }
  };

  const handleView = (issue: Issue) => {
    setSelectedIssue(issue);
  };

  const handleExport = () => {
    const headers = ['ID', 'Teacher', 'Cluster', 'Category', 'Status', 'Description', 'Created At'];
    const rows = issues.map(i => [
      i.id, 
      i.teacherName || 'Unknown', 
      i.cluster, 
      i.category, 
      i.status, 
      `"${i.description.replace(/"/g, '""')}"`, 
      new Date(i.createdAt).toLocaleDateString()
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'feedback-report.csv';
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Complete',
      description: 'Feedback report has been downloaded',
    });
  };

  // Stats
  const pendingCount = issues.filter(i => i.status === 'pending').length;
  const inReviewCount = issues.filter(i => i.status === 'reviewed').length;
  const resolvedCount = issues.filter(i => i.status === 'training_assigned').length;

  return (
    <DashboardLayout 
      title="Issues" 
      subtitle="Issue tracking"
      onLogout={onLogout}
    >
      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="dashboard-card py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-destructive">{pendingCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <span className="text-destructive font-semibold">{pendingCount}</span>
            </div>
          </div>
        </div>

        <div className="dashboard-card py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">In Review</p>
              <p className="text-2xl font-bold text-warning">{inReviewCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
              <span className="text-warning font-semibold">{inReviewCount}</span>
            </div>
          </div>
        </div>

        <div className="dashboard-card py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Resolved</p>
              <p className="text-2xl font-bold text-success">{resolvedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
              <span className="text-success font-semibold">{resolvedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
        <div>
          <p className="text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{issues.length}</span> reported issue
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchIssues} className="btn-secondary" disabled={loading}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button onClick={handleExport} className="btn-secondary">
            <Download size={18} />
            Export Report
          </button>
        </div>
      </div>

      {/* Issues Table */}
      <IssueTable 
        issues={issues} 
        loading={loading}
        onStatusChange={handleStatusChange}
        onView={handleView}
      />

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm"
          onClick={() => setSelectedIssue(null)}
        >
          <div 
            className="dashboard-card max-w-lg w-full mx-4 max-h-[80vh] overflow-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Issue Details</h3>
                <p className="text-sm text-muted-foreground">ID: {selectedIssue.id}</p>
              </div>
              <button 
                onClick={() => setSelectedIssue(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Teacher</p>
                  <p className="font-medium text-foreground">{selectedIssue.teacherName || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Cluster</p>
                  <p className="font-medium text-foreground">{selectedIssue.cluster}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Category</p>
                  <p className="font-medium text-foreground capitalize">{selectedIssue.category}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                  <span className={`badge ${
                    selectedIssue.status === 'pending' ? 'badge-destructive' :
                    selectedIssue.status === 'resolved' ? 'badge-success' : 'badge-warning'
                  } capitalize`}>
                    {selectedIssue.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Description</p>
                <p className="text-foreground bg-muted/50 p-3 rounded-lg">{selectedIssue.description}</p>
              </div>

              {selectedIssue.adminRemarks && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Admin Remarks</p>
                  <p className="text-foreground bg-muted/50 p-3 rounded-lg">{selectedIssue.adminRemarks}</p>
                </div>
              )}

              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Created: {new Date(selectedIssue.createdAt).toLocaleString()}</span>
                <span>Updated: {new Date(selectedIssue.updatedAt).toLocaleString()}</span>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <button 
                  onClick={() => setSelectedIssue(null)}
                  className="btn-secondary flex-1"
                >
                  Close
                </button>
                <select
                  value={selectedIssue.status}
                  onChange={(e) => {
                    handleStatusChange(selectedIssue.id, e.target.value as Issue['status']);
                    setSelectedIssue({ ...selectedIssue, status: e.target.value as Issue['status'] });
                  }}
                  className="input-field flex-1"
                >
                  <option value="pending">Pending</option>
                  <option value="in_review">In Review</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="resolved">Resolved</option>
                  <option value="training_assigned">Training Assigned</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default FeedbackPage;

