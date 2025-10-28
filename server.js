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

app.get("/api/plans", verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const query = 'SELECT * FROM plans WHERE userid = $1 ORDER BY plansequence';
        const result = await pool.query(query, [userId]);
        
        res.json({ 
            success: true, 
            plans: result.rows 
        });
    } catch (error) {
        console.error("Error fetching plans:", error);
        res.status(500).json({ 
            success: false, 
            message: "Error fetching plans" 
        });
    }
});

app.post("/api/plans", verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { planName } = req.body;
        
        if (!planName) {
            return res.status(400).json({ 
                success: false, 
                message: "Plan name is required" 
            });
        }
        
        const query = `
            INSERT INTO plans (userid, plansequence, planname)
            SELECT $1, COALESCE(MAX(plansequence), 0) + 1, $2
            FROM plans
            WHERE userid = $1
            RETURNING *
        `;
        
        const result = await pool.query(query, [userId, planName]);
        
        res.json({ 
            success: true, 
            plan: result.rows[0],
            message: "Plan created successfully" 
        });
    } catch (error) {
        console.error("Error creating plan:", error);
        res.status(500).json({ 
            success: false, 
            message: "Error creating plan" 
        });
    }
});

app.delete("/api/plans/:userId/:planSequence", verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { userId: paramUserId, planSequence } = req.params;
        
        // Ensure user can only delete their own plans
        if (parseInt(paramUserId) !== userId) {
            return res.status(403).json({ 
                success: false, 
                message: "Unauthorized" 
            });
        }
        
        const query = 'DELETE FROM plans WHERE userid = $1 AND plansequence = $2';
        await pool.query(query, [userId, planSequence]);
        
        res.json({ 
            success: true, 
            message: "Plan deleted successfully" 
        });
    } catch (error) {
        console.error("Error deleting plan:", error);
        res.status(500).json({ 
            success: false, 
            message: "Error deleting plan" 
        });
    }
});
// GET plan data with markers
app.get("/api/plans/:userId/:planSequence", verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { userId: paramUserId, planSequence } = req.params;
        
        if (parseInt(paramUserId) !== userId) {
            return res.status(403).json({ 
                success: false, 
                message: "Unauthorized" 
            });
        }
        
        // Get plan details
        const planQuery = 'SELECT * FROM plans WHERE userid = $1 AND plansequence = $2';
        const planResult = await pool.query(planQuery, [userId, planSequence]);
        
        if (planResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Plan not found" 
            });
        }
        
        // Get markers for this plan
        const markersQuery = `
            SELECT * FROM plan_markers 
            WHERE userid = $1 AND plansequence = $2 
            ORDER BY marker_order
        `;
        const markersResult = await pool.query(markersQuery, [userId, planSequence]);
        
        res.json({ 
            success: true, 
            plan: planResult.rows[0],
            markers: markersResult.rows
        });
    } catch (error) {
        console.error("Error fetching plan:", error);
        res.status(500).json({ 
            success: false, 
            message: "Error fetching plan" 
        });
    }
});

// Save markers for a plan
app.post("/api/plans/:userId/:planSequence/markers", verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { userId: paramUserId, planSequence } = req.params;
        const { markers } = req.body;
        
        if (parseInt(paramUserId) !== userId) {
            return res.status(403).json({ 
                success: false, 
                message: "Unauthorized" 
            });
        }
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Delete existing markers
            await client.query(
                'DELETE FROM plan_markers WHERE userid = $1 AND plansequence = $2',
                [userId, planSequence]
            );
            
            // Insert new markers
            for (let i = 0; i < markers.length; i++) {
                const marker = markers[i];
                await client.query(
                    `INSERT INTO plan_markers 
                    (userid, plansequence, lat, lng, name, doa, ee, note, shouldRoute, type, marker_order)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [userId, planSequence, marker.lat, marker.lng, marker.name, 
                     marker.doa || null, marker.ee || 0, marker.note || '', 
                     marker.shouldRoute, marker.type, i]
                );
            }
            
            await client.query('COMMIT');
            
            res.json({ 
                success: true, 
                message: "Markers saved successfully" 
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error saving markers:", error);
        res.status(500).json({ 
            success: false, 
            message: "Error saving markers" 
        });
    }
});

// Route to createPlan page
app.get('/createPlan', (req, res) => {
    res.sendFile(path.join(__dirname, "public/createPlan.html"));
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
app.get('/plans', (req, res) => {
    res.sendFile(path.join(__dirname, "public/plans.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log("Server is running @ %d...", PORT);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on port 8080');
});
