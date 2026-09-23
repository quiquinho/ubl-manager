-- SQL migration for UBL manager
-- Assumes MySQL/MariaDB

CREATE DATABASE IF NOT EXISTS cynthia_app;
USE cynthia_app;

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  login VARCHAR(100) NOT NULL UNIQUE,
  nombre VARCHAR(100),
  apellidos VARCHAR(200),
  role_id INT NOT NULL,
  password_base64 TEXT,
  password_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Menu/page table
CREATE TABLE IF NOT EXISTS menu_page (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  path VARCHAR(200),
  parent_id INT DEFAULT NULL
);

-- Mapping table between roles and menu pages
CREATE TABLE IF NOT EXISTS role_menu (
  role_id INT NOT NULL,
  menu_id INT NOT NULL,
  PRIMARY KEY (role_id, menu_id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (menu_id) REFERENCES menu_page(id)
);

-- Seed roles (using requested ids)
INSERT IGNORE INTO roles (id, name) VALUES
(100, 'admin'),
(20, 'entrenador'),
(10, 'delegado'),
(40, 'oficina');

-- Seed some menu pages
INSERT IGNORE INTO menu_page (id, title, path, parent_id) VALUES
(1, 'Administrar', '/administrar', NULL),
(2, 'Equipos', '/equipos', NULL),
  (3, 'Usuarios', '/administrar/usuarios', 1),
  (6, 'Jugadores', '/jugadores', NULL),
  (8, 'Partido', '/partido', NULL);

-- Submenus for Equipos (configurable)
INSERT IGNORE INTO menu_page (id, title, path, parent_id) VALUES
  (4, 'Gestionar', '/equipos/gestionar', 2),
  (5, 'Estadisticas', '/equipos/estadisticas', 2),
  (7, 'Gestionar', '/jugadores/gestionar', 6),
  (9, 'Programar', '/partido/programar', 8),
  (10, 'Estadisticas', '/partido/estadisticas', 8),
  (11, 'Seguimiento', '/partido/seguimiento', 8);

-- Assign menu pages to roles
INSERT IGNORE INTO role_menu (role_id, menu_id) VALUES
(100,1),
(100,2),
(100,3),
(100,6),
(100,8),
(20,2),
 (20,8),
 (40,2),
 (40,8),
 (10,8);

-- Grant access to Equipos submenus to roles that see Equipos
INSERT IGNORE INTO role_menu (role_id, menu_id) VALUES
  (100,4),
  (100,5),
  (100,7),
  (100,9),
  (100,10),
  (20,4),
  (20,5),
  (40,4),
  (20,7),
  (40,7),
  (20,9),
  (20,10),
  (40,9),
  (40,10),
  (100,11),
  (20,11),
  (40,11),
  (10,9),
  (10,10),
  (10,11);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  gender VARCHAR(20),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Teams from outside the club that can visit for a match.
CREATE TABLE IF NOT EXISTS visitors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pavilions available as match venues.
CREATE TABLE IF NOT EXISTS venues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  location VARCHAR(400) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled matches.
CREATE TABLE IF NOT EXISTS matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  home_team_id INT NOT NULL,
  visitor_id INT NOT NULL,
  venue_id INT NOT NULL,
  scheduled_at DATETIME NOT NULL,
  advance_minutes INT NOT NULL DEFAULT 30,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (home_team_id) REFERENCES teams(id),
  FOREIGN KEY (visitor_id) REFERENCES visitors(id),
  FOREIGN KEY (venue_id) REFERENCES venues(id)
);

-- Seed initial teams (Infantil Masc/Fem)
INSERT IGNORE INTO teams (id, name, category, gender) VALUES
  (1, 'Infantil Masc', 'Infantil', 'M'),
  (2, 'Infantil Masc B', 'Infantil', 'M'),
  (3, 'Infantil Fem', 'Infantil', 'F'),
  (4, 'Infantil Fem B', 'Infantil', 'F');

-- Players table (belongs to a team)
CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  apellidos VARCHAR(200),
  posicion VARCHAR(100),
  numero INT,
  photo_url VARCHAR(400),
  photo_blob MEDIUMBLOB,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- A player can belong to multiple teams.
CREATE TABLE IF NOT EXISTS player_teams (
  player_id INT NOT NULL,
  team_id INT NOT NULL,
  PRIMARY KEY (player_id, team_id),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

INSERT IGNORE INTO player_teams (player_id, team_id)
SELECT id, team_id FROM players WHERE team_id IS NOT NULL;

-- Players called up for each match.
CREATE TABLE IF NOT EXISTS match_players (
  match_id INT NOT NULL,
  player_id INT NOT NULL,
  PRIMARY KEY (match_id, player_id),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_tracking (
  match_id INT PRIMARY KEY,
  home_score INT NOT NULL DEFAULT 0,
  visitor_score INT NOT NULL DEFAULT 0,
  period VARCHAR(30) NOT NULL DEFAULT 'Primera parte',
  match_status VARCHAR(30) NOT NULL DEFAULT 'No iniciado',
  elapsed_seconds INT NOT NULL DEFAULT 0,
  timer_started_at DATETIME NULL,
  notes TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_player_stats (
  match_id INT NOT NULL,
  player_id INT NOT NULL,
  on_court TINYINT(1) NOT NULL DEFAULT 0,
  time_on_court_seconds INT NOT NULL DEFAULT 0,
  court_started_at DATETIME NULL,
  goals INT NOT NULL DEFAULT 0,
  shots INT NOT NULL DEFAULT 0,
  assists INT NOT NULL DEFAULT 0,
  turnovers INT NOT NULL DEFAULT 0,
  steals INT NOT NULL DEFAULT 0,
  saves INT NOT NULL DEFAULT 0,
  goals_conceded INT NOT NULL DEFAULT 0,
  blocks INT NOT NULL DEFAULT 0,
  exclusions_2min INT NOT NULL DEFAULT 0,
  yellow_cards INT NOT NULL DEFAULT 0,
  red_cards INT NOT NULL DEFAULT 0,
  blue_cards INT NOT NULL DEFAULT 0,
  seven_meters_scored INT NOT NULL DEFAULT 0,
  seven_meters_attempted INT NOT NULL DEFAULT 0,
  seven_meters_received INT NOT NULL DEFAULT 0,
  seven_meters_saved INT NOT NULL DEFAULT 0,
  fouls INT NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id, player_id),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_shot_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  player_id INT NOT NULL,
  event_type VARCHAR(10) NOT NULL,
  zone VARCHAR(20) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_stat_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  player_id INT NOT NULL,
  stat_key VARCHAR(50) NOT NULL,
  amount INT NOT NULL DEFAULT 1,
  minute INT NOT NULL DEFAULT 1,
  zone VARCHAR(20),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Example user (password 'secret' base64 -> c2VjcmV0)
INSERT IGNORE INTO users (login, nombre, apellidos, role_id, password_base64) VALUES
('admin','Admin','User',100, TO_BASE64('secret'));
