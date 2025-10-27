const express = require("express");
const path = require("path");
const app = express();
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'ody',
    password: 'newpassword',
    port: 5432,
});

pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    client.query('SELECT NOW()', (err, result) => {
        release();
        if (err) {
            return console.error('Error executing query', err.stack);
        }
        console.log('Connected to PostgreSQL:', result.rows[0]);
    });
});

const JWT_SECRET = "your_secret_key_here_change_in_production";
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    console.log('Request URL:', req.url);
    console.log("TOK" + token);
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: "Access denied. No token provided." 
        });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            success: false, 
            message: "Invalid or expired token" 
        });
    }
};

app.use(express.json());
app.use("/leaflet", express.static(path.join(__dirname, "node_modules/leaflet/dist")));
app.use("/leaflet", express.static(path.join(__dirname, "node_modules/leaflet-routing-machine/dist")));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

app.post("/signup", async (req, res) => {
    try {
        const { username, password, repassword } = req.body;
        
        if (password !== repassword) {
            return res.status(400).json({ 
                success: false, 
                message: "Passwords do not match" 
            });
        }
        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        const query = 'INSERT INTO USERS (username, password) VALUES ($1, $2) RETURNING id, username';
        const values = [username, hashedPassword];
        
        const result = await pool.query(query, values);
        const user = result.rows[0];
        
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.json({ 
            success: true, 
            message: "Signup successful",
            token: token,
        });
    } catch (error) {
        console.error("Error during signup:", error);
        
        if (error.code === '23505') {
            return res.status(400).json({ 
                success: false, 
                message: "Username already exists" 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: "Server error during signup" 
        });
    }
});
app.post("/signin", async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const query = 'SELECT * FROM USERS WHERE username = $1';
        const result = await pool.query(query, [username]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: "Invalid credentials" 
            });
        }
        
        const user = result.rows[0];
        
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (isPasswordValid) {
            const token = jwt.sign(
                { userId: user.id, username: user.username },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            res.json({ 
                success: true, 
                message: "Signup successful",
                token: token,
            });
        } else {
            res.status(401).json({ 
                success: false, 
                message: "Invalid credentials" 
            });
        }
        
    } catch (error) {
        console.log("Error during signin:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error during signin" 
        });
    }
});

app.post("/save-markers", (req, res) => {
    try {
        const markers = req.body.markers;
        
        console.log(JSON.stringify(markers, null, 2));
        
        res.json({ success: true, message: "Markers saved successfully" });
    } catch (error) {
        console.error("Error saving markers:", error);
        res.status(500).json({ success: false, message: error});
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "public/first.html"));
});
app.get('/signin', (req, res) => {
    res.sendFile(path.join(__dirname, "public/signin.html"));
});
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, "public/signup.html"));
});
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, "public/dashboard.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log("Server is running @ %d...", PORT);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on port 8080');
});
