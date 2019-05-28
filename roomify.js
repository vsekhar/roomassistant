// Number of days to look ahead (1 = just today).
const lookahead = 1;

function runNow() {
  var cal = CalendarApp.getDefaultCalendar();
  var date = new Date();
  roomifyDate(cal, date);
  log('Room assistant running on \'' + cal.getName() + '\' for ' + date);
}

function log(s) {
  Logger.log(new Date() + ': ' + s);
}

function ensureRoomsInBuilding(date, buildingId) {
  var email = Session.getActiveUser().getEmail();

  var rooms = roomsIn(buildingId);
  var roomsByEmail = {};
  for (r in rooms) {
    var room = rooms[r];
    roomsByEmail[room.resourceEmail] = room;
  }

  var events = getEvents(startOfDate(date), endOfDate(date));
  for (e in events) {
    var event = events[e];
    if (event.start.date) {
      continue; // skip all day events (ones with a .date instead of a .dateTime)
    }

    var going = false;
    var roomInBuilding = false;
    for (a in event.attendees) {
      var attendee = event.attendees[a];
      // Is the attendee the user and have they not declined? Then assume going.
      if (attendee.email == email && attendee.responseStatus != 'declined') {
        going = true;
        log("User going to: " + event.summary)
      }

      // Is the attendee a resource that has accepted?
      if (attendee.resource && attendee.responseStatus == 'accepted') {
        log("Resource accepted: " + attendee.displayName + ", " + attendee.email)
        // in the right building?
        if (roomsByEmail.hasOwnProperty(attendee.email)) {
          roomInBuilding = true;
          log("Room in user's building found")
        }
      }
    }

    if (!going) {
      continue;
    }

    if (!roomInBuilding) {
      var resourceEmails = [];
      for (r in roomsByEmail) {
        var room = roomsByEmail[r];
        resourceEmails.push({'id': room.resourceEmail});
      }
      var query = {
        items: resourceEmails,
        timeMin: event.start.dateTime,
        timeMax: event.end.dateTime
      }
      var resp = Calendar.Freebusy.query(query);
      for (fbr in resp.calendars) {
        var fbRoom = resp.calendars[fbr];
        if (fbRoom.errors && fbRoom.errors.length != 0) {
          log("Errors with room (" + fbr + "): " + JSON.stringify(fbRoom.errors));
          // TODO: getting "too many calendars queried" errors, prioritize/paginate somehow.
        }
        if (fbRoom.busy.length == 0) {
          // no busy periods within query period, so it's free
          log("Found: " + fbr);
        }
      }
    }
  }
}
