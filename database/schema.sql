-- ============================================
-- Outreach HQ CRM - PostgreSQL Schema
-- ============================================

CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#2563eb',
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    first_name VARCHAR(100) DEFAULT '',
    last_name VARCHAR(100) DEFAULT '',
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    zip VARCHAR(20),
    pipeline_stage VARCHAR(50) DEFAULT 'New',
    source VARCHAR(100),
    do_not_contact BOOLEAN DEFAULT FALSE,
    dnc_reason TEXT,
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_notes (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_by VARCHAR(100) DEFAULT 'Admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('email', 'sms')),
    subject VARCHAR(500),
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('email', 'sms')),
    subject VARCHAR(500),
    body TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    filters JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS campaign_contacts (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    UNIQUE(campaign_id, contact_id)
);

CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS smtp_settings (
    id SERIAL PRIMARY KEY,
    brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE UNIQUE,
    host VARCHAR(255) NOT NULL,
    port INTEGER DEFAULT 587,
    secure BOOLEAN DEFAULT FALSE,
    username VARCHAR(255) NOT NULL,
    password_encrypted VARCHAR(500) NOT NULL,
    from_name VARCHAR(200),
    from_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_contacts_brand ON contacts(brand_id);
CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_dnc ON contacts(do_not_contact);
CREATE INDEX IF NOT EXISTS idx_activity_contact ON activity_log(contact_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand ON campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);

-- Default brands
INSERT INTO brands (name, color) VALUES ('Real Estate', '#2563eb') ON CONFLICT (name) DO NOTHING;
INSERT INTO brands (name, color) VALUES ('Houzeey', '#10b981') ON CONFLICT (name) DO NOTHING;
INSERT INTO brands (name, color) VALUES ('Gold Coast Luxury', '#c9a24b') ON CONFLICT (name) DO NOTHING;

-- Default email templates
INSERT INTO templates (brand_id, name, type, subject, body) VALUES
(1, 'Welcome Email', 'email', 'Welcome to {{brand_name}}!',
'Hi {{first_name}},

Thank you for your interest in {{brand_name}}. We''re excited to connect with you about properties in {{city}}.

Feel free to reach out anytime — we''re here to help.

Best regards,
{{brand_name}} Team'),

(1, 'Follow Up', 'email', 'Following up — {{brand_name}}',
'Hi {{first_name}},

I wanted to follow up on your recent inquiry. Are you still looking for properties in {{city}}, {{state}}?

We have some great options that might interest you. Let''s connect!

Best,
{{brand_name}} Team'),

(1, 'Meeting Confirmation', 'email', 'Meeting Confirmed — {{brand_name}}',
'Hi {{first_name}},

Your meeting with {{brand_name}} has been confirmed. We look forward to speaking with you.

If you need to reschedule, please don''t hesitate to reach out.

See you soon!
{{brand_name}} Team'),

(1, 'Welcome SMS', 'sms', NULL,
'Hi {{first_name}}, this is {{brand_name}}. Thanks for your interest! We''ll be in touch soon. Reply STOP to opt out.'),

(2, 'Houzeey Welcome', 'email', 'Welcome to Houzeey!',
'Hi {{first_name}},

Welcome to Houzeey! We''re dedicated to helping you find your perfect home.

Our team is ready to guide you through every step of the process.

The Houzeey Team'),

(2, 'Houzeey Follow Up', 'sms', NULL,
'Hi {{first_name}}, this is Houzeey. We''d love to help you find your dream home. Reply STOP to opt out.')
ON CONFLICT DO NOTHING;

-- ============================================
-- The Connector - buyer portal
-- ============================================

CREATE TABLE IF NOT EXISTS buyers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255) NOT NULL UNIQUE,
    joined_via VARCHAR(100),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buyer_sessions (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    token VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS buyer_briefs (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE UNIQUE,
    property_type VARCHAR(100),
    price_min BIGINT,
    price_max BIGINT,
    areas TEXT,
    must_haves TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listings (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('off_market', 'connector_match')),
    source_url TEXT,
    address VARCHAR(500) NOT NULL,
    price_guide VARCHAR(100),
    description TEXT,
    photos JSONB DEFAULT '[]',
    added_by_admin VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS top_five (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE UNIQUE,
    pinned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    pinned_by VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS saved_listings (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(buyer_id, listing_id)
);

CREATE TABLE IF NOT EXISTS connector_matches (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    note TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS valuation_requests (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'fulfilled')),
    report_url TEXT,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fulfilled_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS agent_contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    agency VARCHAR(200),
    phone VARCHAR(50),
    email VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_buyer_sessions_token ON buyer_sessions(token);
CREATE INDEX IF NOT EXISTS idx_buyer_sessions_buyer ON buyer_sessions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(type);
CREATE INDEX IF NOT EXISTS idx_saved_listings_buyer ON saved_listings(buyer_id);
CREATE INDEX IF NOT EXISTS idx_connector_matches_buyer ON connector_matches(buyer_id);
CREATE INDEX IF NOT EXISTS idx_valuation_requests_status ON valuation_requests(status);
