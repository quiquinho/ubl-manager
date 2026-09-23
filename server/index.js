const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const DB_HOST = process.env.DB_HOST || '192.168.1.61';
const DB_USER = process.env.DB_USER || 'cynthia_user';
const DB_PASS = process.env.DB_PASS || '';
const DB_NAME = process.env.DB_NAME || 'cynthia_app';
const DB_PORT = process.env.DB_PORT || 3306;

let pool;
async function initDb() {
	pool = mysql.createPool({
		host: DB_HOST,
		user: DB_USER,
		password: DB_PASS,
		database: DB_NAME,
		port: DB_PORT,
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0
	});
	await pool.query("INSERT IGNORE INTO menu_page (id, title, path, parent_id) VALUES (11, 'Seguimiento', '/partido/seguimiento', 8)");
	await pool.query('INSERT IGNORE INTO role_menu (role_id, menu_id) VALUES (100, 11), (20, 11), (40, 11), (10, 11)');
	await pool.query(`CREATE TABLE IF NOT EXISTS match_tracking (
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
	)`);
	await pool.query(`CREATE TABLE IF NOT EXISTS match_player_stats (
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
	)`);
	await pool.query(`CREATE TABLE IF NOT EXISTS match_shot_events (
		id INT AUTO_INCREMENT PRIMARY KEY,
		match_id INT NOT NULL,
		player_id INT NOT NULL,
		event_type VARCHAR(10) NOT NULL,
		zone VARCHAR(20) NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
		FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
	)`);
	await pool.query(`CREATE TABLE IF NOT EXISTS match_stat_events (
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
	)`);
	for (const query of [
		'ALTER TABLE match_tracking ADD COLUMN elapsed_seconds INT NOT NULL DEFAULT 0',
		'ALTER TABLE match_tracking ADD COLUMN timer_started_at DATETIME NULL',
		'ALTER TABLE match_player_stats ADD COLUMN time_on_court_seconds INT NOT NULL DEFAULT 0',
		'ALTER TABLE match_player_stats ADD COLUMN court_started_at DATETIME NULL',
		'ALTER TABLE match_player_stats ADD COLUMN seven_meters_received INT NOT NULL DEFAULT 0',
		'ALTER TABLE match_player_stats ADD COLUMN seven_meters_saved INT NOT NULL DEFAULT 0',
		'ALTER TABLE match_stat_events ADD COLUMN period VARCHAR(30) NOT NULL DEFAULT \'1/2\''
	]) {
		try { await pool.query(query) } catch (err) { if (err.code !== 'ER_DUP_FIELDNAME') throw err }
	}
}

app.get('/api/menu', async (req, res) => {
	const roleId = parseInt(req.query.roleId || '100', 10);
	try {
		const [rows] = await pool.query(
			`SELECT mp.id, mp.title, mp.path, mp.parent_id
			 FROM menu_page mp
			 JOIN role_menu rm ON mp.id = rm.menu_id
			 WHERE rm.role_id = ?
			 ORDER BY mp.id`,
			[roleId]
		);
		res.json(rows);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'DB error' });
	}
});

app.get('/api/users/:login', async (req, res) => {
	const login = req.params.login;
	try {
		const [rows] = await pool.query('SELECT id, login, nombre, apellidos, role_id, password_base64, password_changed_at FROM users WHERE login = ?', [login]);
		if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
		res.json(rows[0]);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'DB error' });
	}
});

// List users
app.get('/api/users', async (req, res) => {
	try {
		const [rows] = await pool.query('SELECT id, login, nombre, apellidos, role_id, password_changed_at FROM users ORDER BY id DESC');
		res.json(rows);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'DB error' });
	}
});

// Create user
app.post('/api/users', async (req, res) => {
	const { login, nombre, apellidos, role_id, password } = req.body || {};
	if (!login || !role_id || !password) return res.status(400).json({ error: 'login, role_id y password son obligatorios' });
	try {
		const pwBase64 = Buffer.from(password).toString('base64');
		const [result] = await pool.query('INSERT INTO users (login, nombre, apellidos, role_id, password_base64) VALUES (?, ?, ?, ?, ?)', [login, nombre || null, apellidos || null, role_id, pwBase64]);
		const [rows] = await pool.query('SELECT id, login, nombre, apellidos, role_id, password_changed_at FROM users WHERE id = ?', [result.insertId]);
		res.status(201).json(rows[0]);
	} catch (err) {
		console.error(err);
		if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'login ya existe' });
		res.status(500).json({ error: 'DB error' });
	}
});

// Update user
app.put('/api/users/:id', async (req, res) => {
	const id = Number(req.params.id);
	const { nombre, apellidos, role_id, password } = req.body || {};
	if (!id) return res.status(400).json({ error: 'id inválido' });
	try {
		if (password) {
			const pwBase64 = Buffer.from(password).toString('base64');
			await pool.query('UPDATE users SET nombre = ?, apellidos = ?, role_id = ?, password_base64 = ?, password_changed_at = NOW() WHERE id = ?', [nombre || null, apellidos || null, role_id, pwBase64, id]);
		} else {
			await pool.query('UPDATE users SET nombre = ?, apellidos = ?, role_id = ? WHERE id = ?', [nombre || null, apellidos || null, role_id, id]);
		}
		const [rows] = await pool.query('SELECT id, login, nombre, apellidos, role_id, password_changed_at FROM users WHERE id = ?', [id]);
		res.json(rows[0]);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'DB error' });
	}
});

app.get('/api/roles', async (req, res) => {
	try {
		const [rows] = await pool.query('SELECT id, name FROM roles ORDER BY id');
		res.json(rows);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'DB error' });
	}
});

