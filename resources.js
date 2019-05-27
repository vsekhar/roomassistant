// buildings.
//    buildingsByName['WAT-BRT2'] == 'CA-WAT-BRT2'
//    buildingsById['CA-WAT-BRT2'] == 'WAT-BRT2'
var buildings = {};

// rooms.
//    roomsByBuildingId['CA-WAT-BRT2'] == [roomIds...]
var rooms = {};

function initResources() {
  const cacheName = 'buildingsMappings5';
  var cache = CacheService.getUserCache();
  var cachedBuildingsMappings = cache.get(cacheName);
  if (cachedBuildingsMappings != null) {
    buildings = JSON.parse(cachedBuildingsMappings);
    return;
  }
  
  // refresh
  var buildingsList = AdminDirectory.Resources.Buildings.list('my_customer').buildings;
  buildings.buildingsByName = {};
  buildings.buildingsById = {};
  for (b in buildingsList) {
    var building = buildingsList[b];
    buildings.buildingsByName[building.buildingName] = building.buildingId;
    buildings.buildingsById[building.buildingId] = building.buildingName;
  }
  cache.put(cacheName, JSON.stringify(buildings), 21600); // 6 hours
}

// Returns the building ID if nameOrId denotes a building name or ID, null otherwise.
function buildingId(nameOrId) {
  // ID already?
  if (buildings.buildingsById.hasOwnProperty(nameOrId)) {
    return nameOrId;
  }
  
  // Name?
  if (buildings.buildingsByName.hasOwnProperty(nameOrId)) {
    return buildings.buildingsByName[nameOrId];
  }
  return null;
}

// Checks events for an all day event with a building name or ID.
// Returns the first building ID found, "skip" if no rooms are required that day,
// or null if a building cannot be determined from the calendar.
function buildingFromEvents(events) {
  for (e in events) {
    var event = events[e];
    
    if (typeof event.start.date === 'undefined') {
      // all day events only
      continue;
    }
    var bid = buildingId(event.summary);
    if (bid != null) {
      return bid;
    }
    if (event.summary.startsWith("WFH") ||
        event.summary.startsWith("OOO") ||
        event.summary.startsWith("Out of office")) {
      return "skip";
    }
  }
  return null;
}

// Returns the building ID of the user's desk or default location (updated every 6 hours) or null.
function buildingFromDirectory() {
  const cacheName = 'buildingFromDirectory-building';
  var cache = CacheService.getUserCache();
  var cachedBuildingId = cache.get(cacheName);
  if (cachedBuildingId != null) {
    return cachedBuildingId;
  } else {
    // fetch fresh home/desk building for user
    var people = People.People.getBatchGet({
      resourceNames: ['people/me'],
      personFields: ['metadata']
    });
    var id = people.responses[0].person.metadata.sources[0].id;
    var user = AdminDirectory.Users.get(id, {viewType: "domain_public"});
    
    var building;
    for (l in user.locations) {
      var location = user.locations[l];
      if (location.type == 'desk' || location.type == 'default') {
        cache.put(cacheName, location.buildingId, 21600); // 21600 seconds (6 hours) is max cache time
        return location.buildingId;
      }
    }
  }
  return null;
}

// Returns the building ID where the user is likely to be, or "skip" if the user doesn't need rooms in buildings that day.
function whereIsTheUserOrDie(date) {
  var events = getEvents(startOfDate(today()), endOfDate(today()));
  var building = buildingFromEvents(events);
  if (building != null) {
    return building;
  }
  building = buildingFromDirectory();
  if (building != null) {
    return building;
  }
  throw("Failed to determine building");
}
