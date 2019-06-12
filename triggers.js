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
    var events = getSyncEvents({fullSync: false});
    Logger.log("Got :", events.length, " events");
}

function fullSync() {
    var events = getSyncEvents({fullSync: true});
    Logger.log("Got :", events.length, " events");
}

function clearSyncToken() {
    Logger.log('clearing sync token');
    var properties = PropertiesService.getUserProperties();
    properties.deleteProperty(syncTokenName);
}
