function doSync({fullSync = false} = {}) {
    var events = getSyncEvents({fullSync: fullSync});
    Logger.log("Syncing :", events.length, " events");

    // Index events by date
    var eventsByDate = {};
    for (e in events) {
        var event = events[e];
        var date;
        if (event.start.date) {
            date = new Date(event.start.date);
        } else {
            date = startOfDate(event.start.dateTime);
        }
        if (!eventsByDate.hasOwnProperty(date)) {
            eventsByDate[date] = [event];
        } else {
            eventsByDate[date].push(event);
        }
    }

    // Roomify each date
    initResources();
    for (d in eventsByDate) {
        var events = eventsByDate[d];
        var date = new Date(d);
        var dateString = date.toLocaleDateString("en-US");
        var buildingId = buildingFromEvents(events);
        if (buildingId == null) {
            buildingId = buildingFromDirectoryOrDie();
        }
        if (buildingId === 'skip') {
            Logger.log("User is not in the office on ", dateString);
            continue;
        }

        // Get rooms in buildingId and index by email
        Logger.log("User is in ", buildingId, " on ", dateString);
        var rooms = rankedRoomsIn(buildingId);
        var roomsByEmail = {};
        for (r in rooms) {
          var room = rooms[r];
          roomsByEmail[room.resourceEmail] = room;
        }
      
        // Loop through events
        for (e in events) {
            var event = events[e];

            if (event.start.date) continue; // skip all-day events

            var roomRequested = event.summary.toLowerCase().includes('room');
            var hasAttendees = event.attendees && event.attendees.length > 0;
            var numAttendees = hasAttendees ? event.attendees.length : 0;

            // numAttendees == 
            //   0: just the user (no guests, no rooms)
            //   1: attendee list too large to display (e.g. all-hands)
            //       - event.attendeesOmitted doesn't work to detect big meetings
            //   2: event has one other guest or a room, plus the user
            //       - Yes, adding *just* a room to an empty event bumps
            //         numAttendees from 0 to 2...
            if (!roomRequested) {
                if (numAttendees == 0) continue; // skip non-meetings
                if (numAttendees == 1) continue; // skip all-hands
            }

            var humans = 0;
            var userDeclined = false;
            var hasRoom = false;
            for (a in event.attendees) {
                var attendee = event.attendees[a];
                if (attendee.self && attendee.responseStatus == 'declined') userDeclined = true;
                if (attendee.resource && attendee.responseStatus == 'accepted' && roomsByEmail.hasOwnProperty(attendee.email)) hasRoom = true;
                if (!attendee.resource) humans++;
            }
            if (hasRoom) continue;
            if (userDeclined) continue;
            if (!roomRequested) {
                if (humans == 0) throw new Error("Event has attendees but no humans"); // unexpected
                if (humans == 1) continue; // skip non-meetings
            }

            // Logger.log("ROOMIFYING: " + event.summary + "' (" + humans + " humans, " + numAttendees + " attendees) on " + dateString);

            var newRoomEmail = findAvailable(rooms, event.start.dateTime, event.end.dateTime);
            // TODO: improve this with an email summary of failures
            if (!newRoomEmail) throw new Error("no available room found");
            var newRoom = roomsByEmail[newRoomEmail];

            // TODO: check to ensure chosen room isn't already on the event (and declined)
            // TODO: add room to event
            Logger.log("ADD: " + newRoom.generatedResourceName + " to '" + event.summary + "' (" + humans + " humans, " + numAttendees + " attendees) on " + dateString);
        }
    }
}
