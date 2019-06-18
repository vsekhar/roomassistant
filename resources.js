// Building aliases users can use to tag days in their calendar.
// These are typically the largest/first/canonical buildings in their
// respective cities. Add to this list as needed. Use lowercase for
// aliases.
var buildingAliases = {
  mtv: "US-MTV-900",
  nyc: "US-NYC-9TH",
  sfo: "US-SFO-SPE",
  tor: "CA-TOR-111",
  wat: "CA-WAT-BRT2"
};

// buildings.
//    buildingsByName['WAT-BRT2'] == 'CA-WAT-BRT2'
//    buildingsById['CA-WAT-BRT2'] == 'WAT-BRT2'
var buildings = {};

function initBuildings() {
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
  for (building of buildingsList) {
    buildings.buildingsByName[building.buildingName] = building.buildingId;
    buildings.buildingsById[building.buildingId] = building.buildingName;
  }
  cache.put(cacheName, JSON.stringify(buildings), 21600); // 6 hours
}

function initResources() {
  initBuildings();
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

  // Alias?
  var nameOrIdLowerCase = nameOrId.toLowerCase();
  if (buildingAliases.hasOwnProperty(nameOrIdLowerCase)) {
    return buildingAliases[nameOrIdLowerCase];
  }
  
  return null;
}

// Checks events for an all day event with a building name or ID.
// Returns the first building ID found, "skip" if no rooms are required that day,
// or null if a building cannot be determined from the calendar.
function buildingFromEvents(events) {
  for (event of events) {    
    if (typeof event.start.date === 'undefined') {
      // all day events only
      continue;
    }
    var bid = buildingId(event.summary);
    if (bid != null) {
      return bid;
    }
    var eventSummaryLowerCase = event.summary.toLowerCase();
    if (eventSummaryLowerCase.startsWith("wfh") ||
        eventSummaryLowerCase.startsWith("ooo") ||
        eventSummaryLowerCase.startsWith("out of office")) {
      return "skip";
    }
  }
  return null;
}

const userBuildingOverridePropertyName = 'roomassistantUserBuildingOverride'

function setBuildingOverride(building) {
  var properties = PropertiesService.getUserProperties();
  properties.setProperty(userBuildingOverridePropertyName, building);
}

// Returns the building ID of the user's desk or default location (updated every 6 hours).
function buildingFromDirectoryOrDie() {
  // Check for override
  var properties = PropertiesService.getUserProperties();
  var buildingOverride = properties.getProperty(userBuildingOverridePropertyName);
  if (buildingOverride != null) {
    var id = buildingId(buildingOverride);
    if (id == null) {
      throw new Error("Bad building override: " + buildingOverride);
    }
    return id;
  }

  // Get from actual directory
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
    var me = people.responses[0].person
    var id = me.metadata.sources[0].id;
    var user = AdminDirectory.Users.get(id, {viewType: "domain_public"});
    
    var building;
    for (location of user.locations) {
      if (location.type == 'desk' || location.type == 'default') {
        cache.put(cacheName, location.buildingId, 21600); // 21600 seconds (6 hours) is max cache time
        return location.buildingId;
      }
    }
  }
  throw("Failed to determine user's building: ", me);
}

function roomsIn(buildingId) {
  var rooms = [];
  var pageToken;
  var options = {
    'query': 'buildingId=' + buildingId,
    'orderBy': 'capacity',
    'maxResults': 500 // max 500
  };

  do {
    options.pageToken = pageToken;
    var response = AdminDirectory.Resources.Calendars.list('my_customer', options);

    // filter out things that are not conference rooms; they tend not to have calendars.
    response.items = response.items.filter(function(r) {
      if (r.resourceCategory === 'OTHER') return false;
      return true;
    })

    rooms = rooms.concat(response.items);
    pageToken = response.nextPageToken;
  } while (pageToken);

  return rooms;
}

function rankedRoomsIn(buildingId) {
  var rooms = roomsIn(buildingId);
  // TODO: some magic ranking
  return rooms;
}

// availableRoomGenerator returns a generator that yields rooms from, and
// in the order of, rankedRooms that are available between startTime and
// endTime.
function* availableRoomGenerator(rankedRooms, startTime, endTime) {
  // API max is 50
  // See: cs/calendar_rosy_max_freebusy_calendars_per_request
  const batchSize = 50;

  for (var batch = 0; batch*batchSize < rankedRooms.length; batch++) {
    var rooms = rankedRooms.slice(batch*batchSize, ((batch+1)*batchSize));
    var query = {
      items: [],
      timeMin: startTime,
      timeMax: endTime,
      calendarExpansionMax: batchSize // calendarExpansionMax defaults to 20 
    };
    for (room of rooms) {
      query.items.push({'id': room.resourceEmail});
    }
    var response = Calendar.Freebusy.query(query);
    for (room of rooms) {
      if (!response.calendars.hasOwnProperty(room.resourceEmail)) {
        throw new Error("Requested room not returned: " + room);
      }
      var cal = response.calendars[room.resourceEmail];
      if (cal.errors) {
        // some rooms don't have calendars...
        if (cal.errors.length == 1 && cal.errors[0].reason === 'notFound') {
          continue;
        }

        // otherwise something else went wrong
        throw new Error("Calendar (" + JSON.stringify(room) + ") error: " + JSON.stringify(cal.errors));
      }
      if (cal.busy.length == 0) {
        yield room;
      }
    }
  }
  return null;
}
