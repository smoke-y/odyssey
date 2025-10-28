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
let editingIndex = null;

// Common function to format notes from marker data
function formatMarkerNote(markerData) {
    let note = "";
    
    if (markerData.doa) {
        let dateObj = new Date(markerData.doa);
        let formattedDate = dateObj.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        note += "Date Of Arrival: " + formattedDate + "<br>";
    }
    
    if (markerData.ee && !isNaN(markerData.ee)) {
        note += "Expected Expenditure: " + markerData.ee + "<br>";
    }
    
    if (markerData.note) {
        note += "Note:<br>" + markerData.note;
    }
    
    return note;
}

function updateRouting() {
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    if (!document.getElementById('sr').checked) {
        return;
    }

    let waypoints = markers
        .filter(markerData => markerData.shouldRoute)
        .map(markerData => L.latLng(markerData.lat, markerData.lng));

    if (waypoints.length >= 2) {
        routingControl = L.Routing.control({
            waypoints: waypoints,
            routeWhileDragging: true,
            createMarker: function() { return null; }
        }).addTo(map);
    }
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
    if (markerData.doa) {
        let date = new Date(markerData.doa);
        let dateString = date.toISOString().split('T')[0];
        $("#doa").val(dateString);
    } else {
        $("#doa").val('');
    }
    $("#ee").val(markerData.ee);
    $("#type").val(markerData.type);
    $("#shouldRoute").val(markerData.shouldRoute ? "yes" : "no");
    $("#markerForm button[type='submit']").text("Update Marker");
    editingIndex = index;
}

function resetForm() {
    $("#markerForm")[0].reset();
    $("#markerForm button[type='submit']").text("Add Marker");
    editingIndex = null;
}

