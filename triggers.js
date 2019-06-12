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

const syncTokenName = 'roomassistantSyncToken';

function sync() {
    var startDate = startOfDate(today());
    var endDate = new Date(startDate.getDate() + 14);
    var events = Calendar.Events.list(cal.getId(), {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,  // blow up recurring events into single events
        orderBy: 'startTime',
        maxResults: 1000, // max 2500
        syncToken: PropertiesService.getUserProperties().getProperty(syncTokenName) // null if none
      });

    // handle pagination

    // set syncToken to new sync token from last request
    PropertiesService.getUserProperties().setProperty(syncTokenName, syncToken);
}

function clearSyncToken() {
    log('clearing sync token')
    PropertiesService.getUserProperties().deleteProperty(syncTokenName);
}
