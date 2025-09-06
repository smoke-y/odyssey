const express = require("express");
const path = require("path");
const app = express();

app.use("/leaflet", express.static(path.join(__dirname, "node_modules/leaflet/dist")));
app.use("/leaflet", express.static(path.join(__dirname, "node_modules/leaflet-routing-machine/dist")));
app.use(express.static(path.join(__dirname, "public")));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "public/createPlan.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server is running...");
});
