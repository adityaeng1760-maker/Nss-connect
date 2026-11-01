import { useState, type FormEvent } from 'react';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import type { Student } from '@/lib/types';
import { errorBoxClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '@/lib/ui';

interface StudentFormModalProps {
  student: Student | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function StudentFormModal({ student, onClose, onSaved }: StudentFormModalProps) {
  const [rollNo, setRollNo] = useState(student?.roll_no ?? '');
  const [name, setName] = useState(student?.name ?? '');
  const [department, setDepartment] = useState(student?.department ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      roll_no: rollNo.trim().toUpperCase(),
      name: name.trim(),
      department: department.trim() || null,
    };

    setSaving(true);
    setError(null);
    const result = student
      ? await supabase.from('students').update(payload).eq('id', student.id).select('id')
      : await supabase.from('students').insert(payload).select('id');
    setSaving(false);

    if (result.error) {
      setError(
        result.error.code === '23505'
          ? `Roll number ${payload.roll_no} is already in the list.`
          : result.error.message,
      );
      return;
    }
    if (!result.data?.length) {
      setError('This student could not be saved. Please try again.');
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal title={student ? 'Edit student' : 'Add student'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="roll-no" className={labelClass}>Roll number</label>
          <input
            id="roll-no"
            required
            value={rollNo}
            onChange={(event) => setRollNo(event.target.value)}
            className={`${inputClass} uppercase`}
            placeholder="e.g. 21CS001"
          />
        </div>
        <div>
          <label htmlFor="student-name" className={labelClass}>Full name</label>
          <input
            id="student-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
            placeholder="Student name"
          />
        </div>
        <div>
          <label htmlFor="department" className={labelClass}>Department (optional)</label>
          <input
            id="department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            className={inputClass}
            placeholder="e.g. Computer Science"
          />
        </div>

        {error && <p className={errorBoxClass}>{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? 'Saving...' : 'Save student'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
