/* global moment sleep L apiUrl fetchJson */

const globalMinTimestamp = moment('2017-01-01').valueOf();
const globalMaxTimestamp = moment().valueOf();

// the map
let instruction2Map = null;
let instruction3Map = null;

// The {latitude, longitude, timestamp} groups
let instruction2Points = null;

// list of all instruction2Markers
let instruction2Markers = [];

// the square areas created by the user
let exclusionZones = [];
let minTimestamp = globalMinTimestamp;
let maxTimestamp = globalMaxTimestamp;

/**
 * loads the map
 */
function loadInstruction2Map() {
  instruction2Map = L.map('instruction2-map');
  instruction2Map.setView([0, 0], 2);

  const osm = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: ('Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
      '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
      'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>'),
    maxZoom: 18,
    minZoom: 2,
    id: 'mapbox/streets-v11',
    tileSize: 512,
    zoomOffset: -1,
    accessToken: 'pk.eyJ1IjoicGltcGFsZSIsImEiOiJjazhkbzk4NTIwdHkzM21vMWFiNHI' +
      'zZ3BiIn0.nLv4P71SFh4TIANuwJ8I9A',
  });

  osm.addTo(instruction2Map);

  const drawnItems = L.featureGroup().addTo(instruction2Map);

  instruction2Map.addControl(new L.Control.Draw({
    position: 'topright',
    edit: {
      featureGroup: drawnItems,
      edit: false,
      poly: {
        allowIntersection: false,
      },
    },
    draw: {
      featureGroup: drawnItems,
      polyline: false,
      polygon: false,
      circle: false,
      marker: false,
      rectangle: true,
      circlemarker: false,
    },
  }));

  function genExclusionZones() {
    exclusionZones = [];
    drawnItems.eachLayer((l) => {
      exclusionZones.push(l.getBounds());
    })
  }

  instruction2Map.on(L.Draw.Event.CREATED, async function (event) {
    if (!rendering) {
      drawnItems.addLayer(event.layer);
      genExclusionZones();
      await renderInstruction2Map();
    }
  });

  instruction2Map.on(L.Draw.Event.DELETED, async function (event) {
    if (!rendering) {
      drawnItems.removeLayer(event.layer);
      genExclusionZones();
      await renderInstruction2Map();
    }
  });

  $('#instruction2-map-daterange').ionRangeSlider({
    skin: 'round',
    type: 'double',
    grid: true,
    min: minTimestamp,
    max: maxTimestamp,
    from: minTimestamp,
    to: maxTimestamp,
    prettify: (ts) => moment(ts).format('MMM D, YYYY'),
    onFinish: async function () {
      // retrieve the millisecond range permitted
      minTimestamp = $('#instruction2-map-daterange').data('from')
      maxTimestamp = $('#instruction2-map-daterange').data('to')
      await renderInstruction2Map();
    },
  });
}

function loadInstruction3Map() {
  instruction3Map = L.map('instruction3-map');
  instruction3Map.setView([0, 0], 2);

  const osm = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: ('Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
      '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
      'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>'),
    maxZoom: 18,
    minZoom: 2,
    id: 'mapbox/streets-v11',
    tileSize: 512,
    zoomOffset: -1,
    accessToken: 'pk.eyJ1IjoicGltcGFsZSIsImEiOiJjazhkbzk4NTIwdHkzM21vMWFiNHI' +
      'zZ3BiIn0.nLv4P71SFh4TIANuwJ8I9A',
  });

  osm.addTo(instruction3Map);

  const drawnItems = L.featureGroup().addTo(instruction3Map);

  function genExclusionZones() {
    exclusionZones = [];
    drawnItems.eachLayer((l) => {
      exclusionZones.push(l.getBounds());
    })
  }

  instruction2Map.on(L.Draw.Event.CREATED, async function (event) {
    if (!rendering) {
      drawnItems.addLayer(event.layer);
      genExclusionZones();
      await renderInstruction2Map();
    }
  });

  instruction2Map.on(L.Draw.Event.DELETED, async function (event) {
    if (!rendering) {
      drawnItems.removeLayer(event.layer);
      genExclusionZones();
      await renderInstruction2Map();
    }
  });

  $('#instruction2-map-daterange').ionRangeSlider({
    skin: 'round',
    type: 'double',
    grid: true,
    min: minTimestamp,
    max: maxTimestamp,
    from: minTimestamp,
    to: maxTimestamp,
    prettify: (ts) => moment(ts).format('MMM D, YYYY'),
    onFinish: async function () {
      // retrieve the millisecond range permitted
      minTimestamp = $('#instruction2-map-daterange').data('from')
      maxTimestamp = $('#instruction2-map-daterange').data('to')
      await renderInstruction2Map();
    },
  });
}


