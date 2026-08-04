import React from 'react';

export default function ListingCard({ listing, saved, onToggleSave }) {
  const photo = Array.isArray(listing.photos) && listing.photos.length ? listing.photos[0] : null;

  return (
    <div className="listing-card">
      {photo && <img className="listing-photo" src={photo} alt={listing.address} />}
      <div className="listing-body">
        <div className="listing-address">{listing.address}</div>
        {listing.price_guide && <div className="listing-price">{listing.price_guide}</div>}
        {listing.description && <div className="listing-desc">{listing.description}</div>}
        {listing.note && <div className="listing-desc">Note: {listing.note}</div>}
        <div className="listing-actions">
          <button
            className={`save-btn ${saved ? 'saved' : ''}`}
            onClick={() => onToggleSave(listing.id, saved)}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
