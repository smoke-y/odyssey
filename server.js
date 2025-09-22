const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());
app.use("/leaflet", express.static(path.join(__dirname, "node_modules/leaflet/dist")));
app.use("/leaflet", express.static(path.join(__dirname, "node_modules/leaflet-routing-machine/dist")));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

app.post("/signup", (req, res) => {
    const { username, password, repassword } = req.body;
    res.sendFile(path.join(__dirname, "public/dashboard.html"));
});
app.post("/signin", (req, res) => {
    res.sendFile(path.join(__dirname, "public/dashboard.html"));
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log("Server is running @ %d...", PORT);
});