app.post('/api/login', async (req, res) => {
	const { login, password } = req.body || {};
	if (!login || !password) return res.status(400).json({ error: 'login and password required' });
	try {
		const [rows] = await pool.query('SELECT id, login, nombre, apellidos, role_id, password_base64, password_changed_at FROM users WHERE login = ?', [login]);
		if (rows.length === 0) return res.status(401).json({ error: 'invalid credentials' });
		const user = rows[0];
		const pwBase64 = Buffer.from(password).toString('base64');
		if (user.password_base64 !== pwBase64) return res.status(401).json({ error: 'invalid credentials' });
		// Do not send password back
		delete user.password_base64;
		res.json({ user });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'DB error' });
	}
});

// Teams endpoints
app.get('/api/teams', async (req, res) => {
	try {
		const [rows] = await pool.query('SELECT t.id, t.name, t.category, t.gender, t.created_at, COUNT(DISTINCT pt.player_id) AS player_count FROM teams t LEFT JOIN player_teams pt ON pt.team_id = t.id GROUP BY t.id, t.name, t.category, t.gender, t.created_at ORDER BY t.id');
		res.json(rows);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'DB error' });
	}
});

app.get('/api/players', async (req, res) => {
	try {
		const [players] = await pool.query('SELECT id, nombre, apellidos, posicion, numero, photo_url, photo_blob, created_at FROM players ORDER BY apellidos, nombre, id');
		const [teams] = await pool.query('SELECT pt.player_id, t.id, t.name, t.category, t.gender FROM player_teams pt JOIN teams t ON t.id = pt.team_id ORDER BY t.name');
		const teamsByPlayer = teams.reduce((result, team) => {
			result[team.player_id] = result[team.player_id] || [];
			result[team.player_id].push({ id: team.id, name: team.name, category: team.category, gender: team.gender });
			return result;
		}, {});
		players.forEach(player => {
			player.teams = teamsByPlayer[player.id] || [];
			if (player.photo_blob) player.photo_data = `data:image/jpeg;base64,${player.photo_blob.toString('base64')}`;
			delete player.photo_blob;
		});
		res.json(players);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'DB error' });
	}
});

app.post('/api/players', async (req, res) => {
	const { nombre, apellidos, posicion, numero, photo_url, photo_data, team_ids = [] } = req.body || {};
	const teamIds = [...new Set(team_ids.map(Number).filter(Boolean))];
	if (!nombre) return res.status(400).json({ error: 'nombre is required' });
	if (!teamIds.length) return res.status(400).json({ error: 'Selecciona al menos un equipo' });
	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();
		const photoBuffer = photo_data ? dataUrlToBuffer(photo_data) : null;
		const [result] = await connection.query('INSERT INTO players (team_id, nombre, apellidos, posicion, numero, photo_url, photo_blob) VALUES (?, ?, ?, ?, ?, ?, ?)', [teamIds[0], nombre, apellidos || null, posicion || null, numero || null, photo_url || null, photoBuffer]);
		await connection.query('INSERT INTO player_teams (player_id, team_id) VALUES ?', [teamIds.map(teamId => [result.insertId, teamId])]);
		await connection.commit();
		res.status(201).json({ id: result.insertId });
	} catch (err) {
		await connection.rollback();
		console.error(err);
		res.status(500).json({ error: err.message || 'DB error' });
	} finally {
		connection.release();
	}
});

app.post('/api/teams', async (req, res) => {
	const { name, category, gender } = req.body || {};
	if (!name) return res.status(400).json({ error: 'name is required' });
	try {
		const [result] = await pool.query('INSERT INTO teams (name, category, gender) VALUES (?, ?, ?)', [name, category || null, gender || null]);
		const [rows] = await pool.query('SELECT id, name, category, gender, created_at FROM teams WHERE id = ?', [result.insertId]);
		res.status(201).json(rows[0]);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'DB error' });
	}
});

app.put('/api/teams/:id', async (req, res) => {
	const { name, category, gender } = req.body || {};
	if (!name) return res.status(400).json({ error: 'name is required' });
	try {
		await pool.query('UPDATE teams SET name = ?, category = ?, gender = ? WHERE id = ?', [name, category || null, gender || null, req.params.id]);
		const [rows] = await pool.query('SELECT id, name, category, gender, created_at FROM teams WHERE id = ?', [req.params.id]);
		if (!rows.length) return res.status(404).json({ error: 'Team not found' });
		res.json(rows[0]);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'DB error' });
	}
});

app.get('/api/visitors', async (req, res) => {
	try {
		const [rows] = await pool.query('SELECT id, name, created_at FROM visitors ORDER BY name');
		res.json(rows);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'DB error' });
	}
});

app.post('/api/visitors', async (req, res) => {
	const name = String(req.body?.name || '').trim();
	if (!name) return res.status(400).json({ error: 'El nombre del visitante es obligatorio' });
	try {
		const [result] = await pool.query('INSERT INTO visitors (name) VALUES (?)', [name]);
		const [rows] = await pool.query('SELECT id, name, created_at FROM visitors WHERE id = ?', [result.insertId]);
		res.status(201).json(rows[0]);
	} catch (err) {
		console.error(err);
		if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese visitante ya existe' });
		res.status(500).json({ error: 'DB error' });
	}
});

app.get('/api/venues', async (req, res) => {
	try {
		const [rows] = await pool.query('SELECT id, name, location, created_at FROM venues ORDER BY name');
		res.json(rows);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'DB error' });
	}
});

