const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());
app.use("/leaflet", express.static(path.join(__dirname, "node_modules/leaflet/dist")));
app.use("/leaflet", express.static(path.join(__dirname, "node_modules/leaflet-routing-machine/dist")));
app.use(express.static(path.join(__dirname, "public")));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "public/first.html"));
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log("Server is running @ %d...", PORT);
});
