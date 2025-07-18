
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  session_type TEXT NOT NULL,
  client_name TEXT NOT NULL,
  date_time TIMESTAMP NOT NULL,
  location TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  duration INTEGER NOT NULL,
  notes TEXT,
  contract_signed BOOLEAN DEFAULT false NOT NULL,
  paid BOOLEAN DEFAULT false NOT NULL,
  edited BOOLEAN DEFAULT false NOT NULL,
  delivered BOOLEAN DEFAULT false NOT NULL,
  reminder_enabled BOOLEAN DEFAULT false NOT NULL,
  gallery_ready_notified BOOLEAN DEFAULT false NOT NULL,
  reminder_sent BOOLEAN DEFAULT false NOT NULL,
  created_by TEXT REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_created_by ON sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_sessions_date_time ON sessions(date_time);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