app.post('/api/venues', async (req, res) => {
	const name = String(req.body?.name || '').trim();
	const rawLocation = String(req.body?.location || '').trim();
	const location = /^https?:\/\//i.test(rawLocation) ? rawLocation : `https://${rawLocation}`;
	if (!name || !location) return res.status(400).json({ error: 'El nombre y la ubicación del pabellón son obligatorios' });
	try {
		const locationUrl = new URL(location);
		if (!['http:', 'https:'].includes(locationUrl.protocol)) throw new Error('invalid protocol');
	} catch {
		return res.status(400).json({ error: 'La ubicación debe ser un enlace válido de Google Maps' });
	}
	try {
		const [result] = await pool.query('INSERT INTO venues (name, location) VALUES (?, ?)', [name, location]);
		const [rows] = await pool.query('SELECT id, name, location, created_at FROM venues WHERE id = ?', [result.insertId]);
		res.status(201).json(rows[0]);
	} catch (err) {
		console.error(err);
		if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese pabellón ya existe' });
		res.status(500).json({ error: 'DB error' });
	}
});

function getMatchDuration(category) {
	const normalizedCategory = String(category || '').toLocaleLowerCase('es')
	if (normalizedCategory.includes('benjamin') || normalizedCategory.includes('benjamín') || normalizedCategory.includes('alevin') || normalizedCategory.includes('alevín')) return { periods: 4, periodFormat: '1/4', minutes: 10, label: '4 x 10 minutos' }
	if (normalizedCategory.includes('infantil')) return { periods: 2, periodFormat: '1/2', minutes: 25, label: '2 x 25 minutos' }
	return { periods: 2, periodFormat: '1/2', minutes: 30, label: '2 x 30 minutos' }
}

function normaliseNonNegativeInteger(value) {
	const number = Number(value)
	return Number.isInteger(number) && number >= 0 ? number : 0
}

function secondsSince(value) {
	if (!value) return 0
	return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
}

function liveElapsedSeconds(tracking) {
	return Number(tracking?.elapsed_seconds || 0) + (tracking?.match_status === 'En juego' ? secondsSince(tracking.timer_started_at) : 0)
}

app.get('/api/matches/:matchId/follow-up', async (req, res) => {
	const matchId = Number(req.params.matchId)
	if (!matchId) return res.status(400).json({ error: 'Partido no válido' })
	try {
		const [matches] = await pool.query(`SELECT m.id, m.scheduled_at, t.name AS home_team_name, t.category AS home_team_category, v.name AS visitor_name, n.name AS venue_name
			FROM matches m JOIN teams t ON t.id = m.home_team_id JOIN visitors v ON v.id = m.visitor_id JOIN venues n ON n.id = m.venue_id WHERE m.id = ?`, [matchId])
		if (!matches.length) return res.status(404).json({ error: 'El partido no existe' })
		await pool.query('INSERT IGNORE INTO match_tracking (match_id) VALUES (?)', [matchId])
		await pool.query('INSERT IGNORE INTO match_player_stats (match_id, player_id) SELECT match_id, player_id FROM match_players WHERE match_id = ?', [matchId])
		const [tracking] = await pool.query('SELECT home_score, visitor_score, period, match_status, elapsed_seconds, timer_started_at, notes FROM match_tracking WHERE match_id = ?', [matchId])
		if (tracking[0]?.match_status === 'No iniciado') {
			await pool.query('DELETE FROM match_stat_events WHERE match_id = ?', [matchId])
			await pool.query('DELETE FROM match_shot_events WHERE match_id = ?', [matchId])
			await pool.query('DELETE FROM match_player_stats WHERE match_id = ?', [matchId])
			await pool.query('INSERT IGNORE INTO match_player_stats (match_id, player_id) SELECT match_id, player_id FROM match_players WHERE match_id = ?', [matchId])
			await pool.query('UPDATE match_tracking SET home_score = 0, visitor_score = 0, elapsed_seconds = 0, timer_started_at = NULL WHERE match_id = ?', [matchId])
			tracking[0].home_score = 0
			tracking[0].visitor_score = 0
			tracking[0].elapsed_seconds = 0
		}
		else await pool.query('UPDATE match_tracking SET home_score = (SELECT COALESCE(SUM(goals), 0) FROM match_player_stats WHERE match_id = ?), visitor_score = (SELECT COALESCE(SUM(goals_conceded), 0) FROM match_player_stats WHERE match_id = ?) WHERE match_id = ?', [matchId, matchId, matchId])
		const duration = getMatchDuration(matches[0].home_team_category)
		const liveSeconds = liveElapsedSeconds(tracking[0])
		const trackingData = { ...tracking[0], elapsed_seconds: liveSeconds }
		if (tracking[0].match_status === 'En juego' && liveSeconds >= duration.minutes * 60) {
			const endStatus = tracking[0].period === `${duration.periods}/${duration.periods}` ? 'Finalizado' : 'Descanso'
			await pool.query('UPDATE match_player_stats SET time_on_court_seconds = time_on_court_seconds + IF(court_started_at IS NULL, 0, TIMESTAMPDIFF(SECOND, court_started_at, NOW())), court_started_at = NULL WHERE match_id = ? AND on_court = 1', [matchId])
			await pool.query('UPDATE match_tracking SET elapsed_seconds = ?, match_status = ?, timer_started_at = NULL WHERE match_id = ?', [duration.minutes * 60, endStatus, matchId])
			trackingData.elapsed_seconds = duration.minutes * 60
			trackingData.match_status = endStatus
			trackingData.timer_started_at = null
		}
		const [players] = await pool.query(`SELECT p.id, p.nombre, p.apellidos, p.numero, p.posicion, p.photo_url, p.photo_blob, s.on_court, s.time_on_court_seconds, s.court_started_at, s.goals, s.shots, s.assists, s.turnovers, s.steals, s.saves, s.goals_conceded, s.blocks, s.exclusions_2min, s.yellow_cards, s.red_cards, s.blue_cards, s.seven_meters_scored, s.seven_meters_attempted, s.seven_meters_received, s.seven_meters_saved, s.fouls
			FROM match_players mp JOIN players p ON p.id = mp.player_id JOIN match_player_stats s ON s.match_id = mp.match_id AND s.player_id = mp.player_id WHERE mp.match_id = ? ORDER BY p.numero IS NULL, p.numero, p.apellidos, p.nombre`, [matchId])
		players.forEach(player => {
			if (player.photo_blob) player.photo_data = `data:image/jpeg;base64,${player.photo_blob.toString('base64')}`
			delete player.photo_blob
		})
		const validPeriods = Array.from({ length: duration.periods }, (_, index) => `${index + 1}/${duration.periods}`)
		if (!validPeriods.includes(trackingData.period) && trackingData.period !== 'Descanso') trackingData.period = duration.periodFormat
		res.json({ match: matches[0], duration, tracking: trackingData, players })
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'No se pudo cargar el seguimiento del partido' })
	}
})

