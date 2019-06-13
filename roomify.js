function runNow() {
  var cal = CalendarApp.getDefaultCalendar();
  var date = new Date();
  roomifyDate(cal, date);
  Logger.log('Room assistant running on \'' + cal.getName() + '\' for ' + date);
}

// Returns the resourceEmail of the first room in rankedRooms that is free
// between startTime and endTime. Returns null if none found.
function findAvailable(rankedRooms, startTime, endTime) {
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
    for (r in rooms) {
      query.items.push({'id': rooms[r].resourceEmail});
    }
    var response = Calendar.Freebusy.query(query);
    for (r in rooms) {
      var room = rooms[r];
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
        return room.resourceEmail;
      }
    }
  }
  return null;
}