import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Search, Trash2, Upload, Users } from 'lucide-react';
import ImportStudentsModal from '@/components/students/ImportStudentsModal';
import StudentFormModal from '@/components/students/StudentFormModal';
import { STUDENT_COLUMNS } from '@/lib/columns';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { supabase } from '@/lib/supabase';
import type { Student } from '@/lib/types';
import { errorBoxClass, iconButtonClass, inputClass, primaryButtonClass, secondaryButtonClass } from '@/lib/ui';

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; student: Student }
  | { type: 'import' }
  | null;

export default function StudentsPage({ isAdmin }: { isAdmin: boolean }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<ModalState>(null);

  const loadStudents = useCallback(async () => {
    try {
      setStudents(await fetchAllRows<Student>('students', STUDENT_COLUMNS, 'roll_no'));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load students.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const rollNumbers = useMemo(() => new Set(students.map((student) => student.roll_no)), [students]);

  const visibleStudents = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (student) =>
        student.roll_no.toLowerCase().includes(term) ||
        student.name.toLowerCase().includes(term) ||
        (student.department ?? '').toLowerCase().includes(term),
    );
  }, [students, query]);

  async function handleDelete(student: Student) {
    if (!window.confirm(`Remove ${student.name} (${student.roll_no}) from the roster?`)) return;
    setActionError(null);
    const { data, error } = await supabase.from('students').delete().eq('id', student.id).select('id');
    if (error) {
      setActionError(error.message);
      return;
    }
    if (!data?.length) {
      setActionError(`${student.name} has points from a published event, so they cannot be removed.`);
      return;
    }
    setStudents((prev) => prev.filter((item) => item.id !== student.id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Students</h1>
          <p className="mt-1 text-sm text-slate-600">
            {students.length} students on the roster{!isAdmin && ' (view only)'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setModal({ type: 'import' })} className={secondaryButtonClass}>
              <Upload className="h-4 w-4" />
              Import list
            </button>
            <button type="button" onClick={() => setModal({ type: 'add' })} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              Add student
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by roll number, name, or department"
          className={`${inputClass} pl-9`}
        />
      </div>

      {loadError && <p className={errorBoxClass}>Could not load students: {loadError}</p>}
      {actionError && <p className={errorBoxClass}>{actionError}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading students...
          </div>
        ) : visibleStudents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Users className="h-6 w-6" />
            </div>
            <p className="font-medium text-slate-900">
              {students.length === 0 ? 'No students yet' : 'No students match your search'}
            </p>
            {students.length === 0 && (
              <p className="text-sm text-slate-600">
                {isAdmin ? 'Import your list from a spreadsheet to get started.' : 'An admin needs to import the list first.'}
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3">Roll no</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="hidden px-6 py-3 sm:table-cell">Department</th>
                  {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleStudents.map((student) => (
                  <tr key={student.id} className="transition hover:bg-slate-50">
                    <td className="whitespace-nowrap px-6 py-3 font-mono text-slate-900">{student.roll_no}</td>
                    <td className="px-6 py-3 text-slate-800">{student.name}</td>
                    <td className="hidden px-6 py-3 text-slate-600 sm:table-cell">{student.department ?? '-'}</td>
                    {isAdmin && (
                      <td className="px-6 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setModal({ type: 'edit', student })}
                            className={iconButtonClass}
                            aria-label={`Edit ${student.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(student)}
                            className={`${iconButtonClass} hover:text-red-600`}
                            aria-label={`Remove ${student.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.type === 'add' && (
        <StudentFormModal student={null} onClose={() => setModal(null)} onSaved={loadStudents} />
      )}
      {modal?.type === 'edit' && (
        <StudentFormModal student={modal.student} onClose={() => setModal(null)} onSaved={loadStudents} />
      )}
      {modal?.type === 'import' && (
        <ImportStudentsModal
          existingRollNos={rollNumbers}
          onClose={() => setModal(null)}
          onImported={loadStudents}
        />
      )}
    </div>
  );
}