app.get('/api/matches/:matchId/statistics', async (req, res) => {
	const matchId = Number(req.params.matchId)
	if (!matchId) return res.status(400).json({ error: 'Partido no válido' })
	try {
		const [matches] = await pool.query(`SELECT m.id, m.scheduled_at, t.name AS home_team_name, t.category AS home_team_category, v.name AS visitor_name, n.name AS venue_name
			FROM matches m JOIN teams t ON t.id = m.home_team_id JOIN visitors v ON v.id = m.visitor_id JOIN venues n ON n.id = m.venue_id WHERE m.id = ?`, [matchId])
		if (!matches.length) return res.status(404).json({ error: 'El partido no existe' })
		await pool.query('INSERT IGNORE INTO match_tracking (match_id) VALUES (?)', [matchId])
		await pool.query('INSERT IGNORE INTO match_player_stats (match_id, player_id) SELECT match_id, player_id FROM match_players WHERE match_id = ?', [matchId])
		const [trackingRows] = await pool.query('SELECT home_score, visitor_score, period, match_status, elapsed_seconds, timer_started_at, notes FROM match_tracking WHERE match_id = ?', [matchId])
		const tracking = { ...trackingRows[0], elapsed_seconds: liveElapsedSeconds(trackingRows[0]) }
		const [players] = await pool.query(`SELECT p.id, p.nombre, p.apellidos, p.numero, p.posicion, p.photo_url, p.photo_blob, s.on_court, s.time_on_court_seconds, s.court_started_at,
			s.goals, s.shots, s.assists, s.turnovers, s.steals, s.saves, s.goals_conceded, s.blocks, s.exclusions_2min, s.yellow_cards, s.red_cards, s.blue_cards,
			s.seven_meters_scored, s.seven_meters_attempted, s.seven_meters_received, s.seven_meters_saved, s.fouls
			FROM match_players mp JOIN players p ON p.id = mp.player_id JOIN match_player_stats s ON s.match_id = mp.match_id AND s.player_id = mp.player_id
			WHERE mp.match_id = ? ORDER BY p.numero IS NULL, p.numero, p.apellidos, p.nombre`, [matchId])
		players.forEach(player => {
			if (player.photo_blob) player.photo_data = `data:image/jpeg;base64,${player.photo_blob.toString('base64')}`
			delete player.photo_blob
			player.time_on_court_seconds = Number(player.time_on_court_seconds || 0) + (tracking.match_status === 'En juego' && player.on_court ? secondsSince(player.court_started_at) : 0)
		})
		const [shotEvents] = await pool.query(`SELECT e.id, e.player_id, CONCAT(p.nombre, ' ', COALESCE(p.apellidos, '')) AS player_name, e.event_type AS action, e.zone, NULL AS minute, e.created_at
			FROM match_shot_events e JOIN players p ON p.id = e.player_id WHERE e.match_id = ?`, [matchId])
		const [statEvents] = await pool.query(`SELECT e.id, e.player_id, CONCAT(p.nombre, ' ', COALESCE(p.apellidos, '')) AS player_name, e.stat_key AS action, e.zone, e.minute, e.period, e.created_at
			FROM match_stat_events e JOIN players p ON p.id = e.player_id WHERE e.match_id = ?`, [matchId])
		const events = [...shotEvents, ...statEvents].sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
		const summary = {
			matches: 1,
			home_score: Number(tracking.home_score || 0),
			visitor_score: Number(tracking.visitor_score || 0),
			goals: players.reduce((total, player) => total + Number(player.goals || 0), 0),
			shots: players.reduce((total, player) => total + Number(player.shots || 0), 0),
			seven_meters: players.reduce((total, player) => total + Number(player.seven_meters_attempted || 0), 0),
			time_on_court_seconds: players.reduce((total, player) => total + Number(player.time_on_court_seconds || 0), 0)
		}
		res.json({ match: matches[0], duration: getMatchDuration(matches[0].home_team_category), tracking, players, events, summary })
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'No se pudieron cargar las estadísticas del partido' })
	}
})

