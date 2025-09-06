const map = L.map("map").setView([51.505, -0.09], 13);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const greenIcon = L.icon({
    iconUrl: "images/greenMarker.png",
    shadowUrl: "images/shadowMarker.png",

    iconSize:     [38, 95],
    shadowSize:   [50, 64],
    iconAnchor:   [22, 94],
    shadowAnchor: [4, 62],
    popupAnchor:  [-3, -76]
});
const redIcon = L.icon({
    iconUrl: "images/redMarker.png",
    shadowUrl: "images/shadowMarker.png",

    iconSize:     [38, 95],
    shadowSize:   [50, 64],
    iconAnchor:   [22, 94],
    shadowAnchor: [4, 62],
    popupAnchor:  [-3, -76]
});

let markers = [];
let routingControl = null;
let totalExpenditure = 0;
let totalStayPoints = 0;
let totalTourPoints = 0;

function updateRouting() {
    return; //for now
    // Remove previous routing control, if any
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }

    let waypoints = markers.map(markerData => 
        L.latLng(markerData.lat, markerData.lng)
    );

    // Only add routing if there are at least two markers
    if (waypoints.length >= 2) {
        routingControl = L.Routing.control({
            waypoints: waypoints,
            routeWhileDragging: true,
            createMarker: function() { return null; }
        }).addTo(map);
    }
}

function createNote(note, doa, ee, lat, lng){
    let n = "";
    if(doa != ""){
        n += "Date Of Arrival: " + doa.toString() + "\n";
    }
    if(!isNaN(ee)){
        n += "Expected Expenditure: " + ee.toString() + "\n";
        totalExpenditure += ee
    }
    if(note != ""){
        n += "Note:\n" + note;
    }
    return n;
}
function updateStats(){
    $("#stats").html(
        "Total Expenditure: " + totalExpenditure.toString() + "<br>" + 
        "Stay Points: " + totalStayPoints.toString() + "<br>" +
        "Tour Points: " + totalTourPoints.toString()
    );
};

$(document).ready(function() {
    // Make the marker list sortable
    $("#markerList").sortable({
        update: function(event, ui) {
            // Reorder markers array based on the new order in the UI
            let newOrder = [];
            $("#markerList li").each(function() {
                let index = $(this).data("index");
                newOrder.push(markers[index]);
            });
            markers = newOrder;
            // Update indices in the DOM
            $("#markerList li").each(function(i) {
                $(this).data("index", i);
            });
        }
    });
    $("#markerList").disableSelection();

    // Handle form submission to add a marker
    $("#markerForm").on("submit", function(e) {
        e.preventDefault();
        
        let latLong = $("#latlong").val().split(',');
        let lat = parseFloat(latLong[0]);
        let lng = parseFloat(latLong[1]);
        let doa = $("#doa").val();
        let ee = parseFloat($("#ee").val());
        let name = $("#name").val();
        let note = $("#note").val();
        let type = $("#type").val();
        let popupNote = createNote(note, doa, ee, lat, lng);
        if(type == "stay"){
            totalStayPoints += 1;
        }else{
            totalTourPoints += 1;
        };

        if (isNaN(lat) || isNaN(lng)) {
            alert("Please enter valid latitude and longitude values.");
            return;
        }

        // Add marker to the map
        let marker = L.marker([lat, lng], { alt: name, icon: (type=="tour")?redIcon:greenIcon }).addTo(map).bindPopup(popupNote);
        
        // Store marker with metadata
        let markerData = {
            marker: marker,
            lat: lat,
            lng: lng,
            name: name,
            doa: doa,
            ee: ee,
            note: note
        };
        markers.push(markerData);

        // Add marker to the list
        let index = markers.length - 1;
        let listItem = `
            <li data-index="${index}">
                ${name} - ${note}
                <button class="delete-btn" data-index="${index}">Delete</button>
            </li>
        `;
        $("#markerList").append(listItem);

        // Clear the form
        $("#markerForm")[0].reset();

        updateRouting();
        updateStats();
    });

    // Handle marker deletion
    $("#markerList").on("click", ".delete-btn", function() {
        let index = $(this).data("index");
        totalExpenditure -= markers[index].ee;
        if(markers[index].type == "stay"){
            totalStayPoints -= 1;
        }else{
            totalTourPoints -= 1;
        };
        // Remove marker from map
        map.removeLayer(markers[index].marker);
        // Remove marker from array
        markers.splice(index, 1);
        // Remove list item from DOM
        $(this).parent().remove();
        // Update indices in the DOM
        $("#markerList li").each(function(i) {
            $(this).data("index", i);
            $(this).find(".delete-btn").data("index", i);
        });
        updateRouting();
        updateStats();
    });

    // marker on click
     $("#markerList").on("click", "li", function(e) {
        let index = $(this).data("index");
        let markerData = markers[index];
        // Center the map on the marker
        map.setView([markerData.lat, markerData.lng], 13);
        // Open the marker's popup
        markerData.marker.openPopup();
    });
});
