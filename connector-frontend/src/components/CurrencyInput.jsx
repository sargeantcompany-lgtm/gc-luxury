import React from 'react';

function formatWithCommas(digits) {
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
}

export default function CurrencyInput({ id, name, value, onChange, placeholder }) {
  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    onChange({ target: { name, value: raw } });
  };

  return (
    <div className="currency-input">
      <span className="currency-prefix">$</span>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        value={formatWithCommas(value)}
        onChange={handleChange}
        placeholder={placeholder}
      />
    </div>
  );
}