app.put('/api/matches/:matchId/follow-up', async (req, res) => {
	const matchId = Number(req.params.matchId)
	const period = String(req.body?.period || 'Primera parte').trim()
	let status = String(req.body?.match_status || 'No iniciado').trim()
	if (!matchId) return res.status(400).json({ error: 'Partido no válido' })
	try {
		const [matchRows] = await pool.query('SELECT t.category FROM matches m JOIN teams t ON t.id = m.home_team_id WHERE m.id = ?', [matchId])
		if (!matchRows.length) return res.status(404).json({ error: 'El partido no existe' })
		const duration = getMatchDuration(matchRows[0].category)
		const [currentRows] = await pool.query('SELECT * FROM match_tracking WHERE match_id = ?', [matchId])
		if (!currentRows.length) return res.status(404).json({ error: 'El seguimiento no existe' })
		const current = currentRows[0]
		const wasRunning = current.match_status === 'En juego'
		const hasElapsedOverride = req.body?.elapsed_seconds !== undefined
		const requestedElapsed = normaliseNonNegativeInteger(req.body?.elapsed_seconds)
		const periodChanged = current.period !== period
		let elapsed = hasElapsedOverride ? requestedElapsed : wasRunning ? liveElapsedSeconds(current) : Number(current.elapsed_seconds || 0)
		const resettingMatch = status === 'No iniciado'
		if (resettingMatch || periodChanged) elapsed = 0
		const effectivePeriod = resettingMatch ? duration.periodFormat : period
		if (status === 'En juego' && elapsed >= duration.minutes * 60) status = period === `${duration.periods}/${duration.periods}` ? 'Finalizado' : 'Descanso'
		const isRunning = status === 'En juego'
		if (resettingMatch) {
			await pool.query('DELETE FROM match_stat_events WHERE match_id = ?', [matchId])
			await pool.query('DELETE FROM match_shot_events WHERE match_id = ?', [matchId])
			await pool.query('DELETE FROM match_player_stats WHERE match_id = ?', [matchId])
		}
		if (wasRunning && !isRunning) await pool.query('UPDATE match_player_stats SET time_on_court_seconds = time_on_court_seconds + IF(court_started_at IS NULL, 0, TIMESTAMPDIFF(SECOND, court_started_at, NOW())), court_started_at = NULL WHERE match_id = ? AND on_court = 1', [matchId])
		if ((!wasRunning && isRunning) || (periodChanged && isRunning)) await pool.query('UPDATE match_player_stats SET court_started_at = NOW() WHERE match_id = ? AND on_court = 1', [matchId])
		const timerStartedAt = isRunning && status === 'En juego' ? (hasElapsedOverride || periodChanged || !wasRunning ? new Date() : current.timer_started_at) : null
		const scoreFields = resettingMatch
			? 'home_score = 0, visitor_score = 0'
			: 'home_score = (SELECT COALESCE(SUM(goals), 0) FROM match_player_stats WHERE match_id = ?), visitor_score = (SELECT COALESCE(SUM(goals_conceded), 0) FROM match_player_stats WHERE match_id = ?)'
		const scoreParams = resettingMatch ? [] : [matchId, matchId]
		const [result] = await pool.query(`UPDATE match_tracking SET ${scoreFields}, period = ?, match_status = ?, elapsed_seconds = ?, timer_started_at = ?, notes = ? WHERE match_id = ?`, [...scoreParams, effectivePeriod, status, elapsed, timerStartedAt, String(req.body?.notes || ''), matchId])
		if (!result.affectedRows) return res.status(404).json({ error: 'El seguimiento no existe' })
		const [rows] = await pool.query('SELECT home_score, visitor_score, period, match_status, elapsed_seconds, timer_started_at, notes FROM match_tracking WHERE match_id = ?', [matchId])
		res.json(rows[0])
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'No se pudo guardar el estado del partido' })
	}
})

app.put('/api/matches/:matchId/follow-up/players/:playerId', async (req, res) => {
	const matchId = Number(req.params.matchId)
	const playerId = Number(req.params.playerId)
	const statFields = ['goals', 'shots', 'assists', 'turnovers', 'steals', 'saves', 'goals_conceded', 'blocks', 'exclusions_2min', 'yellow_cards', 'red_cards', 'blue_cards', 'seven_meters_scored', 'seven_meters_attempted', 'seven_meters_received', 'seven_meters_saved', 'fouls']
	if (!matchId || !playerId) return res.status(400).json({ error: 'Partido o jugador no válido' })
	try {
		const [calledUp] = await pool.query('SELECT 1 FROM match_players WHERE match_id = ? AND player_id = ?', [matchId, playerId])
		if (!calledUp.length) return res.status(404).json({ error: 'El jugador no pertenece a la convocatoria' })
		const [currentStats] = await pool.query(`SELECT s.on_court, s.time_on_court_seconds, s.court_started_at, s.${statFields.join(', s.')}, t.match_status, t.period, t.elapsed_seconds, t.timer_started_at
			FROM match_player_stats s JOIN match_tracking t ON t.match_id = s.match_id WHERE s.match_id = ? AND s.player_id = ?`, [matchId, playerId])
		const currentPlayer = currentStats[0]
		const requestedOnCourt = req.body?.on_court ? 1 : 0
		if (currentPlayer && Number(currentPlayer.on_court) !== requestedOnCourt && currentPlayer.match_status === 'En juego') {
			if (requestedOnCourt) await pool.query('UPDATE match_player_stats SET court_started_at = NOW() WHERE match_id = ? AND player_id = ?', [matchId, playerId])
			else await pool.query('UPDATE match_player_stats SET time_on_court_seconds = time_on_court_seconds + IF(court_started_at IS NULL, 0, TIMESTAMPDIFF(SECOND, court_started_at, NOW())), court_started_at = NULL WHERE match_id = ? AND player_id = ?', [matchId, playerId])
		}
		const values = statFields.map(field => normaliseNonNegativeInteger(req.body?.[field]))
		const elapsed = liveElapsedSeconds(currentPlayer || {})
		const minute = Math.floor(elapsed / 60) + 1
		await pool.query(`INSERT INTO match_player_stats (match_id, player_id, on_court, ${statFields.join(', ')}) VALUES (?, ?, ?, ${statFields.map(() => '?').join(', ')})
			ON DUPLICATE KEY UPDATE on_court = VALUES(on_court), ${statFields.map(field => `${field} = VALUES(${field})`).join(', ')}`, [matchId, playerId, req.body?.on_court ? 1 : 0, ...values])
		for (const [index, field] of statFields.entries()) {
			const previousValue = normaliseNonNegativeInteger(currentPlayer?.[field])
			const delta = values[index] - previousValue
			if (delta) await pool.query('INSERT INTO match_stat_events (match_id, player_id, stat_key, amount, minute, period) VALUES (?, ?, ?, ?, ?, ?)', [matchId, playerId, field, delta, minute, currentPlayer?.period || '1/2'])
		}
		await pool.query('UPDATE match_tracking SET home_score = (SELECT COALESCE(SUM(goals), 0) FROM match_player_stats WHERE match_id = ?), visitor_score = (SELECT COALESCE(SUM(goals_conceded), 0) FROM match_player_stats WHERE match_id = ?) WHERE match_id = ?', [matchId, matchId, matchId])
		const [rows] = await pool.query(`SELECT p.id, p.nombre, p.apellidos, p.numero, p.posicion, s.on_court, s.time_on_court_seconds, s.court_started_at, s.goals, s.shots, s.assists, s.turnovers, s.steals, s.saves, s.goals_conceded, s.blocks, s.exclusions_2min, s.yellow_cards, s.red_cards, s.blue_cards, s.seven_meters_scored, s.seven_meters_attempted, s.seven_meters_received, s.seven_meters_saved, s.fouls FROM players p JOIN match_player_stats s ON s.player_id = p.id WHERE s.match_id = ? AND s.player_id = ?`, [matchId, playerId])
		res.json(rows[0])
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'No se pudieron guardar las estadísticas del jugador' })
	}
})