function saveMarkersToServer() {
    if(markers.length == 0){
        $("#saveStatus").html("Nothing to save!");
        return;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const planId = urlParams.get('planId');
    
    if (!planId) {
        $("#saveStatus").html("No plan selected!").css("color", "red");
        return;
    }
    
    const [userId, planSequence] = planId.split('-');
    const token = localStorage.getItem('token');
    
    const markersData = markers.map(marker => ({
        lat: marker.lat,
        lng: marker.lng,
        name: marker.name,
        doa: marker.doa,
        ee: marker.ee,
        note: marker.note,
        shouldRoute: marker.shouldRoute,
        type: marker.type
    }));

    $.ajax({
        url: `/api/plans/${userId}/${planSequence}/markers`,
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        data: JSON.stringify({ 
            markers: markersData,
            totalExpenditure: totalExpenditure,
            totalStayPoints: totalStayPoints,
            totalTourPoints: totalTourPoints
        }),
        success: function(data) {
            $("#saveStatus").html("Plan saved successfully!").css("color", "green");
        },
        error: function(xhr) {
            console.error("Error:", xhr.responseJSON);
            $("#saveStatus").html("Error saving plan: " + xhr.responseJSON.message).css("color", "red");
        }
    });
}
$("#saveMarkersBtn").on("click", saveMarkersToServer);

function getMarkerFromForm(){
    let latLong = $("#latlong").val().split(',');
    let lat = parseFloat(latLong[0]);
    let lng = parseFloat(latLong[1]);
    let doa = $("#doa").val();
    let ee = parseFloat($("#ee").val()) || 0;
    let name = $("#name").val();
    let note = $("#note").val();
    let type = $("#type").val();
    let shouldRoute = $("#shouldRoute").val() == "yes" ? true : false;

    if (isNaN(lat) || isNaN(lng)) {
        alert("Please enter valid latitude and longitude values.");
        return;
    }
    
    let markerData = {
        lat: lat,
        lng: lng,
        name: name,
        doa: doa,
        ee: ee,
        note: note,
        shouldRoute: shouldRoute,
        type: type
    };
    
    let formattedNote = formatMarkerNote(markerData);
    
    return [markerData, formattedNote];
}

$(document).ready(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const planId = urlParams.get('planId');

    if (planId) {
        const [userId, planSequence] = planId.split('-');
        loadPlanData(userId, planSequence);
    } else {
        console.log("Creating new plan");
    }

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

        const [markerData, popupNote] = getMarkerFromForm();
        if (editingIndex !== null) {
            // Update existing marker
            let oldData = markers[editingIndex];
            totalExpenditure -= oldData.ee;
            if (oldData.type === "stay") {
                totalStayPoints -= 1;
            } else {
                totalTourPoints -= 1;
            }

            map.removeLayer(oldData.marker);
            markerData.marker = L.marker([markerData.lat, markerData.lng], { 
                alt: markerData.name, 
                icon: markerData.type === "tour" ? redIcon : greenIcon 
            }).addTo(map).bindPopup(popupNote);

            markers[editingIndex] = markerData;

            totalExpenditure += markerData.ee;
            if (markerData.type === "stay") {
                totalStayPoints += 1;
            } else {
                totalTourPoints += 1;
            }

            $(`#markerList li[data-index="${editingIndex}"]`).html(
                `${markerData.name} <br> ${popupNote} <button class="delete-btn" data-index="${editingIndex}">Delete</button>`
            );

        } else {
            // Add new marker
            totalExpenditure += markerData.ee;
            if (markerData.type === "stay") {
                totalStayPoints += 1;
            } else {
                totalTourPoints += 1;
            }
            let marker = L.marker([markerData.lat, markerData.lng], { 
                alt: markerData.name, 
                icon: markerData.type === "tour" ? redIcon : greenIcon 
            }).addTo(map).bindPopup(popupNote);
            markerData.marker = marker;

            markers.push(markerData);

            let index = markers.length - 1;
            let listItem = `
                <li data-index="${index}">
                    ${markerData.name} <br> ${popupNote}
                    <button class="delete-btn" data-index="${index}">Delete</button>
                </li>`;
            $("#markerList").append(listItem);
        }
        resetForm();
        updateRouting();
        updateStats();
    });

    $("#markerList").on("click", ".delete-btn", function(e) {
        e.stopPropagation();
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
        resetForm();
        updateRouting();
        updateStats();
    });

    $("#markerList").on("click", "li", function(e) {
        if ($(e.target).hasClass("delete-btn")) return;
        let index = $(this).data("index");
        populateForm(index);
        let markerData = markers[index];
        map.setView([markerData.lat, markerData.lng], 13);
        markerData.marker.openPopup();
    });
});

function loadPlanData(userId, planSequence) {
    const token = localStorage.getItem('token');
    
    $.ajax({
        url: `/api/plans/${userId}/${planSequence}`,
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        },
        success: function(response) {
            response.markers.forEach(function(markerData) {
                let ee = parseFloat(markerData.ee) || 0;
                totalExpenditure += ee;
                if (markerData.type === "stay") {
                    totalStayPoints += 1;
                } else {
                    totalTourPoints += 1;
                }
                
                let popupNote = formatMarkerNote(markerData);
                
                let marker = L.marker([markerData.lat, markerData.lng], { 
                    alt: markerData.name, 
                    icon: markerData.type === "tour" ? redIcon : greenIcon 
                }).addTo(map).bindPopup(popupNote);
                
                markerData.marker = marker;
                markers.push(markerData);
                
                let index = markers.length - 1;
                let listItem = `
                    <li data-index="${index}">
                        ${markerData.name} <br> ${popupNote}
                        <button class="delete-btn" data-index="${index}">Delete</button>
                    </li>`;
                $("#markerList").append(listItem);
            });
            
            updateRouting();
            updateStats();
        },
        error: function(xhr) {
            console.error('Error loading plan:', xhr.responseJSON);
            alert('Error loading plan: ' + (xhr.responseJSON?.message || 'Unknown error'));
        }
    });
}
