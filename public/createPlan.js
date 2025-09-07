const map = L.map("map").setView([51.505, -0.09], 13);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const greenIcon = L.icon({
    iconUrl: "images/greenMarker.png",
    shadowUrl: "images/shadowMarker.png",
    iconSize: [38, 95],
    shadowSize: [50, 64],
    iconAnchor: [22, 94],
    shadowAnchor: [4, 62],
    popupAnchor: [-3, -76]
});
const redIcon = L.icon({
    iconUrl: "images/redMarker.png",
    shadowUrl: "images/shadowMarker.png",
    iconSize: [38, 95],
    shadowSize: [50, 64],
    iconAnchor: [22, 94],
    shadowAnchor: [4, 62],
    popupAnchor: [-3, -76]
});

let markers = [];
let routingControl = null;
let totalExpenditure = 0;
let totalStayPoints = 0;
let totalTourPoints = 0;
let editingIndex = null; // Track the index of the marker being edited

function updateRouting() {
    return; //for now
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }

    let waypoints = markers.map(markerData => 
        L.latLng(markerData.lat, markerData.lng)
    );

    if (waypoints.length >= 2) {
        routingControl = L.Routing.control({
            waypoints: waypoints,
            routeWhileDragging: true,
            createMarker: function() { return null; }
        }).addTo(map);
    }
}

function createNote(note, doa, ee, lat, lng) {
    let n = "";
    if (doa !== "") {
        n += "Date Of Arrival: " + doa + "<br>";
    }
    if (!isNaN(ee)) {
        n += "Expected Expenditure: " + ee + "<br>";
    }
    if (note !== "") {
        n += "Note:<br>" + note;
    }
    return n;
}

function updateStats() {
    $("#stats").html(
        "Total Expenditure: " + totalExpenditure.toString() + "<br>" + 
        "Stay Points: " + totalStayPoints.toString() + "<br>" +
        "Tour Points: " + totalTourPoints.toString()
    );
}

function populateForm(index) {
    let markerData = markers[index];
    $("#latlong").val(`${markerData.lat},${markerData.lng}`);
    $("#name").val(markerData.name);
    $("#note").val(markerData.note);
    $("#doa").val(markerData.doa);
    $("#ee").val(markerData.ee);
    $("#type").val(markerData.type);
    $("#markerForm button[type='submit']").text("Update Marker");
    editingIndex = index; // Set the index of the marker being edited
}

function resetForm() {
    $("#markerForm")[0].reset();
    $("#markerForm button[type='submit']").text("Add Marker");
    editingIndex = null; // Clear editing state
}

function saveMarkersToServer() {
    if(markers.length == 0){
        $("#saveStatus").html("Nothing to save!");
        return;
    }
    const markersData = markers.map(marker => ({
        lat: marker.lat,
        lng: marker.lng,
        name: marker.name,
        doa: marker.doa,
        ee: marker.ee,
        note: marker.note,
        type: marker.type
    }));

    fetch("/save-markers", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ markers: markersData })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            $("#saveStatus").html("Plan saved successfully!").css("color", "green");
        } else {
            $("#saveStatus").html("Error saving plan: " + data.message).css("color", "red");
        }
    })
    .catch(error => {
        console.error("Error:", error);
        $("#saveStatus").html("Error saving plan").css("color", "red");
    });
}
$("#saveMarkersBtn").on("click", saveMarkersToServer);

$(document).ready(function() {
    $("#markerList").sortable({
        update: function(event, ui) {
            let newOrder = [];
            $("#markerList li").each(function() {
                let index = $(this).data("index");
                newOrder.push(markers[index]);
            });
            markers = newOrder;
            $("#markerList li").each(function(i) {
                $(this).data("index", i);
            });
            updateRouting();
        }
    });
    $("#markerList").disableSelection();

    $("#markerForm").on("submit", function(e) {
        e.preventDefault();
        
        let latLong = $("#latlong").val().split(',');
        let lat = parseFloat(latLong[0]);
        let lng = parseFloat(latLong[1]);
        let doa = $("#doa").val();
        let ee = parseFloat($("#ee").val()) || 0;
        let name = $("#name").val();
        let note = $("#note").val();
        let type = $("#type").val();
        let popupNote = createNote(note, doa, ee, lat, lng);

        if (isNaN(lat) || isNaN(lng)) {
            alert("Please enter valid latitude and longitude values.");
            return;
        }

        if (editingIndex !== null) {
            // Update existing marker
            let markerData = markers[editingIndex];
            totalExpenditure -= markerData.ee || 0;
            if (markerData.type === "stay") {
                totalStayPoints -= 1;
            } else {
                totalTourPoints -= 1;
            }

            map.removeLayer(markerData.marker);
            markerData.lat = lat;
            markerData.lng = lng;
            markerData.name = name;
            markerData.doa = doa;
            markerData.ee = ee;
            markerData.note = note;
            markerData.type = type;
            markerData.marker = L.marker([lat, lng], { 
                alt: name, 
                icon: type === "tour" ? redIcon : greenIcon 
            }).addTo(map).bindPopup(popupNote);

            totalExpenditure += ee;
            if (type === "stay") {
                totalStayPoints += 1;
            } else {
                totalTourPoints += 1;
            }

            $(`#markerList li[data-index="${editingIndex}"]`).html(
                `${name} <br> ${popupNote} <button class="delete-btn" data-index="${editingIndex}">Delete</button>`
            );
        } else {
            // Add new marker
            if (type === "stay") {
                totalStayPoints += 1;
            } else {
                totalTourPoints += 1;
            }
            totalExpenditure += ee;

            let marker = L.marker([lat, lng], { 
                alt: name, 
                icon: type === "tour" ? redIcon : greenIcon 
            }).addTo(map).bindPopup(popupNote);

            let markerData = {
                marker: marker,
                lat: lat,
                lng: lng,
                name: name,
                doa: doa,
                ee: ee,
                note: note,
                type: type
            };
            markers.push(markerData);

            let index = markers.length - 1;
            let listItem = `
                <li data-index="${index}">
                    ${name} - ${popupNote}
                    <button class="delete-btn" data-index="${index}">Delete</button>
                </li>`;
            $("#markerList").append(listItem);
        }

        resetForm();
        updateRouting();
        updateStats();
    });

    $("#markerList").on("click", ".delete-btn", function(e) {
        e.stopPropagation(); // Prevent list item click event
        let index = $(this).data("index");
        totalExpenditure -= markers[index].ee || 0;
        if (markers[index].type === "stay") {
            totalStayPoints -= 1;
        } else {
            totalTourPoints -= 1;
        }
        map.removeLayer(markers[index].marker);
        markers.splice(index, 1);
        $(this).parent().remove();
        $("#markerList li").each(function(i) {
            $(this).data("index", i);
            $(this).find(".delete-btn").data("index", i);
        });
        resetForm(); // Reset form if editing marker is deleted
        updateRouting();
        updateStats();
    });

    $("#markerList").on("click", "li", function(e) {
        if ($(e.target).hasClass("delete-btn")) return; // Ignore clicks on delete button
        let index = $(this).data("index");
        populateForm(index);
        let markerData = markers[index];
        map.setView([markerData.lat, markerData.lng], 13);
        markerData.marker.openPopup();
    });
});