app.post('/api/matches/:matchId/follow-up/players/:playerId/shots', async (req, res) => {
	const matchId = Number(req.params.matchId)
	const playerId = Number(req.params.playerId)
	const eventType = String(req.body?.event_type || '')
	const zone = String(req.body?.zone || '')
	const validZones = ['outside', 'top-left', 'top-center', 'top-right', 'middle-left', 'middle-center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']
	if (!matchId || !playerId || !['goal', 'save', 'conceded'].includes(eventType) || !validZones.includes(zone)) return res.status(400).json({ error: 'Lanzamiento no válido' })
	try {
		const [calledUp] = await pool.query('SELECT 1 FROM match_players WHERE match_id = ? AND player_id = ?', [matchId, playerId])
		if (!calledUp.length) return res.status(404).json({ error: 'El jugador no pertenece a la convocatoria' })
		const [trackingRows] = await pool.query('SELECT elapsed_seconds, timer_started_at, match_status, period FROM match_tracking WHERE match_id = ?', [matchId])
		const minute = Math.floor(liveElapsedSeconds(trackingRows[0] || {}) / 60) + 1
		await pool.query('INSERT INTO match_shot_events (match_id, player_id, event_type, zone) VALUES (?, ?, ?, ?)', [matchId, playerId, eventType, zone])
		await pool.query('INSERT INTO match_stat_events (match_id, player_id, stat_key, amount, minute, period, zone) VALUES (?, ?, ?, 1, ?, ?, ?)', [matchId, playerId, eventType, minute, trackingRows[0]?.period || '1/2', zone])
		if (eventType === 'goal') {
			await pool.query('UPDATE match_player_stats SET goals = goals + 1, shots = shots + 1 WHERE match_id = ? AND player_id = ?', [matchId, playerId])
			await pool.query('UPDATE match_tracking SET home_score = (SELECT COALESCE(SUM(goals), 0) FROM match_player_stats WHERE match_id = ?) WHERE match_id = ?', [matchId, matchId])
		}
		else if (eventType === 'save') await pool.query('UPDATE match_player_stats SET saves = saves + 1 WHERE match_id = ? AND player_id = ?', [matchId, playerId])
		else {
			await pool.query('UPDATE match_player_stats SET goals_conceded = goals_conceded + 1 WHERE match_id = ? AND player_id = ?', [matchId, playerId])
			await pool.query('UPDATE match_tracking SET visitor_score = (SELECT COALESCE(SUM(goals_conceded), 0) FROM match_player_stats WHERE match_id = ?) WHERE match_id = ?', [matchId, matchId])
		}
		res.status(201).json({ event_type: eventType, zone })
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'No se pudo guardar la zona del lanzamiento' })
	}
})

app.post('/api/matches/:matchId/follow-up/players/:playerId/seven-meters', async (req, res) => {
	const matchId = Number(req.params.matchId)
	const playerId = Number(req.params.playerId)
	const outcome = String(req.body?.outcome || '')
	const zone = String(req.body?.zone || '')
	const validZones = ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']
	if (!matchId || !playerId || !['goal', 'save', 'outside'].includes(outcome) || !validZones.includes(zone)) return res.status(400).json({ error: 'Lanzamiento de 7 metros no válido' })
	try {
		const [calledUp] = await pool.query('SELECT 1 FROM match_players WHERE match_id = ? AND player_id = ?', [matchId, playerId])
		if (!calledUp.length) return res.status(404).json({ error: 'El jugador no pertenece a la convocatoria' })
		const [trackingRows] = await pool.query('SELECT elapsed_seconds, timer_started_at, match_status, period FROM match_tracking WHERE match_id = ?', [matchId])
		const minute = Math.floor(liveElapsedSeconds(trackingRows[0] || {}) / 60) + 1
		await pool.query('INSERT INTO match_stat_events (match_id, player_id, stat_key, amount, `minute`, period, `zone`) VALUES (?, ?, ?, 1, ?, ?, ?)', [matchId, playerId, `seven_meter_${outcome}`, minute, trackingRows[0]?.period || '1/2', zone])
		if (outcome === 'goal') {
			await pool.query('UPDATE match_player_stats SET seven_meters_attempted = seven_meters_attempted + 1, seven_meters_scored = seven_meters_scored + 1, goals = goals + 1, shots = shots + 1 WHERE match_id = ? AND player_id = ?', [matchId, playerId])
			await pool.query('UPDATE match_tracking SET home_score = (SELECT COALESCE(SUM(goals), 0) FROM match_player_stats WHERE match_id = ?) WHERE match_id = ?', [matchId, matchId])
		} else {
			await pool.query('UPDATE match_player_stats SET seven_meters_attempted = seven_meters_attempted + 1 WHERE match_id = ? AND player_id = ?', [matchId, playerId])
		}
		res.status(201).json({ outcome, zone, minute })
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'No se pudo guardar el lanzamiento de 7 metros' })
	}
})

