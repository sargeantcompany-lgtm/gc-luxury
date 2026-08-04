import React, { useState, useRef, useEffect } from 'react';
import { GOLD_COAST_SUBURBS } from '../data/goldCoastSuburbs';

const MAX_SUBURBS = 3;

export default function SuburbPicker({ id, name, value, onChange }) {
  const selected = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const filtered = query
    ? GOLD_COAST_SUBURBS.filter(
        (s) => s.toLowerCase().includes(query.toLowerCase()) && !selected.includes(s)
      ).slice(0, 8)
    : GOLD_COAST_SUBURBS.filter((s) => !selected.includes(s)).slice(0, 8);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const commit = (next) => {
    onChange({ target: { name, value: next.join(', ') } });
  };

  const addSuburb = (suburb) => {
    if (selected.length >= MAX_SUBURBS || selected.includes(suburb)) return;
    commit([...selected, suburb]);
    setQuery('');
    setOpen(false);
  };

  const removeSuburb = (suburb) => {
    commit(selected.filter((s) => s !== suburb));
  };

  return (
    <div className="suburb-picker" ref={containerRef}>
      {selected.length > 0 && (
        <div className="suburb-chips">
          {selected.map((s) => (
            <span key={s} className="suburb-chip">
              {s}
              <button type="button" onClick={() => removeSuburb(s)}>&times;</button>
            </span>
          ))}
        </div>
      )}
      {selected.length < MAX_SUBURBS && (
        <input
          id={id}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? 'Search Gold Coast suburbs…' : `Add another (${MAX_SUBURBS - selected.length} left)…`}
          autoComplete="off"
        />
      )}
      {open && filtered.length > 0 && (
        <div className="suburb-dropdown">
          {filtered.map((s) => (
            <div key={s} className="suburb-option" onClick={() => addSuburb(s)}>{s}</div>
          ))}
        </div>
      )}
    </div>
  );
}
