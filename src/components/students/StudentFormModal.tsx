
import { useState, type FormEvent } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import Modal from '@/components/Modal';
import { db } from '@/lib/firebase';
import type { Student } from '@/lib/types';
import {
  errorBoxClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/lib/ui';

interface StudentFormModalProps {
  student: Student | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function StudentFormModal({
  student,
  onClose,
  onSaved,
}: StudentFormModalProps) {
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

    try {
      // Check whether this roll number is already registered.
      const duplicateQuery = query(
        collection(db, 'students'),
        where('roll_no', '==', payload.roll_no),
      );

      const duplicateSnapshot = await getDocs(duplicateQuery);

      const duplicateExists = duplicateSnapshot.docs.some(
        (existingDoc) => existingDoc.id !== student?.id,
      );

      if (duplicateExists) {
        setError(`Roll number ${payload.roll_no} is already in the list.`);
        return;
      }

      if (student) {
        await updateDoc(doc(db, 'students', student.id), payload);
      } else {
        await addDoc(collection(db, 'students'), payload);
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Student save error:', err);
      setError('The student could not be saved. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={student ? 'Edit student' : 'Add student'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="roll-no" className={labelClass}>
            Roll number
          </label>
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
          <label htmlFor="student-name" className={labelClass}>
            Full name
          </label>
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
          <label htmlFor="department" className={labelClass}>
            Department (optional)
          </label>
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
          <button
            type="button"
            onClick={onClose}
            className={secondaryButtonClass}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className={primaryButtonClass}
          >
            {saving ? 'Saving...' : 'Save student'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