app.get('/api/matches', async (req, res) => {
	try {
		const [rows] = await pool.query(`SELECT m.id, m.home_team_id, t.name AS home_team_name, m.visitor_id, v.name AS visitor_name, m.venue_id, n.name AS venue_name, n.location AS venue_location, DATE_FORMAT(m.scheduled_at, '%Y-%m-%dT%H:%i') AS scheduled_at, m.advance_minutes, (SELECT COUNT(*) FROM match_players mp WHERE mp.match_id = m.id) AS player_count
			FROM matches m
			JOIN teams t ON t.id = m.home_team_id
			JOIN visitors v ON v.id = m.visitor_id
			JOIN venues n ON n.id = m.venue_id
			ORDER BY m.scheduled_at`);
		res.json(rows);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'DB error' });
	}
});

app.get('/api/matches/:matchId/players', async (req, res) => {
	try {
		const [rows] = await pool.query(`SELECT p.id, p.nombre, p.apellidos, p.numero
			FROM match_players mp JOIN players p ON p.id = mp.player_id
			WHERE mp.match_id = ? ORDER BY p.numero IS NULL, p.numero, p.apellidos, p.nombre`, [Number(req.params.matchId)]);
		res.json(rows);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'No se pudo cargar la convocatoria' });
	}
});

app.post('/api/matches', async (req, res) => {
	const homeTeamId = Number(req.body?.home_team_id);
	const visitorId = Number(req.body?.visitor_id);
	const venueId = Number(req.body?.venue_id);
	const scheduledAt = String(req.body?.scheduled_at || '').trim();
	const advanceMinutes = Number(req.body?.advance_minutes ?? 30);
	const playerIds = [...new Set((Array.isArray(req.body?.player_ids) ? req.body.player_ids : []).map(Number).filter(Boolean))];
	if (!homeTeamId || !visitorId || !venueId || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledAt) || !Number.isInteger(advanceMinutes) || advanceMinutes < 0) {
		return res.status(400).json({ error: 'Completa equipo local, visitante, fecha, hora y pabellón' });
	}
	if (playerIds.length < 7) return res.status(400).json({ error: 'La convocatoria debe tener al menos 7 jugadores' });
	try {
		if (playerIds.length) {
			const [validPlayers] = await pool.query('SELECT DISTINCT p.id FROM players p JOIN player_teams pt ON pt.player_id = p.id WHERE pt.team_id = ? AND p.id IN (?)', [homeTeamId, playerIds]);
			if (validPlayers.length !== playerIds.length) return res.status(400).json({ error: 'La convocatoria contiene jugadores que no pertenecen al equipo local' });
		}
		const [result] = await pool.query('INSERT INTO matches (home_team_id, visitor_id, venue_id, scheduled_at, advance_minutes) VALUES (?, ?, ?, ?, ?)', [homeTeamId, visitorId, venueId, scheduledAt.replace('T', ' ') + ':00', advanceMinutes]);
		if (playerIds.length) await pool.query('INSERT INTO match_players (match_id, player_id) VALUES ?', [playerIds.map(playerId => [result.insertId, playerId])]);
		const [rows] = await pool.query('SELECT id, home_team_id, visitor_id, venue_id, scheduled_at, advance_minutes, created_at FROM matches WHERE id = ?', [result.insertId]);
		res.status(201).json(rows[0]);
	} catch (err) {
		console.error(err);
		if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'Uno de los equipos, visitante o pabellón no existe' });
		res.status(500).json({ error: 'No se pudo guardar la programación' });
	}
});

app.put('/api/matches/:matchId', async (req, res) => {
	const matchId = Number(req.params.matchId);
	const homeTeamId = Number(req.body?.home_team_id);
	const visitorId = Number(req.body?.visitor_id);
	const venueId = Number(req.body?.venue_id);
	const scheduledAt = String(req.body?.scheduled_at || '').trim();
	const advanceMinutes = Number(req.body?.advance_minutes ?? 30);
	const playerIds = [...new Set((Array.isArray(req.body?.player_ids) ? req.body.player_ids : []).map(Number).filter(Boolean))];
	if (!matchId || !homeTeamId || !visitorId || !venueId || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledAt) || !Number.isInteger(advanceMinutes) || advanceMinutes < 0) {
		return res.status(400).json({ error: 'Completa equipo local, visitante, fecha, hora y pabellón' });
	}
	if (playerIds.length < 7) return res.status(400).json({ error: 'La convocatoria debe tener al menos 7 jugadores' });
	try {
		const [validPlayers] = await pool.query('SELECT DISTINCT p.id FROM players p JOIN player_teams pt ON pt.player_id = p.id WHERE pt.team_id = ? AND p.id IN (?)', [homeTeamId, playerIds]);
		if (validPlayers.length !== playerIds.length) return res.status(400).json({ error: 'La convocatoria contiene jugadores que no pertenecen al equipo local' });
		const connection = await pool.getConnection();
		try {
			await connection.beginTransaction();
			const [result] = await connection.query('UPDATE matches SET home_team_id = ?, visitor_id = ?, venue_id = ?, scheduled_at = ?, advance_minutes = ? WHERE id = ?', [homeTeamId, visitorId, venueId, scheduledAt.replace('T', ' ') + ':00', advanceMinutes, matchId]);
			if (!result.affectedRows) {
				await connection.rollback();
				return res.status(404).json({ error: 'El partido no existe' });
			}
			await connection.query('DELETE FROM match_players WHERE match_id = ?', [matchId]);
			await connection.query('INSERT INTO match_players (match_id, player_id) VALUES ?', [playerIds.map(playerId => [matchId, playerId])]);
			await connection.commit();
		} catch (err) {
			await connection.rollback();
			throw err;
		} finally {
			connection.release();
		}
		res.json({ id: matchId });
	} catch (err) {
		console.error(err);
		if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'Uno de los equipos, visitante o pabellón no existe' });
		res.status(500).json({ error: 'No se pudo actualizar la programación' });
	}
});

