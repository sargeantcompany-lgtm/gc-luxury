import React, { useEffect, useState } from 'react';
import { adamLogin, getAdminKey } from '../services/api';

// Adam's Ray White tools (appraisals, offers, off-market, client logins) live
// in /adam/admin. They're shown here in a frame so everything is under the
// one CRM login; ?embed=1 hides that page's own header and tabs.
const TABS = {
  appraisals: { title: 'Appraisals', tab: 'appraisals' },
  offers: { title: 'Offers', tab: 'offers' },
  offmarket: { title: 'Off-Market', tab: 'offmarket' },
  clients: { title: 'Client Logins', tab: 'clients' },
};

export default function RayWhite({ page }) {
  const { title, tab } = TABS[page];
  const [ready, setReady] = useState(false);

  // The CRM and Ray White logins share one password, so sign into the Ray
  // White side with it before showing the frame (its own cookie may have
  // expired while the CRM stayed unlocked).
  useEffect(() => {
    let live = true;
    adamLogin(getAdminKey()).finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {page === 'appraisals' && (
            <a className="btn btn-primary btn-sm" href="/adam/appraisal-tool.html" target="_blank" rel="noopener">+ New Appraisal</a>
          )}
          <a className="btn btn-secondary btn-sm" href={`/adam/admin`} target="_blank" rel="noopener">Open full page ↗</a>
        </div>
      </div>
      {ready ? (
        <iframe key={tab} className="rw-frame" title={title} src={`/adam/admin?embed=1&tab=${tab}`} />
      ) : (
        <div className="page-content"><div className="text-muted" style={{ textAlign: 'center', padding: 40 }}>Loading...</div></div>
      )}
    </div>
  );
}