function addMarker(latlng, html) {
  let marker = new L.Marker(latlng);
  instruction2Map.addLayer(marker);
  if (html != null) {
    marker.bindPopup(html);
  }
  instruction2Markers.push(marker);
}

let rendering = false;

function getValidPoints() {
  return instruction2Points
    .filter((x) => x.timestamp >= minTimestamp && x.timestamp < maxTimestamp)
    .filter((loc) => {
      for (const box of exclusionZones) {
        if (box.contains([loc.latitude, loc.longitude])) {
          return false
        }
      }
      return true;
    });
}

/**
 * Renders the instruction2Markers on the map, making sure to ignore areas that are covered
 * with a block. Also ignores the areas outside of the given time range Domain: [minT, maxT)
 */
async function renderInstruction2Map() {
  rendering = true;
  // clean map
  for (let i = 0; i < instruction2Markers.length; i++) {
    instruction2Map.removeLayer(instruction2Markers[i]);
  }
  instruction2Markers = [];

  $('#instruction2-map-progress-div').show();

  $('#instruction2-map-daterange').data('ionRangeSlider').update({
    block: true,
  });

  // Calculate the points that fit within these places
  const renderable_points = getValidPoints();
  // get the length
  const renderable_points_length = renderable_points.length;

  $('#instruction2-counter').html(`${(renderable_points_length / 10e3).toFixed(2)}/10.00 Megabytes Used`)
  if (renderable_points_length / 10e3 < 10) {
    $('#instruction2-confirm').prop('disabled', false);
  } else {
    $('#instruction2-confirm').prop('disabled', true);
  }

  let lastlatlng = null
  for (let i = 0; i < renderable_points_length; i++) {
    // get current location
    let loc = renderable_points[i]
    const latlng = [loc.latitude, loc.longitude]
    if (lastlatlng != null) {
      if (Math.hypot(latlng[0] - lastlatlng[0], latlng[1] - lastlatlng[1]) < 0.01) {
        continue;
      }
      lastlatlng = latlng;
    } else {
      lastlatlng = latlng;
    }

    await sleep(1);
    $('#instruction2-map-progress').css('width', `${(i * 100.0) / renderable_points_length}%`);
    addMarker(latlng, moment(loc.timestamp).format('MMM D, hh:ss a'));
  }

  $('#instruction2-map-daterange').data('ionRangeSlider').update({
    block: false,
  });

  $('#instruction2-map-progress-div').hide();
  $('#instruction2-map-progress').css('width', '0%');
  rendering = false;
}

/**
 * Instruction step 0
 */
async function instruction0() {
  $('#instruction1-selectfile').prop('disabled', true);
  await instruction1();
}

/**
 * when the file handler loads a file, we process it
 */
async function instruction1() {
  // when a file is uploaded
  $('#customFile').change(async function () {
    const f = this.files[0];
    // enable the button and set a listener
    $('#instruction1-selectfile').prop('disabled', false);
    $('#instruction1-selectfile').button().click(async function () {
      $('#instruction1-selectfile').prop('disabled', true);
      await instruction2(f);
    });
  });
}

/**
 * we initialize the methods for the user to begin excluding data
 */
async function instruction2(file) {
  loadInstruction2Map();

  $('#instruction1-div').hide();
  $('#instruction2-div').show();

  // corona didn't really get started till 2020
  instruction2Points = JSON.parse(await file.text()).locations
    .filter((loc) => loc.timestampMs >= minTimestamp && loc.timestampMs < maxTimestamp)
    .map((loc) => ({
      latitude: loc.latitudeE7 * 10e-8,
      longitude: loc.longitudeE7 * 10e-8,
      timestamp: parseInt(loc.timestampMs),
    }));

  await renderInstruction2Map();

  $('#instruction2-confirm').prop('disabled', false);
  $('#instruction2-confirm').button().click(async function () {
    $('#instruction2-wait').show();
    const ret = await fetchJson(`${apiUrl()}/checklocations/`, {
      method: 'post',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({locs: getValidPoints()})
    });
    $('#instruction2-wait').hide();
    await instruction3(ret);
  })
}

/**
 * Let the user be able to see their own exposures to coronavirus
 */
async function instruction3(checkedLocations) {
  $('#instruction2-div').hide();
  $('#instruction3-div').show();

}

$(document).ready(async function () {
  // begin the process
  await instruction0();
});
