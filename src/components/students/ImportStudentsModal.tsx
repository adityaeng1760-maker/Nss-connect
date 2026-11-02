
import { useMemo, useState, type FormEvent } from 'react';
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import Modal from '@/components/Modal';
import { db } from '@/lib/firebase';
import { parseRows } from '@/lib/csv';
import {
  errorBoxClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  successBoxClass,
} from '@/lib/ui';

const CHUNK_SIZE = 500;

interface NewStudent {
  roll_no: string;
  name: string;
  department: string | null;
}

interface ImportPlan {
  students: NewStudent[];
  duplicates: number;
  invalid: number;
}

function buildImportPlan(
  text: string,
  existingRollNos: Set<string>,
): ImportPlan {
  const planned = new Map<string, NewStudent>();
  let duplicates = 0;
  let invalid = 0;

  for (const cells of parseRows(text)) {
    const [rollCell = '', nameCell = '', departmentCell = ''] = cells;

    if (/^roll/i.test(rollCell) && /^name$/i.test(nameCell)) continue;

    const rollNo = rollCell.trim().toUpperCase();
    const name = nameCell.trim();

    if (!rollNo || !name) {
      invalid += 1;
      continue;
    }

    if (existingRollNos.has(rollNo) || planned.has(rollNo)) {
      duplicates += 1;
      continue;
    }

    planned.set(rollNo, {
      roll_no: rollNo,
      name,
      department: departmentCell.trim() || null,
    });
  }

  return {
    students: [...planned.values()],
    duplicates,
    invalid,
  };
}

interface ImportStudentsModalProps {
  existingRollNos: Set<string>;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportStudentsModal({
  existingRollNos,
  onClose,
  onImported,
}: ImportStudentsModalProps) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const plan = useMemo(
    () => buildImportPlan(text, existingRollNos),
    [text, existingRollNos],
  );

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setImporting(true);
    setError(null);
    setResult(null);

    let saved = 0;

    try {
      // Recheck roll numbers against Firestore before importing.
      const latestRollNos = new Set(existingRollNos);

      const rollNumbers = plan.students.map((student) => student.roll_no);

      for (let start = 0; start < rollNumbers.length; start += 30) {
        const rollChunk = rollNumbers.slice(start, start + 30);

        const existingQuery = query(
          collection(db, 'students'),
          where('roll_no', 'in', rollChunk),
        );

        const snapshot = await getDocs(existingQuery);

        snapshot.forEach((studentDoc) => {
          const rollNo = studentDoc.data().roll_no;
          if (typeof rollNo === 'string') {
            latestRollNos.add(rollNo.toUpperCase());
          }
        });
      }

      const studentsToSave = plan.students.filter(
        (student) => !latestRollNos.has(student.roll_no),
      );

      const newlyFoundDuplicates = plan.students.length - studentsToSave.length;

      for (
        let start = 0;
        start < studentsToSave.length;
        start += CHUNK_SIZE
      ) {
        const chunk = studentsToSave.slice(start, start + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((student) => {
          const studentRef = doc(collection(db, 'students'));
          batch.set(studentRef, student);
        });

        await batch.commit();
        saved += chunk.length;
      }

      onImported();
      setResult(
        `Added ${saved} students. Skipped ${plan.duplicates + newlyFoundDuplicates} duplicates and ${plan.invalid} invalid lines.`,
      );
      setText('');
    } catch (err) {
      console.error('Student import error:', err);
      setError(
        `Saved ${saved} students before the import stopped. Please check your connection and try again.`,
      );

      if (saved > 0) onImported();
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal title="Import students" onClose={onClose}>
      <form onSubmit={handleImport} className="space-y-5">
        <div>
          <label htmlFor="import-text" className={labelClass}>
            Paste from your spreadsheet
          </label>

          <textarea
            id="import-text"
            rows={10}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={'21CS001\tAsha Verma\tComputer Science\n21CS002\tRahul Singh\tComputer Science'}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          />

          <p className="mt-2 text-xs text-slate-500">
            One student per line: roll number, name, and optional department.
            Columns can be separated by tabs or commas.
          </p>
        </div>

        {text.trim() && (
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">
                {plan.students.length}
              </span>{' '}
              new students ready to add
            </p>

            {plan.duplicates > 0 && (
              <p>{plan.duplicates} already in the list, skipped</p>
            )}

            {plan.invalid > 0 && (
              <p>
                {plan.invalid} lines missing a roll number or name, skipped
              </p>
            )}
          </div>
        )}

        {error && <p className={errorBoxClass}>{error}</p>}
        {result && <p className={successBoxClass}>{result}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className={secondaryButtonClass}
          >
            Close
          </button>

          <button
            type="submit"
            disabled={importing || plan.students.length === 0}
            className={primaryButtonClass}
          >
            {importing ? 'Importing...' : `Import ${plan.students.length} students`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
