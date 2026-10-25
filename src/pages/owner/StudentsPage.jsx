import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import StudentModal from '../../components/students/StudentModal';
import StudentDetailsDrawer from '../../components/students/StudentDetailsDrawer';
import DeleteStudentDialog from '../../components/students/DeleteStudentDialog';
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function StudentsPage({ onOpenReceipt, onSendWhatsApp }) {
  const { apiFetch, isReadOnlyMode } = useAuth();
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [viewingStudentId, setViewingStudentId] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadStudents(1);
  }, [status]);

  async function loadStudents(page = 1) {
    setLoading(true);
    try {
      let query = `page=${page}&limit=${pagination.limit}&status=${status}`;
      if (search.trim()) query += `&search=${encodeURIComponent(search.trim())}`;

      const res = await apiFetch(`/api/students?${query}`);
      const data = await res.json();
      setStudents(data.students || []);
      setPagination(data.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadStudents(1);
  }

  async function handleConfirmDelete(studentId, deleteMode) {
    if (isReadOnlyMode) return;
    setDeleteLoading(true);
    try {
      const res = await apiFetch(`/api/students/${studentId}?mode=${deleteMode}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete student.');

      setDeletingStudent(null);
      loadStudents(pagination.page);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      {/* Top Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search name, adm #, phone..."
              className="form-input"
              style={{ paddingLeft: '36px', width: '260px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="form-select"
            style={{ width: '150px' }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button type="submit" className="btn btn-outline">
            Filter
          </button>
        </form>

        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingStudent(null);
            setIsModalOpen(true);
          }}
          disabled={isReadOnlyMode}
        >
          <Plus size={16} /> New Admission
        </button>
      </div>

      {/* Students Table */}
      <div className="table-container">
        <table className="saas-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Admission #</th>
              <th>Phone</th>
              <th>Assigned Seat & Shift</th>
              <th>Fee Plan</th>
              <th>Pending Due</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  Loading students...
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  No student records found. Click "New Admission" to register a student.
                </td>
              </tr>
            ) : (
              students.map((student) => {
                const hasDue = Number(student.total_due_amount) > 0;
                return (
                  <tr key={student.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: '#e0e7ff',
                            color: '#4338ca',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '13px',
                          }}
                        >
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{student.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{student.email || 'No email'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                      {student.admission_number}
                    </td>
                    <td>{student.phone}</td>
                    <td>
                      {student.assigned_seats ? (
                        <span className="badge badge-success" style={{ fontSize: '11.5px' }}>
                          {student.assigned_seats}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Unassigned</span>
                      )}
                    </td>
                    <td>{student.plan_name || 'Standard'}</td>
                    <td>
                      {hasDue ? (
                        <span style={{ fontWeight: 700, color: '#dc2626' }}>
                          ₹{student.total_due_amount}
                        </span>
                      ) : (
                        <span style={{ color: '#059669', fontWeight: 600 }}>Paid</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${student.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                        {student.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-outline btn-sm"
                          title="View Profile Details"
                          onClick={() => setViewingStudentId(student.id)}
                        >
                          <Eye size={13} />
                        </button>

                        <button
                          className="btn btn-outline btn-sm"
                          title="Edit Details"
                          onClick={() => {
                            setEditingStudent(student);
                            setIsModalOpen(true);
                          }}
                          disabled={isReadOnlyMode}
                        >
                          <Edit2 size={13} />
                        </button>

                        {hasDue && (
                          <button
                            className="btn btn-outline btn-sm"
                            title="Send WhatsApp Reminder"
                            onClick={() => onSendWhatsApp && onSendWhatsApp([student.id])}
                          >
                            <MessageSquare size={13} style={{ color: '#25d366' }} />
                          </button>
                        )}

                        <button
                          className="btn btn-danger btn-sm"
                          title="Delete Student"
                          onClick={() => setDeletingStudent(student)}
                          disabled={isReadOnlyMode}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {pagination.totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '18px',
            padding: '0 8px',
          }}
        >
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total students)
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-outline btn-sm"
              disabled={pagination.page <= 1}
              onClick={() => loadStudents(pagination.page - 1)}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => loadStudents(pagination.page + 1)}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      <StudentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        student={editingStudent}
        onSaved={() => loadStudents(pagination.page)}
      />

      {/* Student Details Drawer */}
      <StudentDetailsDrawer
        isOpen={Boolean(viewingStudentId)}
        onClose={() => setViewingStudentId(null)}
        studentId={viewingStudentId}
        onOpenReceipt={onOpenReceipt}
      />

      {/* Permanent Deletion Dialog */}
      <DeleteStudentDialog
        isOpen={Boolean(deletingStudent)}
        onClose={() => setDeletingStudent(null)}
        student={deletingStudent}
        onConfirmDelete={handleConfirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
