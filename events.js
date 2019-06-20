const lookAheadDays = 13; // 0 means just today

const syncTokenName = 'roomassistantSyncToken';
const maxResultsPerPage = 50; // max 2500
const maxAttendees = 30; // otherwise skip event

// Returns events for a calendar on a date.
function getSyncEvents({fullSync = false} = {}) {
  // Properties service takes some time to update so fullSync is used as an
  // override when a syncToken is invalidated by the server.
  var properties = PropertiesService.getUserProperties();
  var options = {
      singleEvents: true, // blow up recurring events into single events
      maxResults: maxResultsPerPage
  };

  var syncToken = properties.getProperty(syncTokenName);
  if (syncToken && !fullSync) {
      options.syncToken = syncToken;
  } else {
      // fresh request
      var startDate = startOfDate(today());
      options.timeMin = startDate.toISOString();
      var endDate = new Date(startDate.valueOf());
      endDate.setDate(endDate.getDate() + (debug ? 0 : lookAheadDays));
      endDate = endOfDate(endDate);
      options.timeMax = endDate.toISOString();
      // NB: Setting options.orderBy = 'startTime' breaks syncToken
  }

  // page through events
  var response;
  var events = [];
  var pageToken;
  do {
      try {
          options.pageToken = pageToken;
          response = Calendar.Events.list('primary', options);
      } catch (e) {
          // Check if server invalidated sync token
          if (e.message === 'Sync token is no longer valid, a full sync is required.') {
              Logger.log(e.message);
              properties.deleteProperty(syncTokenName);
              return doGetSyncEvents({fullSync: true});
          } else {
              throw new Error(e.message);
          }
      }
      events = events.concat(response.items);
      pageToken = response.nextPageToken;
  } while (pageToken);

  if (!response.hasOwnProperty('nextSyncToken')) {
      throw new Error("Error: No nextSyncToken")
  }
  properties.setProperty(syncTokenName, response.nextSyncToken);
  return events;
}

function addRoom(event, room) {
    var newEvent = {attendees: Array.from(event.attendees)};
    newEvent.attendees.push({
        email: room.resourceEmail,
        resource: true
    });
    Logger.log("Original event: " + JSON.stringify(event));
    Logger.log("Room: " + JSON.stringify(room));
    Logger.log("New event: " + JSON.stringify(newEvent));
    try {
        if (!dryRun) {
            Calendar.Events.patch(
                newEvent,
                'primary',
                event.id,
                {sendUpdates: 'none'},
                {'If-Match': event.etag}
            );
        }
        Logger.log('Successfully added ' + room.generatedResourceName + ' to ' + event.summary);
        if (dryRun) Logger.log("(dry run, nothing modified)");
    } catch (e) {
        Logger.log('Patch threw an exception: ' + JSON.stringify(e));
        // TODO: if not allowed, create a new event called 'room' and copy over
        // conferencing information.
    }

    // Don't clean up declined rooms here since we don't yet know if the
    // room we just added will accept or decline.
}
