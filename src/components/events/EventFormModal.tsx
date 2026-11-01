import { useState, type FormEvent } from 'react';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import type { EventItem } from '@/lib/types';
import { errorBoxClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '@/lib/ui';

interface EventFormModalProps {
  event: EventItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EventFormModal({ event, onClose, onSaved }: EventFormModalProps) {
  const [name, setName] = useState(event?.name ?? '');
  const [eventDate, setEventDate] = useState(event?.event_date ?? '');
  const [points, setPoints] = useState(event ? String(event.points) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    const payload = {
      name: name.trim(),
      event_date: eventDate || null,
      points: Number(points),
    };

    setSaving(true);
    setError(null);
    const result = event
      ? await supabase.from('events').update(payload).eq('id', event.id).select('id')
      : await supabase.from('events').insert(payload).select('id');
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (!result.data?.length) {
      setError('This event is already published, so it can no longer be changed.');
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal title={event ? 'Edit event' : 'New event'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="event-name" className={labelClass}>Event name</label>
          <input
            id="event-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Blood Donation Camp"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="event-date" className={labelClass}>Date</label>
            <input
              id="event-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="event-points" className={labelClass}>Points for attendance</label>
            <input
              id="event-points"
              type="number"
              required
              min={0}
              step={1}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className={inputClass}
              placeholder="e.g. 10"
            />
          </div>
        </div>

        {error && <p className={errorBoxClass}>{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? 'Saving...' : 'Save event'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