// Players endpoints: list and create per team
app.get('/api/teams/:teamId/players', async (req, res) => {
	const teamId = Number(req.params.teamId)
	try {
		const [rows] = await pool.query('SELECT p.id, p.team_id, p.nombre, p.apellidos, p.posicion, p.numero, p.photo_url, p.photo_blob, p.created_at FROM players p JOIN player_teams pt ON pt.player_id = p.id WHERE pt.team_id = ? ORDER BY p.id', [teamId])
		rows.forEach(player => {
			if (player.photo_blob) {
				player.photo_data = `data:image/jpeg;base64,${player.photo_blob.toString('base64')}`
			}
			delete player.photo_blob
		})
		res.json(rows)
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'DB error' })
	}
})

app.post('/api/teams/:teamId/players', async (req, res) => {
	const teamId = Number(req.params.teamId)
	const { nombre, apellidos, posicion, numero, photo_url, photo_data } = req.body || {}
	if (!nombre) return res.status(400).json({ error: 'nombre is required' })
	try {
		const photoBuffer = photo_data ? dataUrlToBuffer(photo_data) : null
		const [result] = await pool.query('INSERT INTO players (team_id, nombre, apellidos, posicion, numero, photo_url, photo_blob) VALUES (?, ?, ?, ?, ?, ?, ?)', [teamId, nombre, apellidos || null, posicion || null, numero || null, photo_url || null, photoBuffer])
		await pool.query('INSERT INTO player_teams (player_id, team_id) VALUES (?, ?)', [result.insertId, teamId])
		const [rows] = await pool.query('SELECT id, team_id, nombre, apellidos, posicion, numero, photo_url, photo_blob, created_at FROM players WHERE id = ?', [result.insertId])
		if (rows[0].photo_blob) rows[0].photo_data = `data:image/jpeg;base64,${rows[0].photo_blob.toString('base64')}`
		delete rows[0].photo_blob
		res.status(201).json(rows[0])
	} catch (err) {
		console.error(err)
		if (err.message?.includes('imagen') || err.message?.includes('Formato')) return res.status(400).json({ error: err.message })
		res.status(500).json({ error: 'DB error' })
	}
});

app.put('/api/players/:id', async (req, res) => {
	const id = Number(req.params.id)
	const { nombre, apellidos, posicion, numero, photo_url, photo_data, team_ids } = req.body || {}
	if (!id || !nombre) return res.status(400).json({ error: 'id y nombre son obligatorios' })
	try {
		const photoBuffer = photo_data ? dataUrlToBuffer(photo_data) : undefined
		if (photoBuffer !== undefined) {
			await pool.query('UPDATE players SET nombre = ?, apellidos = ?, posicion = ?, numero = ?, photo_url = ?, photo_blob = ? WHERE id = ?', [nombre, apellidos || null, posicion || null, numero || null, photo_url || null, photoBuffer, id])
		} else {
			await pool.query('UPDATE players SET nombre = ?, apellidos = ?, posicion = ?, numero = ?, photo_url = ? WHERE id = ?', [nombre, apellidos || null, posicion || null, numero || null, photo_url || null, id])
		}
		if (Array.isArray(team_ids)) {
			const teamIds = [...new Set(team_ids.map(Number).filter(Boolean))]
			if (!teamIds.length) return res.status(400).json({ error: 'Selecciona al menos un equipo' })
			const connection = await pool.getConnection()
			try {
				await connection.beginTransaction()
				await connection.query('DELETE FROM player_teams WHERE player_id = ?', [id])
				await connection.query('INSERT INTO player_teams (player_id, team_id) VALUES ?', [teamIds.map(teamId => [id, teamId])])
				await connection.query('UPDATE players SET team_id = ? WHERE id = ?', [teamIds[0], id])
				await connection.commit()
			} catch (associationError) {
				await connection.rollback()
				throw associationError
			} finally {
				connection.release()
			}
		}
		const [rows] = await pool.query('SELECT id, team_id, nombre, apellidos, posicion, numero, photo_url, photo_blob, created_at FROM players WHERE id = ?', [id])
		if (!rows.length) return res.status(404).json({ error: 'player not found' })
		if (rows[0].photo_blob) rows[0].photo_data = `data:image/jpeg;base64,${rows[0].photo_blob.toString('base64')}`
		delete rows[0].photo_blob
		res.json(rows[0])
	} catch (err) {
		console.error(err)
		if (err.message?.includes('imagen') || err.message?.includes('Formato')) return res.status(400).json({ error: err.message })
		res.status(500).json({ error: 'DB error' })
	}
});

function dataUrlToBuffer(dataUrl) {
	const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '')
	if (!match) throw new Error('Formato de imagen no válido. Usa JPG, PNG o WEBP.')
	const buffer = Buffer.from(match[2], 'base64')
	if (buffer.length > 16 * 1024 * 1024) throw new Error('La imagen supera el tamaño máximo de 16 MB.')
	return buffer
}

(async () => {
	try {
		await initDb();
		const port = process.env.PORT || 4000;
		app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
	} catch (err) {
		console.error('Failed to start:', err);
	}
})();
