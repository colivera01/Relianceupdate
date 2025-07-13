import { useState } from 'react';
import { Button } from '@/components/ui/button';
import TimePicker from 'react-time-picker';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const defaultAvailability = daysOfWeek.map(day => ({ day, enabled: false, start: '09:00', end: '17:00' }));

export function VendorAvailabilityPanel({ onClose }: { onClose?: () => void }) {
  const [availability, setAvailability] = useState(defaultAvailability);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleToggle = idx => {
    setAvailability(avail => avail.map((a, i) => i === idx ? { ...a, enabled: !a.enabled } : a));
  };
  const handleTimeChange = (idx, field, value) => {
    setAvailability(avail => avail.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };
  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    }, 800);
  };
  const handleCancel = () => {
    setAvailability(defaultAvailability);
    if (onClose) onClose();
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 bg-white rounded shadow border">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Schedule Availability</h1>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">✕</button>
        )}
      </div>
      <div className="mb-4 text-gray-700">Set your weekly working hours. Customers can only book you during these times. You can update your schedule at any time.</div>
      <div className="mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left p-2">Day</th>
              <th className="text-left p-2">Available</th>
              <th className="text-left p-2">Start</th>
              <th className="text-left p-2">End</th>
            </tr>
          </thead>
          <tbody>
            {availability.map((a, idx) => (
              <tr key={a.day} className="border-t">
                <td className="p-2 font-medium">{a.day}</td>
                <td className="p-2">
                  <input type="checkbox" checked={a.enabled} onChange={() => handleToggle(idx)} />
                </td>
                <td className="p-2">
                  <TimePicker
                    onChange={value => handleTimeChange(idx, 'start', value)}
                    value={a.start}
                    disableClock={false}
                    format="hh:mm a"
                    clearIcon={null}
                    clockIcon={null}
                    disabled={!a.enabled}
                    className="w-28"
                  />
                </td>
                <td className="p-2">
                  <TimePicker
                    onChange={value => handleTimeChange(idx, 'end', value)}
                    value={a.end}
                    disableClock={false}
                    format="hh:mm a"
                    clearIcon={null}
                    clockIcon={null}
                    disabled={!a.enabled}
                    className="w-28"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-4 mt-6">
          <Button onClick={handleSave} disabled={saving} variant="default">{saving ? 'Saving...' : 'Save'}</Button>
          <Button onClick={handleCancel} variant="ghost">Cancel</Button>
          {success && <span className="text-green-700 font-semibold ml-4">Saved!</span>}
        </div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm">
        <div className="font-semibold mb-1">Current Availability Summary:</div>
        <ul className="list-disc pl-5">
          {availability.filter(a => a.enabled).length === 0 ? (
            <li>No days set as available.</li>
          ) : (
            availability.filter(a => a.enabled).map(a => (
              <li key={a.day}>{a.day}: {a.start} – {a.end}</li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
} 