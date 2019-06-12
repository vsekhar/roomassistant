// TODO: 5-min trigger does incremental sync if possible (valid sync key in user properties)
// TODO: 24-hour trigger deletes sync key

function createTriggers() {
  // Incremental sync every 5 mins, if possible.
  ScriptApp.newTrigger('sync')
      .timeBased()
      .everyMinutes(5)
      .create();

  // Run full sync at least once a day.
  ScriptApp.newTrigger('clearSyncToken')
      .timeBased()
      .everyDays(1)
      .atHour(1)
      .create();
}

function sync() {
    return doSync({fullSync: false});
}

function fullSync() {
    return doSync({fullSync: true});
}

function doSync({fullSync = false} = {}) {
    var events = getSyncEvents({fullSync: fullSync});
    Logger.log("Got :", events.length, " events");

    // Index by date
    var eventsByDate = {};
    for (e in events) {
        var event = events[e];
        var date = startOfDate(event.startTime);
        if (!eventsByDate.hasOwnProperty(date)) {
            eventsByDate[date] = [event];
        } else {
            eventsByDate = eventsByDate.push(event);
        }
    }
    var building = buildingFromEvents(events);
    if (building == null) {
        building = buildingFromDirectoryOrDie();
    }
    Logger.log("User is in )
}

function clearSyncToken() {
    Logger.log('clearing sync token');
    var properties = PropertiesService.getUserProperties();
    properties.deleteProperty(syncTokenName);
}
