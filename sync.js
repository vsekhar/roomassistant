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
            if (event.attendeesOmitted) continue; // skip big events (e.g. all-hands)

            var humans = 0;
            var going = false;
            var hasRoom = false;
            for (a in event.attendees) {
                var attendee = event.attendees[a];
                if (attendee.self && attendee.responseStatus != 'declined') going = true;
                if (attendee.resource && attendee.responseStatus == 'accepted' && roomsByEmail.hasOwnProperty(attendee.email)) hasRoom = true;
                if (!attendee.resource) humans++;
            }
            if (!going) continue;
            if (hasRoom) continue;
            if (humans == 1) continue; // skip events without other people

            var newRoomEmail = findAvailable(rooms, event.start.dateTime, event.end.dateTime);
            // TODO: improve this with an email summary of failures
            if (!newRoomEmail) throw new Error("no available room found");
            var newRoom = roomsByEmail[newRoomEmail];

            // TODO: add room to event
            Logger.log("ADD: " + newRoom.generatedResourceName + " to '" + event.summary + "' on " + dateString);
        }
    }
}
