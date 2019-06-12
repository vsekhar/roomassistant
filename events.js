const syncTokenName = 'roomassistantSyncToken';
const lookAheadDays = 14;
const maxResultsPerPage = 50; // max 2500

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
      endDate.setDate(endDate.getDate() + lookAheadDays);
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
          Logger.log("Request: " + JSON.stringify(options));
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

      var responseForLog = Object.assign({}, response);
      responseForLog.items = response.items.length;
      Logger.log("Response: " + responseForLog);

      for (e in response.items) {
          var event = response.items[e];
          Logger.log("Received event: " + event.summary);
      }
      events = events.concat(response.items);

      pageToken = response.nextPageToken;
  } while (pageToken);

  if (!response.hasOwnProperty('nextSyncToken')) {
      Logger.log("Error: No nextSyncToken")
      return;
  }
  properties.setProperty(syncTokenName, response.nextSyncToken);
  return events;
}
